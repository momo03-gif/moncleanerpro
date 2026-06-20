// ════════════════════════════════════════════════════════════════════════════
//  Moteur de synchronisation des réservations (SERVEUR uniquement).
//  À n'importer que dans des routes API : utilise le client service_role et
//  effectue des requêtes réseau sortantes (fetch des calendriers iCal).
//
//  Deux étapes :
//   1) syncAllFeeds()          → importe/actualise les réservations depuis les iCal
//   2) materializeMissions()   → transforme chaque DÉPART confirmé en mission ménage
//
//  Périmètre : appartements Airbnb / conciergerie. Les hôtels ne sont jamais touchés.
// ════════════════════════════════════════════════════════════════════════════

import { getSupabaseAdmin } from './supabaseAdmin';
import { parseICal, type ICalEvent } from './ical';
import { notifyPartnerCreatedMission } from './notifications';

// Horizon de matérialisation : on ne crée des missions que pour les départs
// d'aujourd'hui jusqu'à J+90 (au-delà, les calendriers évoluent encore trop).
const HORIZON_DAYS = 90;

// Heure de ménage par défaut quand le départ ne porte pas d'heure (cas iCal courant).
const DEFAULT_CHECKOUT_TIME = '11:00';

// Date du jour au fuseau Europe/Paris (YYYY-MM-DD).
function parisToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Classe un évènement iCal : réservation réelle vs blocage de calendrier.
// Airbnb/Booking exportent les indisponibilités comme « Not available / Blocked /
// Closed » — celles-ci ne doivent JAMAIS générer de mission de ménage.
function classifyEvent(ev: ICalEvent): 'confirmed' | 'cancelled' | 'blocked' {
  if (ev.status === 'CANCELLED') return 'cancelled';
  const s = (ev.summary ?? '').toLowerCase();
  if (/not available|unavailable|blocked|closed|not avail/.test(s)) return 'blocked';
  return 'confirmed';
}

export interface FeedSyncResult {
  feedId: string;
  ok: boolean;
  imported: number;     // réservations créées ou mises à jour
  cancelled: number;    // réservations disparues du flux → annulées
  error?: string;
}

// ── ÉTAPE 1 : importer un flux ────────────────────────────────────────────────
export async function syncFeed(feed: {
  id: string; airbnb_id: string; partner_id: string | null;
  platform: string; ical_url: string;
}): Promise<FeedSyncResult> {
  const db = getSupabaseAdmin();
  const today = parisToday();

  try {
    const url = feed.ical_url.replace(/^webcal:\/\//i, 'https://');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let text: string;
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'MonCleanerPro/1.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      text = await res.text();
    } finally {
      clearTimeout(timer);
    }

    const events = parseICal(text);
    const seenUids = new Set<string>();
    let imported = 0;

    for (const ev of events) {
      const status = classifyEvent(ev);
      seenUids.add(ev.uid);

      const row = {
        feed_id: feed.id,
        airbnb_id: feed.airbnb_id,
        partner_id: feed.partner_id,
        platform: feed.platform,
        external_uid: ev.uid,
        guest_name: ev.summary ?? null,
        status,
        check_in: ev.start,
        check_out: ev.end,
        check_in_time: ev.startTime ?? null,
        check_out_time: ev.endTime ?? null,
        raw: ev as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      };

      // Upsert par (feed_id, external_uid). On NE touche pas mission_id : une
      // mission déjà créée reste rattachée même si la réservation est ré-importée.
      const { error } = await db
        .from('reservations')
        .upsert(row, { onConflict: 'feed_id,external_uid' });
      if (error) { console.error('upsert reservation:', error.message); continue; }
      imported++;
    }

    // Réservations futures encore « confirmed » mais absentes du flux → annulées.
    const { data: existing } = await db
      .from('reservations')
      .select('id, external_uid, mission_id')
      .eq('feed_id', feed.id)
      .eq('status', 'confirmed')
      .gte('check_out', today);

    let cancelled = 0;
    for (const r of existing ?? []) {
      if (seenUids.has(r.external_uid)) continue;
      await db.from('reservations').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', r.id);
      cancelled++;
      // Mission auto encore non assignée → on l'annule pour éviter un ménage fantôme.
      if (r.mission_id) await cancelAutoMissionIfUnassigned(r.mission_id);
    }

    await db.from('reservation_feeds').update({
      last_sync_at: new Date().toISOString(), last_sync_status: 'ok', last_error: null,
    }).eq('id', feed.id);

    return { feedId: feed.id, ok: true, imported, cancelled };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from('reservation_feeds').update({
      last_sync_at: new Date().toISOString(), last_sync_status: 'error', last_error: message,
    }).eq('id', feed.id);
    return { feedId: feed.id, ok: false, imported: 0, cancelled: 0, error: message };
  }
}

// Annule une mission issue d'une synchro UNIQUEMENT si elle est encore « pending »
// (non assignée à un cleaner). Une mission déjà prise en charge n'est pas touchée.
async function cancelAutoMissionIfUnassigned(missionId: string) {
  const db = getSupabaseAdmin();
  const { data: m } = await db.from('missions').select('status, auto_synced').eq('id', missionId).single();
  if (m && m.auto_synced && m.status === 'pending') {
    await db.from('missions').update({ status: 'cancelled' }).eq('id', missionId);
  }
}

