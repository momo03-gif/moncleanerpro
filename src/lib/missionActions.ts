import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionUser } from './sessionToken';
import type { MissionService, MissionStatus } from './types';
import { computeMissionGain, computeCleanerGain, billableHotelPrice } from './pay';
import { canCleanerDoService } from './service';
import {
  distanceMeters, TRACKING_TOLERANCE_METERS, PROXIMITY_ERROR, ADDRESS_PROXIMITY_ERROR,
  GPS_REQUIRED_ERROR, type GeoPoint,
} from './geo';
import {
  notifyPartnerCreatedMission, notifyCleanerNewMission, notifyMissionModified, notifyMissionCancelled,
  notifyMissionCompleted, notifyMissionWithdrawn, notifyExtraTimeRequested, notifyExtraTimeResolved,
  notifyAdminsMissionRequested, notifyCleanerRequestDecision,
} from './notificationEvents';
import { logementsDuPartenaire, filtrePartenaire } from './missionRead';

// ══════════════════════════════════════════════════════════════════════════════
//  Écritures sur `missions`, côté SERVEUR (service_role).
//
//  Jusqu'ici, la plupart de ces écritures partaient du navigateur avec la clé
//  publique, et faisaient confiance à l'identité qu'il annonçait (`userId`,
//  `actor`). N'importe qui pouvant lire cette clé dans le site pouvait donc
//  démarrer, clôturer, réassigner ou réécrire une mission.
//
//  Ici, l'identité vient de la SESSION signée — jamais du corps de la requête —
//  et chaque action vérifie le rôle et le lien avec la mission. Les messages
//  d'erreur sont repris À L'IDENTIQUE des anciennes fonctions : la file
//  hors-ligne du cleaner les reconnaît pour savoir si elle doit retenter.
//
//  Les notifications partent d'ici, après succès (cf. notificationEvents.ts) :
//  l'auteur est celui de la session, et elles ne dépendent plus du téléphone.
// ══════════════════════════════════════════════════════════════════════════════

export type Corps = Record<string, unknown>;
export type Reponse = { status: number; body: Record<string, unknown> };

const ok = (body: Record<string, unknown> = {}): Reponse => ({ status: 200, body: { ok: true, ...body } });
const ko = (error: string, status = 400, extra: Record<string, unknown> = {}): Reponse => ({ status, body: { error, ...extra } });

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const heures = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

function parisToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

