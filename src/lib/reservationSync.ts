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

import * as Sentry from '@sentry/nextjs';
import { getSupabaseAdmin } from './supabaseAdmin';
import { parseICal, type ICalEvent } from './ical';
import { fetchSmoobuReservations } from './pms/smoobu';
import { notifyPartnerCreatedMission, notifyAdminsSync } from './notifications';

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
function classifyEvent(ev: ICalEvent, inGroup = false): 'confirmed' | 'cancelled' | 'blocked' {
  if (ev.status === 'CANCELLED') return 'cancelled';
  const s = (ev.summary ?? '').toLowerCase();
  if (/not available|unavailable|blocked|closed|not avail/.test(s)) return 'blocked';
  // Marqueur de « réservation croisée » : le PMS bloque les annonces sœurs d'une
  // même maison (annonce entière ⇄ chambres) quand l'une d'elles est réservée.
  //   SUMMARY:reserved
  //   DESCRIPTION:reserved by hostaway cross reservations: 64245633,63913169
  // Ce n'est pas une réservation de plus : c'est l'ombre de celle d'à côté. On ne
  // l'ignore QUE si le logement est rattaché à un groupe — sinon la vraie
  // réservation n'est sur aucun calendrier connecté et on perdrait le ménage.
  if (inGroup && /cross reservations?/i.test(ev.description ?? '')) return 'blocked';
  return 'confirmed';
}

// ── Maisons à annonces multiples ──────────────────────────────────────────────
// Une maison peut être commercialisée sous plusieurs annonces : l'annonce
// « maison entière » et une annonce par chambre. Elles partagent le même bien
// physique, donc le même déplacement de ménage.
//   • `parent_airbnb_id` (chambre → annonce maison entière) porte le lien.
//   • Tant que la migration n'est pas passée, ou qu'aucun lien n'est renseigné,
//     tout se comporte exactement comme avant (logements indépendants).
interface PropertyGroup {
  parentId: string;                                   // annonce « maison entière »
  units: { id: string; name: string }[];              // les chambres
}

// Cache par exécution : la synchro balaie beaucoup de flux, inutile de relire.
let groupCache: Map<string, PropertyGroup> | null = null;

// Construit la table « id de logement → groupe ». Renvoie une table VIDE si la
// colonne n'existe pas encore (migration non jouée) : aucun regroupement, donc
// aucun changement de comportement.
async function loadPropertyGroups(): Promise<Map<string, PropertyGroup>> {
  if (groupCache) return groupCache;
  const db = getSupabaseAdmin();
  const map = new Map<string, PropertyGroup>();
  const { data, error } = await db.from('airbnbs').select('id, name, parent_airbnb_id');
  if (error) {
    // Colonne absente (42703) → on log une fois et on continue sans regroupement.
    console.warn('loadPropertyGroups (regroupement desactive):', error.message);
    groupCache = map;
    return map;
  }
  const children = (data ?? []).filter((a: any) => a.parent_airbnb_id);
  const byParent = new Map<string, { id: string; name: string }[]>();
  for (const c of children) {
    const list = byParent.get(c.parent_airbnb_id) ?? [];
    list.push({ id: c.id, name: c.name });
    byParent.set(c.parent_airbnb_id, list);
  }
  for (const [parentId, units] of byParent) {
    const group: PropertyGroup = { parentId, units };
    map.set(parentId, group);
    for (const u of units) map.set(u.id, group);
  }
  groupCache = map;
  return map;
}

async function isInPropertyGroup(airbnbId: string): Promise<boolean> {
  return (await loadPropertyGroups()).has(airbnbId);
}

// ── Sources d'un flux ─────────────────────────────────────────────────────────

/** Lien iCal public : la voie universelle, mais des DATES seulement. */
async function fetchFromIcal(icalUrl: string | null): Promise<ICalEvent[]> {
  if (!icalUrl) throw new Error('Aucun lien iCal sur ce flux.');
  const url = icalUrl.replace(/^webcal:\/\//i, 'https://');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'MonCleanerPro/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseICal(await res.text());
  } finally {
    clearTimeout(timer);
  }
}