// ── ÉTAPE 2 : transformer les départs en missions de ménage ──────────────────
export interface MaterializeResult {
  created: number;
  details: { reservationId: string; missionId: string; airbnbId: string; date: string }[];
}

export async function materializeMissions(): Promise<MaterializeResult> {
  const db = getSupabaseAdmin();
  const today = parisToday();
  const horizon = addDays(today, HORIZON_DAYS);

  // Départs confirmés, dans l'horizon, sans mission encore créée.
  const { data: departures } = await db
    .from('reservations')
    .select('id, airbnb_id, partner_id, check_out, check_out_time')
    .eq('status', 'confirmed')
    .is('mission_id', null)
    .gte('check_out', today)
    .lte('check_out', horizon)
    .order('check_out');

  const result: MaterializeResult = { created: 0, details: [] };
  if (!departures || departures.length === 0) return result;

  // Cache des fiches appartement (durée, prix, partenaire).
  const aptCache = new Map<string, { partner_id: string | null; client_price: number; estimated_cleaning_minutes: number }>();
  async function getApt(id: string) {
    if (aptCache.has(id)) return aptCache.get(id)!;
    const { data } = await db.from('airbnbs')
      .select('partner_id, client_price, estimated_cleaning_minutes').eq('id', id).single();
    const apt = {
      partner_id: data?.partner_id ?? null,
      client_price: data?.client_price != null ? Number(data.client_price) : 0,
      estimated_cleaning_minutes: data?.estimated_cleaning_minutes != null ? Number(data.estimated_cleaning_minutes) : 60,
    };
    aptCache.set(id, apt);
    return apt;
  }

  for (const dep of departures) {
    const apt = await getApt(dep.airbnb_id);
    const minutes = apt.estimated_cleaning_minutes;

    // Prochaine arrivée au même appartement (turnover) : la 1re réservation
    // confirmée dont l'arrivée est >= au départ courant. Si elle tombe le jour
    // même → turnover jour J (l'alerte rouge existante s'affiche automatiquement).
    const { data: nextRes } = await db
      .from('reservations')
      .select('check_in, check_in_time')
      .eq('airbnb_id', dep.airbnb_id)
      .eq('status', 'confirmed')
      .gte('check_in', dep.check_out)
      .order('check_in')
      .limit(1);
    const next = nextRes?.[0];

    const { data: mission, error } = await db.from('missions').insert({
      type: 'checkout',
      source: 'airbnb',
      partner_id: apt.partner_id,
      created_by: null,
      created_by_role: 'system',
      airbnb_id: dep.airbnb_id,
      date_from: dep.check_out,
      time_from: dep.check_out_time || DEFAULT_CHECKOUT_TIME,
      hours_worked: Math.round((minutes / 60) * 100) / 100,
      mission_duration_minutes: minutes,
      apartment_default_duration_snapshot: minutes,
      price: apt.client_price,
      cleaner_gain: 0,
      next_arrival: next?.check_in || null,
      next_arrival_time: next?.check_in_time || null,
      status: 'pending',
      auto_synced: true,
    }).select('id').single();

    if (error || !mission) { console.error('materialize mission insert:', error?.message); continue; }

    await db.from('reservations').update({
      mission_id: mission.id, mission_created_at: new Date().toISOString(),
    }).eq('id', dep.id);

    // Notifie les admins (réutilise le canal « mission créée par un partenaire »).
    await notifyPartnerCreatedMission('La synchronisation automatique', dep.check_out, DEFAULT_CHECKOUT_TIME, mission.id);

    result.created++;
    result.details.push({ reservationId: dep.id, missionId: mission.id, airbnbId: dep.airbnb_id, date: dep.check_out });
  }

  return result;
}

// ── Orchestration ─────────────────────────────────────────────────────────────
// Synchronise un ensemble de flux puis matérialise les missions. `feedFilter`
// permet de cibler un partenaire (bouton « Synchroniser maintenant ») ou un flux.
export async function runReservationSync(feedFilter?: { partnerId?: string; feedId?: string }): Promise<{
  feeds: FeedSyncResult[]; materialized: MaterializeResult;
}> {
  const db = getSupabaseAdmin();
  let query = db.from('reservation_feeds')
    .select('id, airbnb_id, partner_id, platform, ical_url')
    .eq('active', true);
  if (feedFilter?.feedId) query = query.eq('id', feedFilter.feedId);
  else if (feedFilter?.partnerId) query = query.eq('partner_id', feedFilter.partnerId);

  const { data: feeds } = await query;
  const results: FeedSyncResult[] = [];
  for (const f of feeds ?? []) {
    results.push(await syncFeed(f as Parameters<typeof syncFeed>[0]));
  }

  // La matérialisation balaie toutes les réservations en attente (idempotente).
  const materialized = await materializeMissions();
  return { feeds: results, materialized };
}