/** Point GPS valide, ou null. */
function point(v: unknown): GeoPoint | null {
  const p = v as { lat?: unknown; lng?: unknown } | null;
  const lat = num(p?.lat), lng = num(p?.lng);
  return lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/**
 * Horodatage d'une action capturée hors-ligne puis rejouée. On garde l'heure
 * réelle du geste, mais jamais une heure future ni vieille de plus de 7 jours :
 * l'heure de fin pilote la paie, elle ne se choisit pas librement.
 */
function horodatage(v: unknown): string {
  const now = Date.now();
  const t = typeof v === 'string' ? Date.parse(v) : NaN;
  if (!Number.isFinite(t) || t > now + 5 * 60_000 || t < now - 7 * 24 * 3_600_000) return new Date(now).toISOString();
  return new Date(t).toISOString();
}

const STATUT_DB: Record<MissionStatus, string> = {
  pending: 'pending', accepted: 'assigned', in_progress: 'inprogress', completed: 'done', cancelled: 'cancelled',
};

async function idCleaner(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await db.from('cleaners').select('id').eq('user_id', userId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function taux(db: SupabaseClient, cleanerId: string): Promise<{ rate: number; deliveryRate: number }> {
  const { data } = await db.from('cleaners').select('hourly_rate, delivery_rate').eq('id', cleanerId).maybeSingle();
  return { rate: Number(data?.hourly_rate) || 0, deliveryRate: Number(data?.delivery_rate) || 0 };
}

// ── Argent : durée → paie, et clôture d'une mission d'hôtel ──────────────────

/**
 * Change la durée (et/ou le prix client) d'une mission et recalcule le gain du
 * cleaner à partir du taux EN BASE. Partagé par l'action 'set-duration', la
 * modification d'une mission et l'approbation d'un temps supplémentaire.
 */
export async function appliquerDuree(
  db: SupabaseClient, missionId: string,
  o: { minutes?: number | null; aptDefault?: number | null; price?: number | null },
): Promise<{ error: string | null; minutes: number | null }> {
  const minutes = o.minutes != null ? Math.max(0, Math.round(o.minutes)) : null;
  const { data: m } = await db.from('missions').select('service, cleaner_id').eq('id', missionId).maybeSingle();
  if (!m) return { error: 'Mission introuvable.', minutes };

  const patch: Record<string, unknown> = {};
  if (minutes != null) {
    patch.mission_duration_minutes = minutes;
    patch.hours_worked = heures(minutes);
  }
  if (o.aptDefault != null) patch.apartment_default_duration_snapshot = o.aptDefault;
  if (o.price != null) patch.price = Math.max(0, o.price);

  if (minutes != null && m.cleaner_id) {
    const { rate, deliveryRate } = await taux(db, m.cleaner_id as string);
    patch.cleaner_gain = computeMissionGain({
      service: m.service as MissionService | undefined, hourlyRate: rate, deliveryRate, durationMinutes: minutes,
    });
    patch.cleaner_hourly_rate_snapshot = rate;
  }
  if (Object.keys(patch).length === 0) return { error: null, minutes };
  const { error } = await db.from('missions').update(patch).eq('id', missionId);
  if (error) { console.error('appliquerDuree:', error.message); return { error: 'Enregistrement impossible.', minutes }; }
  return { error: null, minutes };
}

/**
 * Fin de mission d'hôtel : la paie suit le TEMPS RÉEL pointé, la facture le
 * MAX(temps accordé, temps réel).
 */
export async function cloturerArgent(db: SupabaseClient, missionId: string, actualMinutes: number): Promise<{ error: string | null }> {
  const { data: m } = await db.from('missions')
    .select('source, service, price, mission_duration_minutes, cleaner_hourly_rate_snapshot')
    .eq('id', missionId).maybeSingle();
  if (!m) return { error: 'Mission introuvable.' };

  const mins = Math.max(0, Math.round(actualMinutes));
  const svc = (m.service ?? 'cleaning') as string;
  const planned = Number(m.mission_duration_minutes) || 0;
  const patch: Record<string, unknown> = {};
  const rate = Number(m.cleaner_hourly_rate_snapshot) || 0;
  if (m.source === 'hotel' && svc === 'cleaning' && rate > 0) patch.cleaner_gain = computeCleanerGain(rate, mins);
  const basePrice = Number(m.price) || 0;
  if (m.source === 'hotel' && planned > 0 && basePrice > 0) patch.price = billableHotelPrice(basePrice, planned, mins);
  if (Object.keys(patch).length === 0) return { error: null };

  const { error } = await db.from('missions').update(patch).eq('id', missionId);
  if (error) { console.error('cloturerArgent:', error.message); return { error: 'Enregistrement impossible.' }; }
  return { error: null };
}

/** Coordonnées de l'adresse d'une mission : portées par la mission, sinon par le site lié. */
function adresseMission(row: Record<string, unknown>): GeoPoint | null {
  if (row.address_lat != null && row.address_lng != null) {
    return { lat: Number(row.address_lat), lng: Number(row.address_lng) };
  }
  const apt = row.airbnbs as { latitude?: number | null; longitude?: number | null } | null;
  return apt && apt.latitude != null && apt.longitude != null
    ? { lat: Number(apt.latitude), lng: Number(apt.longitude) } : null;
}

// ── Les actions ──────────────────────────────────────────────────────────────

type Action = (db: SupabaseClient, s: SessionUser, b: Corps) => Promise<Reponse>;

const reserveAdmin = ko('Réservé à l’administration.', 403);

const ACTIONS: Record<string, Action> = {

  // ── Cleaner : pointage et vie de SA mission ────────────────────────────────

  async start(db, s, b) {
    const missionId = str(b.missionId);
    if (!missionId) return ko('Mission manquante.');
    const cleanerId = await idCleaner(db, s.id);
    if (!cleanerId) return ko('Cleaner introuvable.', 403);

    // GPS OBLIGATOIRE pour le ménage : à moins de 200 m de l'adresse. Contrôlé
    // ICI : dans le navigateur, il se contournait.
    const { data: m } = await db.from('missions')
      .select('service, address_lat, address_lng, airbnbs(latitude, longitude)').eq('id', missionId).maybeSingle();
    const coords = point(b.coords);
    const addr = m ? adresseMission(m as Record<string, unknown>) : null;
    if (m?.service !== 'delivery' && addr) {
      if (!coords) return ko(GPS_REQUIRED_ERROR);
      if (distanceMeters(addr, coords) > TRACKING_TOLERANCE_METERS) return ko(ADDRESS_PROXIMITY_ERROR, 400, { tooFar: true });
    }

    const patch: Record<string, unknown> = { status: 'inprogress', started_at: horodatage(b.at) };
    if (coords) { patch.start_lat = coords.lat; patch.start_lng = coords.lng; }
    const { data, error } = await db.from('missions').update(patch)
      .eq('id', missionId).eq('cleaner_id', cleanerId)
      .not('status', 'in', '(done,cancelled)').select('id');
    if (error) { console.error('missions/start:', error.message); return ko('Enregistrement impossible.', 500); }
    if (!data || data.length === 0) return ko('Action impossible sur cette mission.');
    return ok();
  },

  async deliver(db, s, b) {
    const missionId = str(b.missionId);
    if (!missionId) return ko('Mission manquante.');
    const cleanerId = await idCleaner(db, s.id);
    if (!cleanerId) return ko('Cleaner introuvable.', 403);
    const { data, error } = await db.from('missions')
      .update({ status: 'done', ended_at: horodatage(b.at) })
      .eq('id', missionId).eq('cleaner_id', cleanerId)
      .not('status', 'in', '(done,cancelled)').select('id');
    if (error) { console.error('missions/deliver:', error.message); return ko('Enregistrement impossible.', 500); }
    if (!data || data.length === 0) return ko('Action impossible sur cette mission.');
    await notifyMissionCompleted(missionId);
    return ok();
  },

  async finish(db, s, b) {
    const missionId = str(b.missionId);
    if (!missionId) return ko('Mission manquante.');
    const cleanerId = await idCleaner(db, s.id);
    if (!cleanerId) return ko('Cleaner introuvable.', 403);

    const { data: m } = await db.from('missions')
      .select('started_at, start_lat, start_lng, cleaner_id, status, service, address_lat, address_lng, airbnbs(latitude, longitude)')
      .eq('id', missionId).maybeSingle();
    if (!m || m.cleaner_id !== cleanerId) return ko('Mission introuvable.');
    if (m.status === 'done' || m.status === 'cancelled') return ko('Mission déjà clôturée.');

    // Contrôle GPS (ménage) : contre l'adresse, à défaut début ↔ fin.
    const coords = point(b.coords);
    if (m.service !== 'delivery') {
      const addr = adresseMission(m as Record<string, unknown>);
      if (addr) {
        if (!coords) return ko(GPS_REQUIRED_ERROR);
        if (distanceMeters(addr, coords) > TRACKING_TOLERANCE_METERS) return ko(ADDRESS_PROXIMITY_ERROR, 400, { tooFar: true });
      } else if (coords && m.start_lat != null && m.start_lng != null) {
        const d = distanceMeters({ lat: Number(m.start_lat), lng: Number(m.start_lng) }, coords);
        if (d > TRACKING_TOLERANCE_METERS) return ko(PROXIMITY_ERROR, 400, { tooFar: true });
      }
    }

    const fin = horodatage(b.at);
    const patch: Record<string, unknown> = { status: 'done', ended_at: fin };
    let minutesReelles: number | null = null;
    if (m.started_at) {
      minutesReelles = Math.max(0, Math.round((Date.parse(fin) - Date.parse(m.started_at as string)) / 60000));
      patch.actual_duration_minutes = minutesReelles;
    }
    if (coords) { patch.end_lat = coords.lat; patch.end_lng = coords.lng; }

    const { data, error } = await db.from('missions').update(patch)
      .eq('id', missionId).not('status', 'in', '(done,cancelled)').select('id');
    if (error) { console.error('missions/finish:', error.message); return ko('Enregistrement impossible.', 500); }
    if (!data || data.length === 0) return ko('Mission déjà clôturée.');

    await notifyMissionCompleted(missionId);
    // Les montants. Un échec ne remet pas en cause la clôture : le cleaner est parti.
    if (minutesReelles != null) {
      const r = await cloturerArgent(db, missionId, minutesReelles);
      if (r.error) return ok({ argent: r.error });
    }
    return ok();
  },

  async withdraw(db, s, b) {
    const missionId = str(b.missionId);
    if (!missionId) return ko('Mission manquante.');
    const cleanerId = await idCleaner(db, s.id);
    if (!cleanerId) return ko('Cleaner introuvable.', 403);
    const { data: avant } = await db.from('missions').select('cleaner_name').eq('id', missionId).maybeSingle();
    const { data, error } = await db.from('missions')
      .update({ status: 'pending', cleaner_id: null, cleaner_name: null })
      .eq('id', missionId).eq('cleaner_id', cleanerId)
      .not('status', 'in', '(done,cancelled)').select('id');
    if (error) { console.error('missions/withdraw:', error.message); return ko('Enregistrement impossible.', 500); }
    if (!data || data.length === 0) return ko('Désistement impossible sur cette mission.');
    await notifyMissionWithdrawn(missionId, (avant?.cleaner_name as string | null) ?? null);
    return ok();
  },

  async 'extra-time-request'(db, s, b) {
    const missionId = str(b.missionId);
    const minutes = Math.max(0, Math.round(num(b.minutes) ?? 0));
    if (!missionId) return ko('Mission manquante.');
    if (minutes <= 0) return ko('Durée supplémentaire invalide.');
    const cleanerId = await idCleaner(db, s.id);
    if (!cleanerId) return ko('Cleaner introuvable.', 403);
    const { data, error } = await db.from('missions').update({
      extra_time_minutes: minutes,
      extra_time_reason: str(b.reason) ?? null,
      extra_time_status: 'pending',
      extra_time_requested_at: horodatage(b.at),
    }).eq('id', missionId).eq('cleaner_id', cleanerId)
      .not('status', 'in', '(done,cancelled)').select('id');
    if (error) { console.error('missions/extra-time-request:', error.message); return ko('Enregistrement impossible.', 500); }
    if (!data || data.length === 0) return ko('Demande impossible sur cette mission.');
    await notifyExtraTimeRequested(missionId, minutes);
    return ok({ minutes });
  },

  // Le cleaner DEMANDE une mission ouverte ; l'admin tranche.
  async request(db, s, b) {
    const missionId = str(b.missionId);
    if (!missionId) return ko('Mission manquante.');
    const { data: c } = await db.from('cleaners')
      .select('id, name, can_clean, can_deliver').eq('user_id', s.id).maybeSingle();
    if (!c) return ko('Cleaner introuvable.', 403);

    const { data: m } = await db.from('missions')
      .select('service, status, pending_cleaner_id, pending_cleaner_name').eq('id', missionId).maybeSingle();
    if (!m) return ko('Cette mission n’est plus disponible.');
    if (!canCleanerDoService(c, ((m.service as MissionService) ?? 'cleaning'))) {
      return ko("Cette mission requiert une prestation que tu n'effectues pas.");
    }
    const { data: bloquantes } = await db.from('formation_assignments').select('id')
      .eq('cleaner_id', c.id).eq('obligatoire', true).eq('statut', 'a_faire').limit(1);
    if ((bloquantes ?? []).length > 0) return ko('Termine ta formation obligatoire pour débloquer tes missions.');
    if (m.status !== 'pending') return ko('Cette mission n’est plus disponible.');
    if (m.pending_cleaner_id && m.pending_cleaner_id !== c.id) {
      return ko(`Déjà demandée par ${m.pending_cleaner_name ?? 'un autre cleaner'}.`);
    }
    // Premier arrivé, premier servi : la garde est rejouée à l'écriture.
    const { data, error } = await db.from('missions').update({
      pending_cleaner_id: c.id, pending_cleaner_name: c.name, pending_requested_at: new Date().toISOString(),
    }).eq('id', missionId).eq('status', 'pending')
      .or(`pending_cleaner_id.is.null,pending_cleaner_id.eq.${c.id}`).select('id');
    if (error) { console.error('missions/request:', error.message); return ko('Enregistrement impossible.', 500); }
    if (!data || data.length === 0) return ko('Cette mission n’est plus disponible.');
    await notifyAdminsMissionRequested(missionId, c.name as string);
    return ok();
  },

  // ── Conciergerie (partenaire Airbnb) ───────────────────────────────────────

  async 'create-airbnb'(db, s, b) {
    if (s.role !== 'airbnb') return ko('Réservé aux conciergeries.', 403);
    const airbnbId = str(b.airbnbId), dateFrom = str(b.dateFrom);
    if (!airbnbId || !dateFrom) return ko('Logement ou date manquant.');
    // Le logement doit être le SIEN ; prix et durée viennent de la fiche, pas du navigateur.
    const { data: apt } = await db.from('airbnbs')
      .select('partner_id, client_price, estimated_cleaning_minutes').eq('id', airbnbId).maybeSingle();
    if (!apt || apt.partner_id !== s.id) return ko('Logement introuvable.', 403);
    const minutes = apt.estimated_cleaning_minutes != null ? Number(apt.estimated_cleaning_minutes) : 60;

    const { data, error } = await db.from('missions').insert({
      type: 'regular', source: 'airbnb',
      partner_id: s.id, created_by: s.id, created_by_role: 'airbnb',
      airbnb_id: airbnbId, date_from: dateFrom,
      time_from: str(b.timeFrom) ?? null,
      instructions: str(b.instructions) ?? null,
      price: Number(apt.client_price) || 0,
      mission_duration_minutes: minutes, apartment_default_duration_snapshot: minutes,
      next_arrival: str(b.nextArrival) ?? null, next_arrival_time: str(b.nextArrivalTime) ?? null,
      status: 'pending',
    }).select('id').single();
    if (error) { console.error('missions/create-airbnb:', error.message); return ko('Création impossible.', 500); }
    await notifyPartnerCreatedMission(s.name || 'Un partenaire Airbnb', dateFrom, str(b.timeFrom) ?? '', data?.id ?? null);
    return ok({ id: data?.id });
  },

  async rate(db, s, b) {
    const missionId = str(b.missionId);
    const rating = num(b.rating);
    if (!missionId) return ko('Mission manquante.');
    if (rating == null || !Number.isInteger(rating) || rating < 1 || rating > 5) return ko('Note attendue entre 1 et 5.');
    const { data, error } = await db.from('missions').update({
      partner_rating: rating,
      partner_rating_comment: str(b.comment)?.trim() || null,
      partner_rated_at: new Date().toISOString(),
    }).eq('id', missionId).or(await filtrePartenaire(db, s.id)).select('id');
    if (error) { console.error('missions/rate:', error.message); return ko('Enregistrement impossible.', 500); }
    if (!data || data.length === 0) return ko('Mission introuvable.', 403);
    return ok();
  },

  // Modification : l'admin, ou le créateur de la mission (champs opérationnels seulement).
  async update(db, s, b) {
    const missionId = str(b.missionId);
    const f = (b.fields ?? {}) as Record<string, unknown>;
    if (!missionId) return ko('Mission manquante.');
    const { data: row } = await db.from('missions')
      .select('id, status, partner_id, airbnb_id, created_by, cleaner_id, service, mission_duration_minutes, apartment_default_duration_snapshot')
      .eq('id', missionId).maybeSingle();
    if (!row) return ko('Mission introuvable.', 404);

    const estAdmin = s.role === 'admin';
    const clos = row.status === 'done' || row.status === 'cancelled';
    if (clos && !estAdmin) {
      return ko(`Cette mission est ${row.status === 'done' ? 'terminée' : 'annulée'} et ne peut plus être modifiée.`);
    }
    const surSonLogement = s.role === 'airbnb' && !!row.airbnb_id
      && (await logementsDuPartenaire(db, s.id)).includes(row.airbnb_id as string);
    if (!estAdmin && row.created_by !== s.id && row.partner_id !== s.id && !surSonLogement) {
      return ko("Vous n'êtes pas autorisé à modifier cette mission.", 403);
    }

    const has = (k: string) => Object.prototype.hasOwnProperty.call(f, k);
    const txt = (k: string) => (typeof f[k] === 'string' ? (f[k] as string) : null);
    const patch: Record<string, unknown> = {};
    if (has('dateFrom') && txt('dateFrom')) patch.date_from = txt('dateFrom');
    if (has('timeFrom')) patch.time_from = txt('timeFrom') || null;
    if (has('type') && txt('type')) patch.type = txt('type');
    if (has('service') && txt('service')) patch.service = txt('service');
    if (has('deliveryInstructions')) patch.delivery_instructions = txt('deliveryInstructions') || null;
    if (has('propertyName')) patch.property_name = txt('propertyName');
    if (has('address')) patch.address = txt('address');
    if (has('instructions')) patch.instructions = txt('instructions') || null;
    if (has('nextArrival')) patch.next_arrival = txt('nextArrival') || null;
    if (has('nextArrivalTime')) patch.next_arrival_time = txt('nextArrivalTime') || null;
    if (has('airbnbId')) {
      const aid = txt('airbnbId') || null;
      // Un partenaire ne peut rattacher la mission qu'à un de SES logements.
      if (aid && !estAdmin) {
        const { data: apt } = await db.from('airbnbs').select('partner_id').eq('id', aid).maybeSingle();
        if (!apt || apt.partner_id !== s.id) return ko('Logement introuvable.', 403);
      }
      patch.airbnb_id = aid;
    }

    let paie: { minutes?: number; aptDefault?: number | null; price?: number } | null = null;
    // Champs réservés à l'admin — ignorés en silence sinon.
    if (estAdmin) {
      if (has('cleanerId')) {
        patch.cleaner_id = txt('cleanerId') || null;
        patch.cleaner_name = txt('cleanerName');
      }
      if (has('price')) paie = { ...(paie ?? {}), price: Number(f.price) || 0 };
      if (has('status') && txt('status')) {
        const st = STATUT_DB[txt('status') as MissionStatus];
        if (st) patch.status = st;
      }
      const touchePaie = has('cleanerId') || has('airbnbId') || has('missionDurationMinutes') || has('service');
      if (touchePaie) {
        let aptDefault: number | null = row.apartment_default_duration_snapshot != null
          ? Number(row.apartment_default_duration_snapshot) : null;
        if (patch.airbnb_id) {
          const { data: apt } = await db.from('airbnbs')
            .select('estimated_cleaning_minutes').eq('id', patch.airbnb_id as string).maybeSingle();
          if (apt?.estimated_cleaning_minutes != null) aptDefault = Number(apt.estimated_cleaning_minutes);
        }
        const minutes = has('missionDurationMinutes')
          ? Number(f.missionDurationMinutes) || 0
          : (row.mission_duration_minutes != null ? Number(row.mission_duration_minutes) : (aptDefault ?? 60));
        paie = { ...(paie ?? {}), minutes, aptDefault };
      }
    }

    if (Object.keys(patch).length > 0) {
      // Garde atomique : une mission clôturée ne se modifie pas ici, même par
      // l'admin (il la rouvre d'abord) — comportement repris tel quel.
      const { data, error } = await db.from('missions').update(patch)
        .eq('id', missionId).not('status', 'in', '(done,cancelled)').select('id');
      if (error) { console.error('missions/update:', error.message); return ko('Enregistrement impossible.', 500); }
      if (!data || data.length === 0) return ko('Cette mission est clôturée et ne peut plus être modifiée.');
    } else if (!paie) {
      return ok({ rien: true });
    }
    // La paie, après l'enregistrement : le nouveau cleaner est en base.
    let argent: string | null = null;
    if (paie) argent = (await appliquerDuree(db, missionId, paie)).error;
    await notifyMissionModified(missionId, s.role, s.id);
    return ok(argent ? { argent } : {});
  },

  // ── Administration ─────────────────────────────────────────────────────────

  async reorder(db, s, b) {
    if (s.role !== 'admin') return reserveAdmin;
    const orders = Array.isArray(b.orders) ? b.orders as { id?: unknown; order?: unknown }[] : [];
    const propres = orders.filter(o => str(o.id) && num(o.order) != null);
    if (propres.length === 0 || propres.length > 200) return ko('Ordre invalide.');
    const res = await Promise.all(propres.map(o =>
      db.from('missions').update({ manual_order: Math.round(o.order as number) }).eq('id', o.id as string)));
    const echec = res.find(r => r.error);
    if (echec?.error) { console.error('missions/reorder:', echec.error.message); return ko('Enregistrement impossible.', 500); }
    return ok();
  },

  async 'set-status'(db, s, b) {
    if (s.role !== 'admin') return reserveAdmin;
    const missionId = str(b.missionId);
    const st = STATUT_DB[str(b.status) as MissionStatus];
    if (!missionId || !st) return ko('Mission ou statut manquant.');
    const { error } = await db.from('missions').update({ status: st }).eq('id', missionId);
    if (error) { console.error('missions/set-status:', error.message); return ko('Enregistrement impossible.', 500); }
    if (st === 'cancelled') await notifyMissionCancelled(missionId, s.role, s.id);
    else if (st === 'done') await notifyMissionCompleted(missionId);
    return ok();
  },

  async reopen(db, s, b) {
    if (s.role !== 'admin') return ko("Action réservée à l'administrateur.", 403);
    const missionId = str(b.missionId);
    if (!missionId) return ko('Mission manquante.');
    const { error } = await db.from('missions')
      .update({ status: 'inprogress', ended_at: null, actual_duration_minutes: null }).eq('id', missionId);
    if (error) { console.error('missions/reopen:', error.message); return ko('Enregistrement impossible.', 500); }
    return ok();
  },

  async 'decide-request'(db, s, b) {
    if (s.role !== 'admin') return reserveAdmin;
    const missionId = str(b.missionId);
    if (!missionId) return ko('Mission manquante.');
    const { data: m } = await db.from('missions')
      .select('pending_cleaner_id, pending_cleaner_name').eq('id', missionId).maybeSingle();
    if (!m?.pending_cleaner_id) return ko('Aucune demande sur cette mission.');
    const patch: Record<string, unknown> = { pending_cleaner_id: null, pending_cleaner_name: null, pending_requested_at: null };
    if (b.approve === true) {
      patch.cleaner_id = m.pending_cleaner_id;
      patch.cleaner_name = m.pending_cleaner_name;
      patch.status = 'assigned';
    }
    const { error } = await db.from('missions').update(patch).eq('id', missionId);
    if (error) { console.error('missions/decide-request:', error.message); return ko('Enregistrement impossible.', 500); }
    await notifyCleanerRequestDecision(missionId, m.pending_cleaner_id as string, b.approve === true);
    return ok();
  },

  async 'extra-time-resolve'(db, s, b) {
    if (s.role !== 'admin') return ko("Action réservée à l'administrateur.", 403);
    const missionId = str(b.missionId);
    if (!missionId) return ko('Mission manquante.');
    const { data: m } = await db.from('missions')
      .select('mission_duration_minutes, extra_time_minutes, extra_time_status').eq('id', missionId).maybeSingle();
    if (!m) return ko('Mission introuvable.', 404);
    if (m.extra_time_status !== 'pending') return ko('Aucune demande en attente.');
    if (b.approve === true) {
      const extra = Math.max(0, Math.round(Number(m.extra_time_minutes) || 0));
      const r = await appliquerDuree(db, missionId, { minutes: (Number(m.mission_duration_minutes) || 0) + extra });
      if (r.error) return ko(r.error, 500);
    }
    const { error } = await db.from('missions')
      .update({ extra_time_status: b.approve === true ? 'approved' : 'refused' }).eq('id', missionId);
    if (error) { console.error('missions/extra-time-resolve:', error.message); return ko('Enregistrement impossible.', 500); }
    await notifyExtraTimeResolved(missionId, b.approve === true);
    return ok();
  },

  async 'add-time'(db, s, b) {
    if (s.role !== 'admin') return ko("Action réservée à l'administrateur.", 403);
    const missionId = str(b.missionId);
    const delta = Math.round(num(b.delta) ?? 0);
    if (!missionId) return ko('Mission manquante.');
    if (delta === 0) return ko('Indiquez un nombre de minutes.');
    const { data: m } = await db.from('missions').select('mission_duration_minutes').eq('id', missionId).maybeSingle();
    if (!m) return ko('Mission introuvable.', 404);
    const r = await appliquerDuree(db, missionId, { minutes: Math.max(0, (Number(m.mission_duration_minutes) || 0) + delta) });
    return r.error ? ko(r.error, 500) : ok();
  },

  // Création d'une mission par l'admin. Le gain est calculé avec le taux EN BASE.
  async create(db, s, b) {
    if (s.role !== 'admin') return reserveAdmin;
    const f = (b.fields ?? {}) as Record<string, unknown>;
    const dateFrom = str(f.dateFrom);
    if (!dateFrom) return ko('Date manquante.');
    const cleanerId = str(f.cleanerId) ?? null;
    const linked = !!str(f.airbnbId);
    const service = (str(f.service) ?? 'cleaning') as MissionService;
    const minutes = Math.max(0, Number(f.missionDurationMinutes) || 0);
    const { rate, deliveryRate } = cleanerId ? await taux(db, cleanerId) : { rate: 0, deliveryRate: 0 };
    const gain = cleanerId ? computeMissionGain({ service, hourlyRate: rate, deliveryRate, durationMinutes: minutes }) : 0;
    const coveredUnits = str(f.coveredUnits);
    // Mission sur un logement : le client est le PROPRIÉTAIRE du logement, pas
    // ce que dit le formulaire.
    let partnerId = str(f.partnerId) ?? null;
    if (linked) {
      const { data: apt } = await db.from('airbnbs').select('partner_id').eq('id', str(f.airbnbId)!).maybeSingle();
      partnerId = (apt?.partner_id as string | null) ?? null;
    }

    const { data, error } = await db.from('missions').insert({
      type: str(f.type) ?? 'regular',
      source: str(f.source) ?? 'hotel',
      service,
      delivery_instructions: str(f.deliveryInstructions) ?? null,
      airbnb_id: str(f.airbnbId) ?? null,
      partner_id: partnerId,
      created_by: s.id,
      created_by_role: 'admin',
      property_name: linked ? null : (str(f.propertyName) ?? null),
      address: linked ? null : (str(f.address) ?? null),
      address_lat: num(f.addressLat) ?? null,
      address_lng: num(f.addressLng) ?? null,
      date_from: dateFrom,
      time_from: str(f.timeFrom) ?? null,
      time_to: str(f.timeTo) ?? null,
      hours_worked: heures(minutes),
      mission_duration_minutes: minutes,
      cleaner_id: cleanerId,
      cleaner_name: cleanerId ? (str(f.cleanerName) ?? null) : null,
      client_name: str(f.clientName) ?? null,
      price: Math.max(0, Number(f.price) || 0),
      cleaner_gain: gain,
      cleaner_hourly_rate_snapshot: cleanerId ? rate : null,
      apartment_default_duration_snapshot: num(f.apartmentDefaultDuration) ?? null,
      instructions: str(f.instructions) ?? null,
      next_arrival: str(f.nextArrival) ?? null,
      next_arrival_time: str(f.nextArrivalTime) ?? null,
      ...(coveredUnits ? {
        covered_units: coveredUnits,
        whole_property: f.wholeProperty === true,
        covered_unit_names: Array.isArray(f.coveredUnitNames) ? f.coveredUnitNames : null,
      } : {}),
      status: cleanerId ? 'assigned' : 'pending',
    }).select('id').single();
    if (error) { console.error('missions/create:', error.message); return ko(error.message, 500); }
    if (cleanerId && data?.id) await notifyCleanerNewMission(data.id as string);
    return ok({ id: data?.id });
  },

  async 'create-oneshot'(db, s, b) {
    if (s.role !== 'admin') return reserveAdmin;
    const f = (b.fields ?? {}) as Record<string, unknown>;
    const date = str(f.date), propertyName = str(f.propertyName);
    if (!date || !propertyName) return ko('Date ou lieu manquant.');
    const minutes = Math.max(0, Number(f.durationMinutes) || 0);
    const price = Math.max(0, Number(f.price) || 0);
    const liste = (Array.isArray(f.cleaners) ? f.cleaners : [])
      .map(c => ({ id: str((c as Corps).id), name: str((c as Corps).name) }))
      .filter((c): c is { id: string; name: string | undefined } => !!c.id);
    const groupId = liste.length > 1 ? crypto.randomUUID() : null;

    const base = {
      type: str(f.type) ?? 'deep_clean', source: str(f.source) ?? 'hotel', service: 'cleaning',
      property_name: propertyName, address: str(f.address) ?? null,
      address_lat: num(f.addressLat) ?? null, address_lng: num(f.addressLng) ?? null,
      date_from: date, time_from: str(f.time) ?? null, instructions: str(f.instructions) ?? null,
      mission_duration_minutes: minutes, hours_worked: heures(minutes),
      apartment_default_duration_snapshot: minutes,
      created_by: s.id, created_by_role: 'admin', group_id: groupId,
    };
    let rows: Record<string, unknown>[];
    if (liste.length === 0) {
      rows = [{ ...base, cleaner_id: null, cleaner_name: null, price, cleaner_gain: 0, status: 'pending' }];
    } else {
      rows = [];
      for (const [i, c] of liste.entries()) {
        const { rate } = await taux(db, c.id);
        rows.push({
          ...base, cleaner_id: c.id, cleaner_name: c.name ?? null,
          // Prix client porté par UNE seule ligne : le CA ne compte qu'une fois.
          price: i === 0 ? price : 0,
          cleaner_gain: computeCleanerGain(rate, minutes),
          cleaner_hourly_rate_snapshot: rate,
          status: 'assigned',
        });
      }
    }
    const { data, error } = await db.from('missions').insert(rows).select('id');
    if (error) { console.error('missions/create-oneshot:', error.message); return ko(error.message, 500); }
    if (liste.length > 0) for (const r of data ?? []) await notifyCleanerNewMission(r.id as string);
    return ok({ ids: (data ?? []).map(r => r.id) });
  },

  async 'create-batch'(db, s, b) {
    if (s.role !== 'admin') return reserveAdmin;
    const f = (b.fields ?? {}) as Record<string, unknown>;
    const apts = Array.isArray(f.apartments) ? f.apartments as Corps[] : [];
    const dateFrom = str(f.dateFrom);
    if (apts.length === 0) return ko('Aucun appartement sélectionné.');
    if (!dateFrom) return ko('Date manquante.');
    const cleanerId = str(f.cleanerId) ?? null;
    const { rate } = cleanerId ? await taux(db, cleanerId) : { rate: 0 };
    const aptIds = apts.map(a => str(a.airbnbId)).filter((x): x is string => !!x);
    const { data: proprios } = await db.from('airbnbs').select('id, partner_id').in('id', aptIds);
    const proprioDe = new Map((proprios ?? []).map(a => [a.id as string, (a.partner_id as string | null) ?? null]));

    const rows = apts.filter(a => str(a.airbnbId)).map(a => {
      const minutes = Math.max(0, Number(a.durationMinutes) || 0);
      return {
        type: 'regular', source: 'airbnb', airbnb_id: str(a.airbnbId),
        partner_id: proprioDe.get(str(a.airbnbId) ?? '') ?? null,
        created_by: s.id, created_by_role: 'admin', property_name: null, address: null,
        date_from: dateFrom, time_from: str(f.timeFrom) ?? null, time_to: null,
        hours_worked: heures(minutes), mission_duration_minutes: minutes,
        cleaner_id: cleanerId, cleaner_name: cleanerId ? (str(f.cleanerName) ?? null) : null,
        price: Math.max(0, Number(a.price) || 0),
        cleaner_gain: cleanerId ? computeCleanerGain(rate, minutes) : 0,
        cleaner_hourly_rate_snapshot: cleanerId ? rate : null,
        apartment_default_duration_snapshot: num(a.defaultDuration) ?? null,
        status: cleanerId ? 'assigned' : 'pending',
      };
    });
    const { data, error } = await db.from('missions').insert(rows).select('id');
    if (error) { console.error('missions/create-batch:', error.message); return ko(error.message, 500); }
    if (cleanerId) for (const r of data ?? []) await notifyCleanerNewMission(r.id as string);
    return ok({ ids: (data ?? []).map(r => r.id) });
  },

  async 'create-appointment'(db, s, b) {
    if (s.role !== 'admin') return reserveAdmin;
    const f = (b.fields ?? {}) as Record<string, unknown>;
    const title = str(f.title), date = str(f.date);
    if (!title || !date) return ko('Titre ou date manquant.');
    const assigneeId = str(f.assigneeId);
    const estCleaner = f.assigneeRole === 'cleaner';
    const cleanerId = assigneeId && estCleaner ? assigneeId : null;
    const assigneeUserId = assigneeId && !estCleaner ? assigneeId : null;
    const { data, error } = await db.from('missions').insert({
      type: 'appointment', source: 'hotel', service: 'appointment',
      property_name: title, address: null, date_from: date, time_from: str(f.time) ?? null,
      instructions: str(f.description) ?? null,
      price: 0, cleaner_gain: 0, mission_duration_minutes: 0, hours_worked: 0,
      cleaner_id: cleanerId, cleaner_name: cleanerId ? (str(f.assigneeName) ?? null) : null,
      assignee_user_id: assigneeUserId,
      assignee_name: assigneeUserId ? (str(f.assigneeName) ?? null) : null,
      assignee_role: assigneeUserId ? (str(f.assigneeRole) ?? 'admin') : null,
      created_by: s.id, created_by_role: 'admin',
      status: assigneeId ? 'assigned' : 'pending',
    }).select('id').single();
    if (error) { console.error('missions/create-appointment:', error.message); return ko(error.message, 500); }
    if (cleanerId && data?.id) await notifyCleanerNewMission(data.id as string);
    return ok({ id: data?.id });
  },

  // Réapplique les forfaits d'une maison partagée aux ménages À VENIR non assignés.
  async 'recalc-group'(db, s, b) {
    if (s.role !== 'admin') return reserveAdmin;
    const houseId = str(b.houseId);
    if (!houseId) return ko('Logement manquant.');
    const { data: house } = await db.from('airbnbs')
      .select('group_tiers, client_price, estimated_cleaning_minutes').eq('id', houseId).maybeSingle();
    const tiers = house?.group_tiers as Record<string, { price?: number; minutes?: number }> | null;
    if (!tiers) return ok({ updated: 0, skipped: 0 });
    const { data: rooms } = await db.from('airbnbs').select('id').eq('parent_airbnb_id', houseId);
    const total = (rooms ?? []).length;
    if (total === 0) return ok({ updated: 0, skipped: 0 });

    const { data: missions } = await db.from('missions')
      .select('id, covered_unit_names, whole_property, cleaner_id, price, mission_duration_minutes')
      .eq('airbnb_id', houseId).gte('date_from', parisToday()).neq('status', 'cancelled').neq('status', 'done');
    let updated = 0, skipped = 0;
    for (const m of missions ?? []) {
      // Une mission déjà assignée garde sa durée : elle pilote la paie du cleaner.
      if (m.cleaner_id) { skipped++; continue; }
      const count = m.whole_property
        ? total
        : Math.min(Math.max((m.covered_unit_names as string[] | null)?.length ?? total, 1), total);
      const t = tiers[String(count)];
      if (!t) continue;
      const price = t.price ?? (Number(house?.client_price) || 0);
      const minutes = t.minutes ?? (Number(house?.estimated_cleaning_minutes) || 60);
      if (Number(m.price) === price && Number(m.mission_duration_minutes) === minutes) continue;
      const { error } = await db.from('missions').update({
        price, mission_duration_minutes: minutes, hours_worked: heures(minutes),
      }).eq('id', m.id);
      if (!error) updated++;
    }
    return ok({ updated, skipped });
  },
};

/** Exécute une action connue ; null si l'action n'existe pas ici. */
export async function executerActionMission(
  db: SupabaseClient, session: SessionUser, b: Corps,
): Promise<Reponse | null> {
  const action = typeof b.action === 'string' ? ACTIONS[b.action] : undefined;
  if (!action) return null;
  return action(db, session, b);
}