/**
 * API du PMS de la conciergerie. Horizon identique à l'iCal (90 jours) : au-delà,
 * les réservations bougent trop pour qu'un ménage planifié ait du sens.
 */
async function fetchFromPms(
  feed: { platform: string; api_key?: string | null; api_secret?: string | null; external_property_id?: string | null },
  today: string,
): Promise<ICalEvent[]> {
  if (!feed.api_key || !feed.api_secret || !feed.external_property_id) {
    throw new Error('Connexion API incomplète (clé, secret ou logement manquant).');
  }
  if (feed.platform !== 'smoobu') {
    throw new Error(`Connexion API non prise en charge pour ${feed.platform}.`);
  }
  return fetchSmoobuReservations(
    { apiKey: feed.api_key, apiSecret: feed.api_secret },
    feed.external_property_id,
    { from: today, to: addDays(today, 90) },
  );
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
  platform: string; ical_url: string | null; last_sync_status?: string | null;
  connection_kind?: string | null;
  api_key?: string | null; api_secret?: string | null; external_property_id?: string | null;
}): Promise<FeedSyncResult> {
  const db = getSupabaseAdmin();
  const today = parisToday();

  try {
    // Deux sources possibles, une seule suite : le connecteur PMS renvoie la même
    // forme d'évènements que le parseur iCal, donc rien d'autre ne change ici.
    // L'API apporte en plus les heures d'arrivée/départ (départ tardif, arrivée
    // anticipée) et le nombre de voyageurs, que l'iCal ne transporte pas.
    const events = feed.connection_kind === 'api'
      ? await fetchFromPms(feed, today)
      : await fetchFromIcal(feed.ical_url);
    const seenUids = new Set<string>();
    let imported = 0;

    // Le logement fait-il partie d'une maison à annonces multiples ? Détermine si
    // les marqueurs de réservation croisée peuvent être ignorés sans rien perdre.
    const inGroup = await isInPropertyGroup(feed.airbnb_id);

    // État précédent (pour détecter un changement de date de départ sur une
    // réservation déjà transformée en mission).
    const { data: prevRows } = await db
      .from('reservations')
      .select('external_uid, check_out, check_out_time, mission_id')
      .eq('feed_id', feed.id);
    const prev = new Map<string, { check_out: string; check_out_time: string | null; mission_id: string | null }>(
      (prevRows ?? []).map((r: any) => [r.external_uid, { check_out: r.check_out, check_out_time: r.check_out_time, mission_id: r.mission_id }]),
    );

    for (const ev of events) {
      const status = classifyEvent(ev, inGroup);
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

      // FIX #1 — changement de date de départ après création de la mission.
      if (status === 'confirmed') {
        const before = prev.get(ev.uid);
        if (before?.mission_id && (before.check_out !== ev.end || (before.check_out_time ?? null) !== (ev.endTime ?? null))) {
          await applyReservationDateChange(before.mission_id, ev.end, ev.endTime ?? null);
        }
      }
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
      // Mission auto liée : annulée si non assignée, sinon l'admin est alerté.
      if (r.mission_id) await handleCancelledReservationMission(r.mission_id);
    }

    await db.from('reservation_feeds').update({
      last_sync_at: new Date().toISOString(), last_sync_status: 'ok', last_error: null,
    }).eq('id', feed.id);

    return { feedId: feed.id, ok: true, imported, cancelled };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    // FIX #2 — panne de synchro : toujours capturée dans Sentry ; l'admin n'est
    // prévenu qu'à la 1re bascule ok→error (évite le spam à chaque cron).
    Sentry.captureException(e, { tags: { area: 'reservation-sync', feedId: feed.id } });
    if (feed.last_sync_status !== 'error') {
      await notifyAdminsSync('Synchronisation en panne',
        `Un calendrier (${feed.platform}) ne se synchronise plus : ${message}. Des ménages risquent de ne plus se créer automatiquement.`);
    }
    await db.from('reservation_feeds').update({
      last_sync_at: new Date().toISOString(), last_sync_status: 'error', last_error: message,
    }).eq('id', feed.id);
    return { feedId: feed.id, ok: false, imported: 0, cancelled: 0, error: message };
  }
}

// FIX #3 — réservation annulée. Mission auto non assignée → on l'annule (pas de
// ménage fantôme). Mission déjà assignée à un cleaner → on n'y touche pas mais on
// ALERTE l'admin (sinon le cleaner se déplace pour rien).
async function handleCancelledReservationMission(missionId: string) {
  const db = getSupabaseAdmin();

  // ⚠️ Une mission peut servir PLUSIEURS réservations : le garde-fou anti-doublon
  // rattache au même ménage tous les départs d'un logement à une même date (deux
  // calendriers pour un même bien, ou marqueurs « reserved » de Hostaway qui
  // apparaissent et disparaissent au fil de ses recalculs). Annuler la mission dès
  // qu'UNE de ces réservations disparaît supprimait un ménage pourtant dû : trois
  // ménages du lendemain ont ainsi été annulés à tort en production.
  // On ne l'annule donc que s'il ne reste PLUS AUCUNE réservation confirmée liée.
  // L'appelant a déjà basculé la réservation courante en 'cancelled' avant d'appeler
  // cette fonction : elle n'est donc pas comptée ici.
  const { count } = await db.from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('mission_id', missionId)
    .eq('status', 'confirmed');
  if ((count ?? 0) > 0) return;

  const { data: m } = await db.from('missions')
    .select('status, auto_synced, cleaner_name, airbnbs(name)').eq('id', missionId).single();
  if (!m || !m.auto_synced) return;
  if (m.status === 'pending') {
    await db.from('missions').update({ status: 'cancelled' }).eq('id', missionId);
  } else if (m.status !== 'cancelled' && m.status !== 'done') {
    const place = (m as any).airbnbs?.name ?? 'un logement';
    await notifyAdminsSync('Réservation annulée — mission assignée',
      `La réservation de ${place} a été annulée, mais la mission est assignée à ${m.cleaner_name ?? 'un cleaner'}. Pense à annuler la mission et à prévenir.`, missionId);
  }
}

// FIX #1 — le départ d'une réservation déjà matérialisée a changé. Mission non
// assignée → on la déplace à la nouvelle date. Mission assignée → on alerte l'admin
// (on ne bouge jamais en douce le planning d'un cleaner).
async function applyReservationDateChange(missionId: string, newDate: string, newTime: string | null) {
  const db = getSupabaseAdmin();
  const { data: m } = await db.from('missions')
    .select('status, auto_synced, airbnbs(name)').eq('id', missionId).single();
  if (!m || !m.auto_synced) return;

  // Mission partagée par plusieurs réservations (cf. handleCancelledReservationMission) :
  // la déplacer priverait les autres départs de leur ménage. On alerte plutôt.
  const { count } = await db.from('reservations')
    .select('id', { count: 'exact', head: true })
    .eq('mission_id', missionId)
    .eq('status', 'confirmed');
  if ((count ?? 0) > 1) {
    const place = (m as any).airbnbs?.name ?? 'un logement';
    await notifyAdminsSync('Changement de date — ménage partagé',
      `Le départ de ${place} a changé (nouveau départ : ${newDate}), mais ce ménage couvre plusieurs réservations. Vérifie le planning à la main.`, missionId);
    return;
  }

  if (m.status === 'pending') {
    await db.from('missions').update({
      date_from: newDate, time_from: newTime || DEFAULT_CHECKOUT_TIME,
    }).eq('id', missionId);
  } else if (m.status !== 'cancelled' && m.status !== 'done') {
    const place = (m as any).airbnbs?.name ?? 'un logement';
    await notifyAdminsSync('Changement de date — mission assignée',
      `Le départ de ${place} a changé (nouveau départ : ${newDate}). La mission est déjà assignée — vérifie le planning du cleaner.`, missionId);
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
  // `group_tiers` : forfait selon le NOMBRE de chambres à faire, porté par
  // l'annonce maison entière. Les espaces communs sont refaits à chaque passage,
  // quel que soit le nombre de chambres — le prix ne s'additionne donc pas
  // chambre par chambre (ex. Anse : 1 ch. 55 €, 2 ch. 60 €, maison 75 €).
  type Tier = { price?: number; minutes?: number };
  const aptCache = new Map<string, { partner_id: string | null; client_price: number; estimated_cleaning_minutes: number; group_tiers: Record<string, Tier> | null }>();
  async function getApt(id: string) {
    if (aptCache.has(id)) return aptCache.get(id)!;
    const { data } = await db.from('airbnbs')
      .select('partner_id, client_price, estimated_cleaning_minutes, group_tiers').eq('id', id).single();
    const apt = {
      partner_id: data?.partner_id ?? null,
      client_price: data?.client_price != null ? Number(data.client_price) : 0,
      estimated_cleaning_minutes: data?.estimated_cleaning_minutes != null ? Number(data.estimated_cleaning_minutes) : 60,
      group_tiers: (data as { group_tiers?: Record<string, Tier> } | null)?.group_tiers ?? null,
    };
    aptCache.set(id, apt);
    return apt;
  }

  // ── Regroupement par BIEN PHYSIQUE + date ───────────────────────────────────
  // Une maison à annonces multiples (entière + chambres) ne représente qu'UN
  // déplacement : tous les départs d'un même bien à une même date tombent dans le
  // même paquet et donneront UNE mission, portée par l'annonce « maison entière ».
  // Sans groupe défini, chaque paquet ne contient qu'un logement → comportement
  // identique à avant.
  type Departure = { id: string; airbnb_id: string; partner_id: string | null; check_out: string; check_out_time: string | null };
  type Bucket = { key: string; date: string; group?: PropertyGroup; deps: Departure[] };
  const groups = await loadPropertyGroups();
  const buckets = new Map<string, Bucket>();
  for (const dep of departures as Departure[]) {
    const group = groups.get(dep.airbnb_id);
    const key = group ? group.parentId : dep.airbnb_id;
    const id = `${key}|${dep.check_out}`;
    const b: Bucket = buckets.get(id) ?? { key, date: dep.check_out, group, deps: [] };
    b.deps.push(dep);
    buckets.set(id, b);
  }

  for (const bucket of buckets.values()) {
    const { key: targetAirbnbId, date, group, deps } = bucket;
    const first = deps[0];

    // Garde-fou anti-doublon : si un ménage auto existe déjà pour CE bien à CETTE
    // date (logement avec 2 calendriers exportant le même séjour sous deux UID,
    // ou chambres d'une même maison), on ne recrée pas — on rattache.
    const { data: dup } = await db
      .from('missions')
      .select('id')
      .eq('airbnb_id', targetAirbnbId)
      .eq('date_from', date)
      .eq('auto_synced', true)
      .neq('status', 'cancelled')
      .limit(1);
    if (dup && dup.length > 0) {
      for (const d of deps) {
        await db.from('reservations')
          .update({ mission_id: dup[0].id, mission_created_at: new Date().toISOString() })
          .eq('id', d.id);
      }
      continue;
    }

    // Quoi faire ce jour-là ? Maison entière si l'annonce entière se libère, ou si
    // TOUTES les chambres partent le même jour (règle métier : 3 chambres sur 3 =
    // la maison entière, facturée comme telle).
    const departingIds = new Set(deps.map(d => d.airbnb_id));
    const departingRooms = group ? group.units.filter(u => departingIds.has(u.id)) : [];
    const wholeProperty = !group
      || departingIds.has(group.parentId)
      || departingRooms.length >= group.units.length;

    // Durée et prix : maison entière → ceux de l'annonce entière ; sinon somme des
    // chambres concernées (les communs sont inclus dans le tarif chambre).
    let minutes: number, price: number, partnerId: string | null;
    const parentApt = await getApt(targetAirbnbId);
    // Nombre de chambres à faire : la maison entière compte pour toutes.
    const roomCount = wholeProperty ? (group?.units.length ?? 1) : departingRooms.length;
    const tier = group ? parentApt.group_tiers?.[String(roomCount)] : undefined;

    if (tier) {
      // Forfait par palier (communs inclus à chaque passage).
      price = tier.price ?? parentApt.client_price;
      minutes = tier.minutes ?? parentApt.estimated_cleaning_minutes;
      partnerId = parentApt.partner_id;
    } else if (wholeProperty) {
      minutes = parentApt.estimated_cleaning_minutes; price = parentApt.client_price; partnerId = parentApt.partner_id;
    } else {
      // Pas de palier défini → ancien calcul : somme des chambres concernées.
      minutes = 0; price = 0; partnerId = null;
      for (const u of departingRooms) {
        const a = await getApt(u.id);
        minutes += a.estimated_cleaning_minutes; price += a.client_price;
        partnerId = partnerId ?? a.partner_id;
      }
      if (partnerId === null) partnerId = parentApt.partner_id;
    }

    // Prochaine arrivée sur le bien (turnover) — toutes annonces confondues.
    const scope = group ? [group.parentId, ...group.units.map(u => u.id)] : [targetAirbnbId];
    const { data: nextRes } = await db
      .from('reservations')
      .select('check_in, check_in_time')
      .in('airbnb_id', scope)
      .eq('status', 'confirmed')
      .gte('check_in', date)
      .order('check_in')
      .limit(1);
    const next = nextRes?.[0];

    // `covered_units` / `whole_property` n'existent qu'une fois la migration jouée.
    // On ne les envoie donc que pour un bien groupé — preuve que la colonne existe.
    // `covered_unit_names` porte la liste brute des chambres (toutes si la maison
    // entière est à faire) : elle sert au rapport de fin de mission pour demander
    // au cleaner DANS QUELLE chambre il a constaté un dégât ou trouvé un objet.
    const groupFields = group
      ? {
          covered_units: wholeProperty
            ? 'Maison entière'
            : departingRooms.map(u => u.name).join(' + ') + ' + communs',
          whole_property: wholeProperty,
          covered_unit_names: (wholeProperty ? group.units : departingRooms).map(u => u.name),
        }
      : {};

    const { data: mission, error } = await db.from('missions').insert({
      type: 'checkout',
      source: 'airbnb',
      partner_id: partnerId,
      created_by: null,
      created_by_role: 'system',
      airbnb_id: targetAirbnbId,
      date_from: date,
      time_from: first.check_out_time || DEFAULT_CHECKOUT_TIME,
      hours_worked: Math.round((minutes / 60) * 100) / 100,
      mission_duration_minutes: minutes,
      apartment_default_duration_snapshot: minutes,
      price,
      cleaner_gain: 0,
      next_arrival: next?.check_in || null,
      next_arrival_time: next?.check_in_time || null,
      status: 'pending',
      auto_synced: true,
      ...groupFields,
    }).select('id').single();

    if (error || !mission) { console.error('materialize mission insert:', error?.message); continue; }

    for (const d of deps) {
      await db.from('reservations').update({
        mission_id: mission.id, mission_created_at: new Date().toISOString(),
      }).eq('id', d.id);
    }

    // Notifie les admins (réutilise le canal « mission créée par un partenaire »).
    await notifyPartnerCreatedMission('La synchronisation automatique', date, DEFAULT_CHECKOUT_TIME, mission.id);

    result.created++;
    result.details.push({ reservationId: first.id, missionId: mission.id, airbnbId: targetAirbnbId, date });
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
  groupCache = null;   // relit les rattachements à chaque exécution
  // Les identifiants API ne sont lus QUE côté serveur (service_role), ici et
  // nulle part ailleurs — cf. FEED_SELECT dans db/reservations.ts pour le client.
  let query = db.from('reservation_feeds')
    .select('id, airbnb_id, partner_id, platform, ical_url, last_sync_status, '
      + 'connection_kind, api_key, api_secret, external_property_id')
    .eq('active', true);
  if (feedFilter?.feedId) query = query.eq('id', feedFilter.feedId);
  else if (feedFilter?.partnerId) query = query.eq('partner_id', feedFilter.partnerId);

  const { data: feeds } = await query;
  const results: FeedSyncResult[] = [];
  for (const f of feeds ?? []) {
    results.push(await syncFeed(f as unknown as Parameters<typeof syncFeed>[0]));
  }

  // La matérialisation balaie toutes les réservations en attente (idempotente).
  const materialized = await materializeMissions();
  return { feeds: results, materialized };
}
