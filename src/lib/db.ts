import { supabase } from './supabase';
import type { User, Mission, MissionStatus, MissionType, MissionSource, MissionService, HotelAnnounce, Apartment, Payment, CompanyInfo, InvoiceLine, InvoiceRecord, Role, ReservationFeed, Reservation } from './types';
import { computeCleanerGain, computeMissionGain, billableHotelPrice } from './pay';
import { canCleanerDoService } from './service';
import { clusterApartments } from './zones';
import { getBlockingFormationsDB } from './formation';
import { distanceMeters, TRACKING_TOLERANCE_METERS, PROXIMITY_ERROR, ADDRESS_PROXIMITY_ERROR, GPS_REQUIRED_ERROR, type GeoPoint } from './geo';
import {
  notifyPartnerCreatedMission, notifyCleanerNewMission, notifyMissionModified,
  notifyMissionCancelled, notifyMissionCompleted, notifyMissionWithdrawn,
  notifyExtraTimeRequested, notifyExtraTimeResolved,
} from './notifications';
import { postServer, getServer, trimTime } from './db/shared';
import { getActiveCleanersDB } from './db/cleaners';

// Domaines extraits dans des modules dédiés — mêmes exports, appelants inchangés.
export * from './db/cleaners';
export * from './db/airbnbs';
export * from './db/partners';
export * from './db/billing';
export * from './db/reservations';
export * from './db/stats';

// ── VERROUILLAGE DES MISSIONS ───────────────────────────────────────────────
// Une mission terminée ou annulée est verrouillée : plus aucune modification ni
// suppression possible (donnée de référence pour le suivi et la facturation).

export type MissionActor = { id: string; role: Role };

// Statuts (app) verrouillés. Côté DB : 'done' et 'cancelled'.
export function isMissionLocked(status: MissionStatus): boolean {
  return status === 'completed' || status === 'cancelled';
}

// Message explicite renvoyé quand une action est refusée.
export function missionLockMessage(status: MissionStatus, action: 'modifier' | 'supprimer'): string {
  const state = status === 'completed' ? 'terminée' : 'annulée';
  const verb = action === 'supprimer' ? 'supprimée' : 'modifiée';
  return `Cette mission est ${state} et ne peut plus être ${verb}.`;
}

// ── AUTH ─────────────────────────────────────────────────────────────────────
// L'authentification se fait désormais CÔTÉ SERVEUR via /api/auth/login (vérif du
// mot de passe + session signée). L'ancien loginUser interrogeait la table users
// par hash depuis le navigateur (clé anon) : supprimé pour fermer cette faille.

// ── CLEANERS ──────────────────────────────────────────────────────────────────

// missions.cleaner_id is a FK to cleaners.id (NOT users.id)
// When we only have users.id (e.g. logged-in cleaner), resolve to cleaners.id
async function resolveToCleanerTableId(userId: string): Promise<string | null> {
  const { data } = await supabase.from('cleaners').select('id').eq('user_id', userId).single();
  return data?.id ?? null;
}

// (CLEANERS déplacés dans ./db/cleaners ; AIRBNBS + ZONES dans ./db/airbnbs)

// ── MISSIONS ──────────────────────────────────────────────────────────────────

// (trimTime déplacé dans ./db/shared)

// Sélection commune : on joint l'appartement lié pour les missions Airbnb
// afin d'en récupérer adresse + accès sans dupliquer l'info dans la mission.
const MISSION_SELECT = '*, airbnbs(name, address, code_portail, code_boite, entry_instructions, partner_name, notes, client_price, estimated_cleaning_minutes, zone_id, zone_color, zone_name, structure_type, structure_label)';

function rowToMission(row: any): Mission {
  let property = row.property_name ?? '';
  let address = row.address ?? '';
  let notes: string | undefined = row.instructions ?? undefined;

  // Mission liée à un appartement → source de vérité = la fiche appartement
  const apt = row.airbnbs;
  if (row.airbnb_id && apt) {
    property = apt.name ?? property;
    address = apt.address ?? address;
    const parts: string[] = [];
    if (apt.code_portail) parts.push(`Code portail : ${apt.code_portail}`);
    if (apt.code_boite) parts.push(`Boîte à clé : ${apt.code_boite}`);
    if (apt.entry_instructions) parts.push(apt.entry_instructions);
    if (apt.notes) parts.push(apt.notes); // notes particulières de l'appartement
    if (row.instructions) parts.push(row.instructions); // consignes ajoutées par le partenaire
    notes = parts.length > 0 ? parts.join(' · ') : undefined;
  }

  // Durée de paie : minutes = source de vérité ; heures dérivées pour les agrégations existantes.
  const minutes = row.mission_duration_minutes != null
    ? Number(row.mission_duration_minutes)
    : Math.round((Number(row.hours_worked) || 0) * 60);

  // Prix client :
  //  • LIVRAISON → toujours 0 : jamais facturée au client (coût société uniquement,
  //    = la paie du livreur, comptée en charge). Pas de revenu.
  //  • MÉNAGE lié à un appartement, prix non fixé (0) → dérivé EN DIRECT de la
  //    fiche appartement (comme l'adresse).
  //  • Sinon → valeur stockée (snapshot).
  const storedPrice = Number(row.price) || 0;
  const svc = (row.service ?? 'cleaning') as MissionService;
  // Livraison ET rendez-vous ne sont jamais facturés au client → prix 0.
  const nonBillable = svc === 'delivery' || svc === 'appointment';
  const price = nonBillable
    ? 0
    : (storedPrice === 0 && row.airbnb_id && apt?.client_price != null
        ? Number(apt.client_price) || 0
        : storedPrice);

  return {
    id: row.id,
    property,
    address,
    date: row.date_from ?? '',
    time: trimTime(row.time_from),
    duration: Math.round((minutes / 60) * 100) / 100,
    status: mapMissionStatus(row.status),
    cleanerId: row.cleaner_id,
    cleanerName: row.cleaner_name,
    price,
    cleanerGain: Number(row.cleaner_gain) || 0,
    missionDurationMinutes: minutes,
    coveredUnits: row.covered_units ?? undefined,
    wholeProperty: row.whole_property ?? undefined,
    coveredUnitNames: Array.isArray(row.covered_unit_names) ? row.covered_unit_names : undefined,
    pendingCleanerId: row.pending_cleaner_id ?? undefined,
    pendingCleanerName: row.pending_cleaner_name ?? undefined,
    pendingRequestedAt: row.pending_requested_at ?? undefined,
    cleanerHourlyRateSnapshot: row.cleaner_hourly_rate_snapshot != null ? Number(row.cleaner_hourly_rate_snapshot) : undefined,
    apartmentDefaultDurationSnapshot: row.apartment_default_duration_snapshot != null ? Number(row.apartment_default_duration_snapshot) : undefined,
    // Zone dérivée de l'appartement lié (join), toujours à jour.
    zoneId: apt?.zone_id ?? undefined,
    zoneColor: apt?.zone_color ?? undefined,
    zoneName: apt?.zone_name ?? undefined,
    siteType: apt?.structure_type ?? undefined,
    siteLabel: apt?.structure_label ?? undefined,
    type: (row.type as MissionType) ?? 'regular',
    service: (row.service as MissionService) ?? 'cleaning',
    deliveryInstructions: row.delivery_instructions ?? undefined,
    groupId: row.group_id ?? undefined,
    recurringId: row.recurring_id ?? undefined,
    assigneeUserId: row.assignee_user_id ?? undefined,
    assigneeName: row.assignee_name ?? undefined,
    assigneeRole: row.assignee_role ?? undefined,
    source: (row.source as MissionSource) ?? 'hotel',
    createdBy: row.created_by ?? undefined,
    requestedBy: row.client_name,
    notes,
    instructionsRaw: row.instructions ?? undefined,
    partnerId: row.partner_id ?? undefined,
    partnerName: row.airbnbs?.partner_name ?? undefined,
    airbnbId: row.airbnb_id ?? undefined,
    nextArrival: row.next_arrival ?? undefined,
    nextArrivalTime: row.next_arrival_time ? trimTime(row.next_arrival_time) : undefined,
    createdAt: row.created_at ?? undefined,
    manualOrder: row.manual_order != null ? Number(row.manual_order) : undefined,
    extraTimeMinutes: row.extra_time_minutes != null ? Number(row.extra_time_minutes) : undefined,
    extraTimeReason: row.extra_time_reason ?? undefined,
    extraTimeStatus: row.extra_time_status ?? undefined,
    extraTimeRequestedAt: row.extra_time_requested_at ?? undefined,
    startedAt: row.started_at ?? undefined,
    endedAt: row.ended_at ?? undefined,
    actualDurationMinutes: row.actual_duration_minutes != null ? Number(row.actual_duration_minutes) : undefined,
    startLat: row.start_lat != null ? Number(row.start_lat) : undefined,
    startLng: row.start_lng != null ? Number(row.start_lng) : undefined,
    endLat: row.end_lat != null ? Number(row.end_lat) : undefined,
    endLng: row.end_lng != null ? Number(row.end_lng) : undefined,
  };
}

function mapMissionStatus(s: string): MissionStatus {
  const map: Record<string, MissionStatus> = {
    pending: 'pending',
    assigned: 'accepted',
    inprogress: 'in_progress',
    done: 'completed',
    cancelled: 'cancelled',
  };
  return map[s] ?? 'pending';
}

// `sinceDate` (YYYY-MM-DD) borne aux missions à partir de cette date (le futur est
// toujours inclus). À utiliser pour les vues OPÉRATIONNELLES (tableau de bord,
// planning) qui n'ont pas besoin de tout l'historique — ça évite que la requête
// ralentisse à mesure que les missions s'accumulent. Sans `sinceDate` →
// comportement inchangé (tout l'historique), pour les vues analytiques
// (statistiques, facturation, comptabilité).
export async function getMissionsDB(sinceDate?: string): Promise<Mission[]> {
  let query = supabase.from('missions').select(MISSION_SELECT).order('date_from', { ascending: false });
  if (sinceDate) query = query.gte('date_from', sinceDate);
  const { data, error } = await query;
  if (error) console.error('getMissionsDB error:', error.code, error.message);
  return (data ?? []).map(rowToMission);
}

export async function getMissionsForCleanerDB(userId: string, sinceDate?: string): Promise<Mission[]> {
  // missions.cleaner_id is a FK to cleaners.id — resolve users.id → cleaners.id
  const cleanerTableId = await resolveToCleanerTableId(userId);
  if (!cleanerTableId) return [];
  return getMissionsByCleanerTableIdDB(cleanerTableId, sinceDate);
}

// Missions d'un cleaner identifié par cleaners.id (pas users.id) — utilisé par le
// moteur RH, qui raisonne directement en cleaners.id (= missions.cleaner_id).
// `sinceDate` (YYYY-MM-DD) borne la requête aux missions à partir de cette date
// (les missions futures sont toujours incluses). Sert à alléger le planning
// cleaner : inutile de charger tout l'historique sur un outil mobile quotidien.
// Sans `sinceDate` → comportement inchangé (tout l'historique), pour le moteur RH.
export async function getMissionsByCleanerTableIdDB(cleanerTableId: string, sinceDate?: string): Promise<Mission[]> {
  let query = supabase
    .from('missions')
    .select(MISSION_SELECT)
    .eq('cleaner_id', cleanerTableId)
    .order('date_from', { ascending: false });
  if (sinceDate) query = query.gte('date_from', sinceDate);
  const { data, error } = await query;
  if (error) console.error('getMissionsByCleanerTableIdDB:', error.code, error.message);
  return (data ?? []).map(rowToMission);
}

// Missions d'un partenaire Airbnb (avec compte) — filtrées par partner_id
export async function getMissionsForPartnerDB(userId: string): Promise<Mission[]> {
  const { data, error } = await supabase
    .from('missions')
    .select(MISSION_SELECT)
    .eq('partner_id', userId)
    .order('date_from', { ascending: false });
  if (error) console.error('getMissionsForPartnerDB:', error.code, error.message);
  // Le partenaire ne doit PAS voir les données internes (durée de ménage paramétrée,
  // gain/taux cleaner, pointage GPS) : on les retire avant de renvoyer.
  return (data ?? []).map(rowToMission).map(stripInternalForPartner);
}

// Retire d'une mission les champs réservés à l'usage interne (admin/cleaner) avant
// de l'exposer à un partenaire (hôte). Voir getMissionsForPartnerDB.
function stripInternalForPartner(m: Mission): Mission {
  return {
    ...m,
    missionDurationMinutes: undefined,
    cleanerHourlyRateSnapshot: undefined,
    apartmentDefaultDurationSnapshot: undefined,
    cleanerGain: undefined,
    actualDurationMinutes: undefined,
    startedAt: undefined, endedAt: undefined,
    startLat: undefined, startLng: undefined, endLat: undefined, endLng: undefined,
  };
}

// Missions ouvertes aux cleaners. On exclut celles DÉJÀ demandées par quelqu'un :
// tant que l'admin n'a pas tranché, elles ne doivent plus apparaître comme
// disponibles — sinon deux cleaners croient l'avoir décrochée.
export async function getPendingMissionsDB(): Promise<Mission[]> {
  const { data } = await supabase.from('missions').select(MISSION_SELECT)
    .eq('status', 'pending').is('pending_cleaner_id', null).order('date_from');
  return (data ?? []).map(rowToMission);
}

// Demandes en attente de décision (écran admin).
export async function getMissionRequestsDB(): Promise<Mission[]> {
  const { data } = await supabase.from('missions').select(MISSION_SELECT)
    .not('pending_cleaner_id', 'is', null).order('pending_requested_at');
  return (data ?? []).map(rowToMission);
}

// Création d'une mission par un partenaire Airbnb : liée à un appartement,
// sans cleaner assigné (status 'pending' → « À assigner » côté admin).
export async function createAirbnbMissionDB(fields: {
  partnerId: string; partnerName?: string; airbnbId: string;
  dateFrom: string; timeFrom: string; instructions?: string; price?: number;
  nextArrival?: string; nextArrivalTime?: string;
}): Promise<{ error: string | null }> {
  // Durée de nettoyage par défaut reprise de l'appartement (base du gain cleaner,
  // calculé plus tard à l'assignation d'un cleaner par l'admin).
  const { data: apt } = await supabase
    .from('airbnbs').select('estimated_cleaning_minutes').eq('id', fields.airbnbId).single();
  const defaultMinutes = apt?.estimated_cleaning_minutes != null ? Number(apt.estimated_cleaning_minutes) : 60;

  const { data, error } = await supabase.from('missions').insert({
    type: 'regular',
    source: 'airbnb',
    partner_id: fields.partnerId,
    created_by: fields.partnerId,
    created_by_role: 'airbnb',
    airbnb_id: fields.airbnbId,
    date_from: fields.dateFrom,
    time_from: fields.timeFrom || null,
    instructions: fields.instructions || null,
    price: fields.price ?? 0,  // prix CLIENT repris depuis la fiche appartement (facturation)
    mission_duration_minutes: defaultMinutes,
    apartment_default_duration_snapshot: defaultMinutes,
    next_arrival: fields.nextArrival || null,
    next_arrival_time: fields.nextArrivalTime || null,
    status: 'pending',
  }).select('id').single();
  if (error) {
    console.error('createAirbnbMissionDB error:', error);
    return { error: error.message };
  }
  // Notif admin : nouvelle mission créée par un partenaire
  await notifyPartnerCreatedMission(fields.partnerName ?? 'Un partenaire Airbnb', fields.dateFrom, fields.timeFrom, data?.id);
  return { error: null };
}

export async function acceptMissionDB(missionId: string, userId: string): Promise<{ error: string | null }> {
  // userId is users.id — resolve to cleaners.id (FK constraint)
  const { data: cleanerRow } = await supabase.from('cleaners').select('id, name, can_clean, can_deliver').eq('user_id', userId).single();
  if (!cleanerRow) return { error: 'Cleaner introuvable.' };

  // Garde-fou prestation : le cleaner doit savoir réaliser le service de la mission
  // (nettoyage et/ou livraison). Empêche un « nettoyage seul » de prendre une livraison.
  const { data: missionRow } = await supabase.from('missions').select('service').eq('id', missionId).single();
  if (!canCleanerDoService(cleanerRow, (missionRow?.service as MissionService) ?? 'cleaning')) {
    return { error: "Cette mission requiert une prestation que tu n'effectues pas." };
  }

  // Blocage formation (LOT 7bis) : une formation obligatoire « à faire » empêche
  // d'accepter une nouvelle mission tant qu'elle n'est pas terminée.
  const blocking = await getBlockingFormationsDB(cleanerRow.id);
  if (blocking.length > 0) {
    return { error: 'Termine ta formation obligatoire pour débloquer tes missions.' };
  }

  // Le cleaner ne s'assigne PLUS la mission : il la demande, l'admin valide.
  // La mission reste en 'pending' — on ne détourne aucun statut existant.
  // Premier arrivé, premier servi : si quelqu'un a déjà demandé, on refuse la
  // seconde demande plutôt que de l'écraser en silence.
  const { data: current } = await supabase.from('missions')
    .select('pending_cleaner_id, pending_cleaner_name, status').eq('id', missionId).single();
  if (current?.status !== 'pending') return { error: 'Cette mission n’est plus disponible.' };
  if (current?.pending_cleaner_id && current.pending_cleaner_id !== cleanerRow.id) {
    return { error: `Déjà demandée par ${current.pending_cleaner_name ?? 'un autre cleaner'}.` };
  }

  const { error } = await supabase.from('missions').update({
    pending_cleaner_id: cleanerRow.id,
    pending_cleaner_name: cleanerRow.name,
    pending_requested_at: new Date().toISOString(),
  }).eq('id', missionId);
  if (!error) {
    try {
      const { notifyAdminsMissionRequested } = await import('./notifications');
      await notifyAdminsMissionRequested(missionId, cleanerRow.name);
    } catch (e) { console.error('notify mission requested:', e); }
  }
  return { error: error?.message ?? null };
}

// Décision de l'admin sur une demande de mission.
export async function decideMissionRequestDB(missionId: string, approve: boolean): Promise<{ error: string | null }> {
  const { data: m } = await supabase.from('missions')
    .select('pending_cleaner_id, pending_cleaner_name').eq('id', missionId).single();
  if (!m?.pending_cleaner_id) return { error: 'Aucune demande sur cette mission.' };

  const patch: Record<string, unknown> = {
    pending_cleaner_id: null, pending_cleaner_name: null, pending_requested_at: null,
  };
  if (approve) {
    patch.cleaner_id = m.pending_cleaner_id;
    patch.cleaner_name = m.pending_cleaner_name;
    patch.status = 'assigned';
  }
  const { error } = await supabase.from('missions').update(patch).eq('id', missionId);
  if (!error) {
    try {
      const { notifyCleanerRequestDecision } = await import('./notifications');
      await notifyCleanerRequestDecision(missionId, m.pending_cleaner_id as string, approve);
    } catch (e) { console.error('notify request decision:', e); }
  }
  return { error: error?.message ?? null };
}

export async function createMissionDB(fields: {
  type: string; source: string; propertyName: string; address: string;
  dateFrom: string; timeTo: string; timeFrom: string;
  missionDurationMinutes: number; cleanerHourlyRate?: number; cleanerDeliveryRate?: number; apartmentDefaultDuration?: number;
  cleanerId?: string; cleanerName?: string; clientName?: string;
  price: number; instructions?: string;
  airbnbId?: string; partnerId?: string;
  nextArrival?: string; nextArrivalTime?: string;
  service?: MissionService; deliveryInstructions?: string;
  addressLat?: number; addressLng?: number;
  createdBy?: string; createdByRole?: string;
}): Promise<{ error: string | null }> {
  // cleanerId from the form is already cleaners.id (from the cleaner dropdown)
  const cleanerIdToStore: string | null = fields.cleanerId || null;
  // Quand la mission est liée à un appartement, on ne duplique pas
  // nom/adresse : ils sont récupérés depuis la fiche appartement (join).
  const linked = !!fields.airbnbId;

  // Paiement cleaner selon la prestation : ménage = taux horaire × durée / 60 ;
  // livraison = montant fixe par livraison (indépendant du prix client).
  const minutes = Number(fields.missionDurationMinutes) || 0;
  const rate = Number(fields.cleanerHourlyRate) || 0;
  const deliveryRate = Number(fields.cleanerDeliveryRate) || 0;
  const gain = cleanerIdToStore
    ? computeMissionGain({ service: fields.service, hourlyRate: rate, deliveryRate, durationMinutes: minutes })
    : 0;

  const { data, error } = await supabase.from('missions').insert({
    type: fields.type,
    source: fields.source,
    service: fields.service ?? 'cleaning',
    delivery_instructions: fields.deliveryInstructions || null,
    airbnb_id: fields.airbnbId || null,
    partner_id: fields.partnerId || null,
    created_by: fields.createdBy || null,
    created_by_role: fields.createdByRole || 'admin',
    property_name: linked ? null : fields.propertyName,
    address: linked ? null : fields.address,
    // Coordonnées de l'adresse cible (proximité). Pour une mission liée à un site, le
    // fallback sur airbnbs suffit ; pour une adresse libre, on stocke le géocodage.
    address_lat: fields.addressLat ?? null,
    address_lng: fields.addressLng ?? null,
    date_from: fields.dateFrom,
    time_from: fields.timeFrom || null,
    time_to: fields.timeTo || null,
    hours_worked: Math.round((minutes / 60) * 100) / 100,
    mission_duration_minutes: minutes,
    cleaner_id: cleanerIdToStore,
    cleaner_name: fields.cleanerName || null,
    client_name: fields.clientName || null,
    price: fields.price,  // prix CLIENT (facturation) — indépendant du gain cleaner
    cleaner_gain: gain,
    cleaner_hourly_rate_snapshot: cleanerIdToStore ? rate : null,
    apartment_default_duration_snapshot: fields.apartmentDefaultDuration ?? null,
    instructions: fields.instructions || null,
    next_arrival: fields.nextArrival || null,
    next_arrival_time: fields.nextArrivalTime || null,
    status: cleanerIdToStore ? 'assigned' : 'pending',
  }).select('id').single();

  if (error) {
    console.error('createMissionDB error:', error);
    return { error: error.message };
  }
  // Si assignée dès la création → notif cleaner
  if (cleanerIdToStore && data?.id) await notifyCleanerNewMission(data.id);
  return { error: null };
}

// ── INTERVENTION PONCTUELLE (one-shot) multi-cleaners ────────────────────────
// Une intervention unique à une date, réalisée par 1..N cleaners (ex. gros ménage).
// Représentation : UNE ligne mission PAR cleaner, partageant un group_id → chaque
// cleaner l'a dans son planning, l'admin la voit comme une seule intervention.
// Les coordonnées du site sont SNAPSHOTées (pas de lien airbnb_id) pour que le prix
// client ne soit JAMAIS dérivé/dupliqué : il n'est porté que par UNE ligne du groupe.
export async function createOneShotMissionDB(fields: {
  propertyName: string; address?: string;
  type?: string; source?: string;
  date: string; time?: string;
  durationMinutes: number; price: number; instructions?: string;
  addressLat?: number; addressLng?: number;
  cleaners: { id: string; name: string; hourlyRate?: number }[];
  createdBy?: string;
}): Promise<{ error: string | null; count: number }> {
  const minutes = Number(fields.durationMinutes) || 0;
  const list = fields.cleaners ?? [];
  // group_id seulement si plusieurs intervenants (une intervention = un groupe).
  const groupId = list.length > 1 ? crypto.randomUUID() : null;

  const rowBase = {
    type: fields.type || 'deep_clean',
    source: fields.source || 'hotel',
    service: 'cleaning' as const,
    property_name: fields.propertyName,
    address: fields.address || null,
    address_lat: fields.addressLat ?? null,
    address_lng: fields.addressLng ?? null,
    date_from: fields.date,
    time_from: fields.time || null,
    instructions: fields.instructions || null,
    mission_duration_minutes: minutes,
    hours_worked: Math.round((minutes / 60) * 100) / 100,
    apartment_default_duration_snapshot: minutes,
    created_by: fields.createdBy || null,
    created_by_role: 'admin',
    group_id: groupId,
  };

  let rows: Record<string, unknown>[];
  if (list.length === 0) {
    // Aucun intervenant encore : une ligne « À assigner », prix client porté ici.
    rows = [{ ...rowBase, cleaner_id: null, cleaner_name: null, price: fields.price || 0, cleaner_gain: 0, status: 'pending' }];
  } else {
    rows = list.map((c, i) => ({
      ...rowBase,
      cleaner_id: c.id,
      cleaner_name: c.name,
      // Prix client porté par UNE seule ligne (la 1re) → le CA ne compte qu'une fois.
      price: i === 0 ? (fields.price || 0) : 0,
      cleaner_gain: computeCleanerGain(c.hourlyRate ?? 0, minutes),
      cleaner_hourly_rate_snapshot: c.hourlyRate ?? null,
      status: 'assigned',
    }));
  }

  const { data, error } = await supabase.from('missions').insert(rows).select('id');
  if (error) { console.error('createOneShotMissionDB error:', error); return { error: error.message, count: 0 }; }
  // Notifier chaque cleaner assigné.
  if (list.length > 0 && data) { for (const r of data) await notifyCleanerNewMission(r.id); }
  return { error: null, count: data?.length ?? 0 };
}

// Création groupée : une mission INDIVIDUELLE par appartement sélectionné,
// en un seul insert. Date / heure / cleaner partagés ; prix et durée repris
// de chaque fiche appartement. Ne crée jamais une mission unique fusionnée.
export async function createMissionsBatchDB(params: {
  apartments: { airbnbId: string; partnerId?: string; price: number; durationMinutes: number; defaultDuration?: number }[];
  dateFrom: string; timeFrom: string;
  cleanerId?: string; cleanerName?: string; cleanerHourlyRate?: number;
  createdBy?: string; createdByRole?: string;
}): Promise<{ error: string | null; count: number }> {
  if (params.apartments.length === 0) return { error: 'Aucun appartement sélectionné.', count: 0 };

  const cleanerIdToStore: string | null = params.cleanerId || null;
  const rate = Number(params.cleanerHourlyRate) || 0;

  const rows = params.apartments.map(a => {
    const minutes = Number(a.durationMinutes) || 0;
    return {
      type: 'regular',
      source: 'airbnb',
      airbnb_id: a.airbnbId,
      partner_id: a.partnerId || null,
      created_by: params.createdBy || null,
      created_by_role: params.createdByRole || 'admin',
      property_name: null,           // repris de la fiche appartement (join)
      address: null,
      date_from: params.dateFrom,
      time_from: params.timeFrom || null,
      time_to: null,
      hours_worked: Math.round((minutes / 60) * 100) / 100,
      mission_duration_minutes: minutes,
      cleaner_id: cleanerIdToStore,
      cleaner_name: params.cleanerName || null,
      price: a.price,                // prix CLIENT repris de la fiche appartement
      cleaner_gain: cleanerIdToStore ? computeCleanerGain(rate, minutes) : 0,
      cleaner_hourly_rate_snapshot: cleanerIdToStore ? rate : null,
      apartment_default_duration_snapshot: a.defaultDuration ?? null,
      status: cleanerIdToStore ? 'assigned' : 'pending',
    };
  });

  const { data, error } = await supabase.from('missions').insert(rows).select('id');
  if (error) {
    console.error('createMissionsBatchDB error:', error);
    return { error: error.message, count: 0 };
  }
  // Notif cleaner pour chaque mission assignée dès la création.
  if (cleanerIdToStore && data) {
    for (const r of data) await notifyCleanerNewMission(r.id);
  }
  return { error: null, count: data?.length ?? 0 };
}

// ── RENDEZ-VOUS (service = 'appointment') ───────────────────────────────────
// Personnes assignables à un rendez-vous : administrateurs (users.id) + cleaners
// actifs (cleaners.id). Le rôle permet à la création de router l'assignation
// (cleaner → cleaner_id, visible dans son planning ; admin → assignee_user_id).
export async function getAssignableStaffDB(): Promise<{ id: string; name: string; role: string }[]> {
  const cleaners = await getActiveCleanersDB();
  const { data: admins } = await supabase.from('users').select('id, name').eq('role', 'admin');
  return [
    ...(admins ?? []).map(a => ({ id: a.id, name: a.name, role: 'admin' })),
    ...cleaners.map((c: any) => ({ id: c.id, name: c.name, role: 'cleaner' })),
  ];
}

// Crée un rendez-vous : mission interne (price=0, gain=0), planifiée, assignée à un
// cleaner OU un admin. Aucun GPS/pointage ni facturation (cf. serviceParts).
export async function createAppointmentDB(fields: {
  title: string; description?: string; date: string; time?: string;
  assigneeId?: string; assigneeRole?: string; assigneeName?: string;
  createdBy?: string;
}): Promise<{ error: string | null }> {
  const isCleaner = fields.assigneeRole === 'cleaner';
  // Cleaner assigné → cleaner_id (= cleaners.id du dropdown) pour apparaître dans son
  // planning. Admin → assignee_user_id (= users.id), cleaner_id null.
  const cleanerId = fields.assigneeId && isCleaner ? fields.assigneeId : null;
  const cleanerName = cleanerId ? (fields.assigneeName ?? null) : null;
  const assigneeUserId = fields.assigneeId && !isCleaner ? fields.assigneeId : null;
  const assigneeName = assigneeUserId ? (fields.assigneeName ?? null) : null;
  const assigneeRole = assigneeUserId ? (fields.assigneeRole ?? 'admin') : null;
  const assigned = !!fields.assigneeId;

  const { data, error } = await supabase.from('missions').insert({
    type: 'appointment',
    source: 'hotel',
    service: 'appointment',
    property_name: fields.title,
    address: null,
    date_from: fields.date,
    time_from: fields.time || null,
    instructions: fields.description || null,
    price: 0,
    cleaner_gain: 0,
    mission_duration_minutes: 0,
    hours_worked: 0,
    cleaner_id: cleanerId,
    cleaner_name: cleanerName,
    assignee_user_id: assigneeUserId,
    assignee_name: assigneeName,
    assignee_role: assigneeRole,
    created_by: fields.createdBy || null,
    created_by_role: 'admin',
    status: assigned ? 'assigned' : 'pending',
  }).select('id').single();

  if (error) { console.error('createAppointmentDB error:', error); return { error: error.message }; }
  if (cleanerId && data?.id) await notifyCleanerNewMission(data.id);
  return { error: null };
}

// Maps app-level MissionStatus → DB status string
function toDbMissionStatus(appStatus: MissionStatus): string {
  const map: Record<MissionStatus, string> = {
    pending: 'pending',
    accepted: 'assigned',
    in_progress: 'inprogress',
    completed: 'done',
    cancelled: 'cancelled',
  };
  return map[appStatus] ?? appStatus;
}

export async function updateMissionStatusDB(id: string, status: MissionStatus, actor?: MissionActor): Promise<void> {
  await supabase.from('missions').update({ status: toDbMissionStatus(status) }).eq('id', id);
  // Notifications selon le nouveau statut
  if (status === 'cancelled') await notifyMissionCancelled(id, actor?.role ?? '', actor?.id ?? '');
  else if (status === 'completed') await notifyMissionCompleted(id);
}

export async function assignCleanerToMissionDB(missionId: string, cleanerId: string, cleanerName: string): Promise<void> {
  // cleanerId is already cleaners.id (from the dropdown) — store directly.
  // Gain cleaner recalculé : taux horaire du cleaner × durée de la mission / 60.
  const [{ data: cleaner }, { data: mission }] = await Promise.all([
    supabase.from('cleaners').select('hourly_rate, delivery_rate').eq('id', cleanerId).single(),
    supabase.from('missions').select('service, mission_duration_minutes, apartment_default_duration_snapshot, airbnbs(estimated_cleaning_minutes)').eq('id', missionId).single(),
  ]);
  const rate = Number(cleaner?.hourly_rate) || 0;
  const deliveryRate = Number(cleaner?.delivery_rate) || 0;
  const service = (mission as any)?.service as MissionService | undefined;
  const aptDefault = (mission as any)?.airbnbs?.estimated_cleaning_minutes
    ?? (mission as any)?.apartment_default_duration_snapshot
    ?? null;
  const minutes = (mission as any)?.mission_duration_minutes != null
    ? Number((mission as any).mission_duration_minutes)
    : (aptDefault != null ? Number(aptDefault) : 60);

  await supabase.from('missions').update({
    cleaner_id: cleanerId,
    cleaner_name: cleanerName,
    status: 'assigned',
    cleaner_gain: computeMissionGain({ service, hourlyRate: rate, deliveryRate, durationMinutes: minutes }),
    cleaner_hourly_rate_snapshot: rate,
    mission_duration_minutes: minutes,
    apartment_default_duration_snapshot: aptDefault != null ? Number(aptDefault) : null,
    hours_worked: Math.round((minutes / 60) * 100) / 100,
  }).eq('id', missionId);
  // Notif cleaner : nouvelle mission
  await notifyCleanerNewMission(missionId);
}

// Ordre manuel des missions (par cleaner) fixé par l'admin. On persiste le rang
// `manual_order` de chaque mission ; le tri partagé (missionOrder.ts) l'applique
// à date égale, côté admin ET côté cleaner.
export async function updateMissionsOrderDB(orders: { id: string; order: number }[]): Promise<void> {
  await Promise.all(orders.map(o =>
    supabase.from('missions').update({ manual_order: o.order }).eq('id', o.id)));
}

// Assignation groupée d'un même cleaner à plusieurs missions (tournée par zone).
// Réutilise la logique unitaire → le gain de chaque mission est recalculé.
export async function assignCleanerToMissionsDB(missionIds: string[], cleanerId: string, cleanerName: string): Promise<void> {
  for (const id of missionIds) {
    await assignCleanerToMissionDB(id, cleanerId, cleanerName);
  }
}

// ── TEMPS SUPPLÉMENTAIRE (cleaner → admin) ──────────────────────────────────────
// Chaque ménage a une durée définie. Si l'appartement est très sale (photos « avant »
// à l'appui), le cleaner peut demander du temps en plus. La demande reste « pending »
// jusqu'à décision de l'admin : à l'approbation, la durée de la mission est augmentée
// et le gain cleaner recalculé ; au refus, la durée ne bouge pas.

// Demande faite par le cleaner connecté (userId = users.id).
export async function requestExtraTimeDB(params: {
  missionId: string; minutes: number; reason?: string; userId: string; at?: string;
}): Promise<{ error: string | null }> {
  const minutes = Math.max(0, Math.round(Number(params.minutes) || 0));
  if (minutes <= 0) return { error: 'Durée supplémentaire invalide.' };

  // Le cleaner ne peut agir que sur sa propre mission, non clôturée.
  const cleanerTableId = await resolveToCleanerTableId(params.userId);
  if (!cleanerTableId) return { error: 'Cleaner introuvable.' };

  const { data, error } = await supabase
    .from('missions')
    .update({
      extra_time_minutes: minutes,
      extra_time_reason: params.reason || null,
      extra_time_status: 'pending',
      extra_time_requested_at: params.at ?? new Date().toISOString(),
    })
    .eq('id', params.missionId)
    .eq('cleaner_id', cleanerTableId)
    .not('status', 'in', '(done,cancelled)')
    .select('id');

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'Demande impossible sur cette mission.' };

  await notifyExtraTimeRequested(params.missionId, minutes);
  return { error: null };
}

// Décision admin : approuver (ajoute le temps + recalcule le gain) ou refuser.
export async function resolveExtraTimeDB(
  missionId: string,
  approve: boolean,
  actor: MissionActor,
): Promise<{ error: string | null }> {
  if (actor.role !== 'admin') return { error: "Action réservée à l'administrateur." };

  const { data: m } = await supabase
    .from('missions')
    .select('cleaner_id, service, mission_duration_minutes, extra_time_minutes, extra_time_status')
    .eq('id', missionId).single();
  if (!m) return { error: 'Mission introuvable.' };
  if (m.extra_time_status !== 'pending') return { error: 'Aucune demande en attente.' };

  if (!approve) {
    const { error } = await supabase.from('missions')
      .update({ extra_time_status: 'refused' }).eq('id', missionId);
    if (error) return { error: error.message };
    await notifyExtraTimeResolved(missionId, false);
    return { error: null };
  }

  // Approbation : la durée payée augmente du temps demandé, gain recalculé.
  const extra = Math.max(0, Math.round(Number(m.extra_time_minutes) || 0));
  const newMinutes = (Number(m.mission_duration_minutes) || 0) + extra;
  const patch: Record<string, unknown> = {
    extra_time_status: 'approved',
    mission_duration_minutes: newMinutes,
    hours_worked: Math.round((newMinutes / 60) * 100) / 100,
  };
  if (m.cleaner_id) {
    const { data: cleaner } = await supabase.from('cleaners')
      .select('hourly_rate, delivery_rate').eq('id', m.cleaner_id).single();
    const rate = Number(cleaner?.hourly_rate) || 0;
    const deliveryRate = Number(cleaner?.delivery_rate) || 0;
    patch.cleaner_gain = computeMissionGain({ service: (m as any).service, hourlyRate: rate, deliveryRate, durationMinutes: newMinutes });
    patch.cleaner_hourly_rate_snapshot = rate;
  }
  const { error } = await supabase.from('missions').update(patch).eq('id', missionId);
  if (error) return { error: error.message };
  await notifyExtraTimeResolved(missionId, true);
  return { error: null };
}

// Ajout (ou retrait) de temps par l'ADMIN sur une mission — Y COMPRIS déjà terminée.
// Augmente la durée payée par rapport au temps prévu et recalcule le gain cleaner.
// Sert à régulariser le temps réellement passé après coup.
export async function addMissionTimeDB(
  missionId: string, deltaMinutes: number, actor: MissionActor,
): Promise<{ error: string | null }> {
  if (actor.role !== 'admin') return { error: "Action réservée à l'administrateur." };
  const delta = Math.round(Number(deltaMinutes) || 0);
  if (delta === 0) return { error: 'Indiquez un nombre de minutes.' };

  const { data: m } = await supabase.from('missions')
    .select('cleaner_id, service, mission_duration_minutes').eq('id', missionId).single();
  if (!m) return { error: 'Mission introuvable.' };

  const newMinutes = Math.max(0, (Number(m.mission_duration_minutes) || 0) + delta);
  const patch: Record<string, unknown> = {
    mission_duration_minutes: newMinutes,
    hours_worked: Math.round((newMinutes / 60) * 100) / 100,
  };
  if (m.cleaner_id) {
    const { data: cleaner } = await supabase.from('cleaners')
      .select('hourly_rate, delivery_rate').eq('id', m.cleaner_id).single();
    const rate = Number(cleaner?.hourly_rate) || 0;
    const deliveryRate = Number(cleaner?.delivery_rate) || 0;
    patch.cleaner_gain = computeMissionGain({ service: (m as any).service, hourlyRate: rate, deliveryRate, durationMinutes: newMinutes });
    patch.cleaner_hourly_rate_snapshot = rate;
  }
  const { error } = await supabase.from('missions').update(patch).eq('id', missionId);
  if (error) return { error: error.message };
  return { error: null };
}

// ── POINTAGE AUTOMATIQUE (début / fin + géolocalisation) ────────────────────────
// Discret côté cleaner : il ne voit que « Démarrer » / « Terminer ». Le système
// enregistre l'heure et UNE position à chaque étape (pas de suivi continu), calcule
// la durée réelle à la fin et vérifie la proximité début ↔ fin. Données réservées
// à l'admin (temps réel, écart, statistiques).

// Démarrage : horodatage + statut « en cours » + position de départ (best-effort).
// Coordonnées de l'adresse d'une mission (via l'appartement lié). Null pour les
// missions hôtel (pas de géocodage) ou un appartement non géolocalisé.
async function missionAddressCoords(missionId: string): Promise<{ service?: string; coords: GeoPoint | null }> {
  const { data } = await supabase.from('missions')
    .select('service, address_lat, address_lng, airbnbs(latitude, longitude)').eq('id', missionId).single();
  const d = data as any;
  // Priorité aux coordonnées portées par la mission elle-même ; à défaut, le site lié.
  let coords: GeoPoint | null = d?.address_lat != null && d?.address_lng != null
    ? { lat: Number(d.address_lat), lng: Number(d.address_lng) }
    : null;
  if (!coords) {
    const apt = d?.airbnbs;
    coords = apt && apt.latitude != null && apt.longitude != null
      ? { lat: Number(apt.latitude), lng: Number(apt.longitude) }
      : null;
  }
  return { service: d?.service, coords };
}

// `at` = horodatage de l'action (ISO). En hors-ligne, l'action est capturée sur
// place puis rejouée plus tard : on enregistre l'heure du démarrage réel, pas celle
// du rejeu. Par défaut = maintenant (chemin en ligne classique).
export async function startMissionDB(
  missionId: string, userId: string, coords?: GeoPoint | null, at?: string,
): Promise<{ error: string | null; tooFar?: boolean }> {
  const cleanerTableId = await resolveToCleanerTableId(userId);
  if (!cleanerTableId) return { error: 'Cleaner introuvable.' };

  // GPS OBLIGATOIRE pour le MÉNAGE : le cleaner doit être à proximité (≤ 200 m) de
  // l'adresse. La LIVRAISON n'est pas concernée (pas de pointage). Si l'adresse n'a
  // pas de coordonnées (hôtel / appart non géolocalisé), on ne peut pas vérifier.
  const { service, coords: addr } = await missionAddressCoords(missionId);
  if (service !== 'delivery' && addr) {
    if (!coords) return { error: GPS_REQUIRED_ERROR };
    if (distanceMeters(addr, coords) > TRACKING_TOLERANCE_METERS) return { error: ADDRESS_PROXIMITY_ERROR, tooFar: true };
  }

  const patch: Record<string, unknown> = {
    status: 'inprogress',
    started_at: at ?? new Date().toISOString(),
  };
  if (coords) { patch.start_lat = coords.lat; patch.start_lng = coords.lng; }

  const { data, error } = await supabase.from('missions').update(patch)
    .eq('id', missionId).eq('cleaner_id', cleanerTableId)
    .not('status', 'in', '(done,cancelled)').select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'Action impossible sur cette mission.' };
  return { error: null };
}

// Livraison : le livreur valide simplement « Livré » → mission terminée. Aucun
// pointage, aucun GPS, aucune étape de démarrage.
export async function markDeliveredDB(
  missionId: string, userId: string, at?: string,
): Promise<{ error: string | null }> {
  const cleanerTableId = await resolveToCleanerTableId(userId);
  if (!cleanerTableId) return { error: 'Cleaner introuvable.' };

  const { data, error } = await supabase.from('missions')
    .update({ status: 'done', ended_at: at ?? new Date().toISOString() })
    .eq('id', missionId).eq('cleaner_id', cleanerTableId)
    .not('status', 'in', '(done,cancelled)').select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'Action impossible sur cette mission.' };
  await notifyMissionCompleted(missionId);
  return { error: null };
}

// Fin : vérifie la proximité (si les deux positions existent), calcule la durée
// réelle, horodate la fin et clôture la mission. Renvoie tooFar si trop éloigné.
export async function finishMissionDB(
  missionId: string, userId: string, coords?: GeoPoint | null, at?: string,
): Promise<{ error: string | null; tooFar?: boolean }> {
  const cleanerTableId = await resolveToCleanerTableId(userId);
  if (!cleanerTableId) return { error: 'Cleaner introuvable.' };

  const { data: m } = await supabase.from('missions')
    .select('started_at, start_lat, start_lng, cleaner_id, status, service, source, price, mission_duration_minutes, cleaner_hourly_rate_snapshot, address_lat, address_lng, airbnbs(latitude, longitude)')
    .eq('id', missionId).single();
  if (!m || m.cleaner_id !== cleanerTableId) return { error: 'Mission introuvable.' };
  if (m.status === 'done' || m.status === 'cancelled') return { error: 'Mission déjà clôturée.' };

  // Contrôle GPS (ménage uniquement). En priorité contre l'ADRESSE de la mission
  // (≤ 200 m) — coords portées par la mission, sinon par le site lié ; à défaut, début ↔ fin.
  const md = m as any;
  const apt = md?.airbnbs;
  const addr = md?.address_lat != null && md?.address_lng != null
    ? { lat: Number(md.address_lat), lng: Number(md.address_lng) }
    : (apt && apt.latitude != null && apt.longitude != null
        ? { lat: Number(apt.latitude), lng: Number(apt.longitude) } : null);
  if ((m as any).service !== 'delivery') {
    if (addr) {
      if (!coords) return { error: GPS_REQUIRED_ERROR };
      if (distanceMeters(addr, coords) > TRACKING_TOLERANCE_METERS) return { error: ADDRESS_PROXIMITY_ERROR, tooFar: true };
    } else if (coords && m.start_lat != null && m.start_lng != null) {
      const d = distanceMeters({ lat: Number(m.start_lat), lng: Number(m.start_lng) }, coords);
      if (d > TRACKING_TOLERANCE_METERS) return { error: PROXIMITY_ERROR, tooFar: true };
    }
  }

  // Heure de fin = celle capturée sur place (hors-ligne) ou maintenant (en ligne).
  const now = at ? new Date(at) : new Date();
  const patch: Record<string, unknown> = { status: 'done', ended_at: now.toISOString() };
  if (m.started_at) {
    const mins = Math.max(0, Math.round((now.getTime() - new Date(m.started_at).getTime()) / 60000));
    patch.actual_duration_minutes = mins;

    const md = m as { source?: string; price?: number; mission_duration_minutes?: number; cleaner_hourly_rate_snapshot?: number; service?: string };
    const svc = md.service ?? 'cleaning';
    const planned = Number(md.mission_duration_minutes) || 0;

    // PAIE CLEANER — HÔTEL / EHPAD UNIQUEMENT : payé au TEMPS RÉEL travaillé
    // (pointage), même si < prévu. Ménage uniquement (la livraison = forfait).
    // Les Airbnb gardent la paie au temps prévu (marge Airbnb fixe).
    const rate = Number(md.cleaner_hourly_rate_snapshot) || 0;
    if (md.source === 'hotel' && svc === 'cleaning' && rate > 0) {
      patch.cleaner_gain = computeCleanerGain(rate, mins);
    }

    // FACTURATION HÔTEL / EHPAD (source 'hotel') : on facture le MAX(temps
    // accordé, temps réel). Dépassement → on facture le réel ; plus rapide → on
    // facture quand même le temps convenu (jamais moins). Airbnb NON concernés
    // (prix fixe par ménage). Sans pointage → prix prévu conservé (ce bloc est
    // dans `if (m.started_at)`).
    const basePrice = Number(md.price) || 0;
    if (md.source === 'hotel' && planned > 0 && basePrice > 0) {
      patch.price = billableHotelPrice(basePrice, planned, mins);
    }
  }
  if (coords) { patch.end_lat = coords.lat; patch.end_lng = coords.lng; }

  const { error } = await supabase.from('missions').update(patch).eq('id', missionId);
  if (error) return { error: error.message };
  await notifyMissionCompleted(missionId);
  return { error: null };
}

// Désistement du cleaner : il renonce à SA mission non clôturée. La mission n'est
// NI annulée NI supprimée — le cleaner n'a pas ce pouvoir. Elle est simplement
// DÉTACHÉE de lui et repart dans le pool non assigné (statut 'pending'), à charge
// pour l'admin de la réattribuer ; l'admin est notifié.
// Garde atomique : impossible sur une mission déjà terminée/annulée, ou qui
// n'appartient pas au cleaner qui la demande.
export async function withdrawMissionDB(
  missionId: string, userId: string,
): Promise<{ error: string | null }> {
  const cleanerTableId = await resolveToCleanerTableId(userId);
  if (!cleanerTableId) return { error: 'Cleaner introuvable.' };

  // Nom du cleaner AVANT détachement : la notification doit dire qui s'est désisté.
  const { data: before } = await supabase.from('missions')
    .select('cleaner_name').eq('id', missionId).maybeSingle();

  const { data, error } = await supabase.from('missions')
    .update({ status: 'pending', cleaner_id: null, cleaner_name: null })
    .eq('id', missionId).eq('cleaner_id', cleanerTableId)
    .not('status', 'in', '(done,cancelled)').select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'Désistement impossible sur cette mission.' };

  await notifyMissionWithdrawn(missionId, before?.cleaner_name ?? null);
  return { error: null };
}

// Retrait par l'ADMIN : il reprend une mission à un cleaner et la remet au pot
// commun. Symétrique du désistement, mais dans l'autre sens — et le cleaner doit
// être prévenu, sinon il continue de compter dessus et se déplace pour rien.
// Interdit sur une mission terminée ou annulée : on ne réécrit pas le passé.
export async function unassignMissionDB(missionId: string): Promise<{ error: string | null }> {
  const { data: before } = await supabase.from('missions')
    .select('cleaner_id, cleaner_name, status').eq('id', missionId).maybeSingle();
  if (!before?.cleaner_id) return { error: 'Aucun cleaner sur cette mission.' };
  if (before.status === 'done' || before.status === 'cancelled') {
    return { error: 'Mission déjà terminée ou annulée.' };
  }

  const { data, error } = await supabase.from('missions')
    .update({
      status: 'pending', cleaner_id: null, cleaner_name: null,
      // Une éventuelle demande en attente n'a plus lieu d'être.
      pending_cleaner_id: null, pending_cleaner_name: null, pending_requested_at: null,
    })
    .eq('id', missionId).not('status', 'in', '(done,cancelled)').select('id');
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: 'Retrait impossible sur cette mission.' };

  try {
    const { notifyCleanerMissionUnassigned } = await import('./notifications');
    await notifyCleanerMissionUnassigned(missionId, before.cleaner_id as string);
  } catch (e) { console.error('notify unassign:', e); }
  return { error: null };
}

// ── MODIFICATION / SUPPRESSION SÉCURISÉES ──────────────────────────────────────
// La règle est appliquée ICI (logique métier = source de vérité), pas seulement
// dans l'UI : on relit le statut + le créateur en base avant toute mutation, on
// vérifie les droits, puis on applique une garde atomique au niveau de la requête
// (.not status in done/cancelled) pour bloquer toute course / contournement.

// Relit la mission pour l'autorisation. Tolère l'absence des colonnes created_by
// (migration_mission_owner.sql non encore appliquée) en retombant sur partner_id.
async function loadMissionForAuth(missionId: string) {
  const full = await supabase
    .from('missions')
    .select('id, status, partner_id, created_by, created_by_role')
    .eq('id', missionId)
    .single();
  if (!full.error) return { data: full.data as any, error: null };

  const min = await supabase.from('missions').select('id, status, partner_id').eq('id', missionId).single();
  if (min.error || !min.data) return { data: null, error: min.error };
  return { data: { ...min.data, created_by: null, created_by_role: null } as any, error: null };
}

// Vérifie droits + statut. Renvoie un message d'erreur explicite si refusé.
async function authorizeMissionMutation(
  missionId: string,
  actor: MissionActor,
  action: 'modifier' | 'supprimer',
): Promise<{ ok: true; row: any } | { ok: false; error: string }> {
  const { data: row } = await loadMissionForAuth(missionId);
  if (!row) return { ok: false, error: 'Mission introuvable.' };

  const isAdmin = actor.role === 'admin';

  // 1) Statut verrouillé (terminée / annulée) → refus SAUF pour l'admin, qui
  //    garde le contrôle total (reprendre, modifier, annuler, supprimer).
  const appStatus = mapMissionStatus(row.status);
  if (isMissionLocked(appStatus) && !isAdmin) {
    return { ok: false, error: missionLockMessage(appStatus, action) };
  }

  // 2) Droits : admin autorisé ; sinon doit être le créateur de la mission
  const isCreator = !!actor.id && (row.created_by === actor.id || row.partner_id === actor.id);
  if (!isAdmin && !isCreator) {
    return { ok: false, error: "Vous n'êtes pas autorisé à modifier cette mission." };
  }

  return { ok: true, row };
}

// Champs modifiables. Le créateur (partenaire) ne touche que l'opérationnel ;
// l'admin peut aussi modifier cleaner / prix / gain / statut.
export interface MissionUpdateFields {
  // opérationnel (créateur + admin)
  dateFrom?: string;
  timeFrom?: string;
  type?: string;
  service?: MissionService;
  deliveryInstructions?: string;
  airbnbId?: string | null;
  propertyName?: string;
  address?: string;
  instructions?: string;
  nextArrival?: string | null;
  nextArrivalTime?: string | null;
  // réservé à l'admin
  cleanerId?: string | null;
  cleanerName?: string | null;
  missionDurationMinutes?: number;  // durée de paie (recalcule le gain cleaner)
  price?: number;                   // prix CLIENT (facturation) — indépendant du gain
  status?: MissionStatus;
}

export async function updateMissionDB(
  missionId: string,
  actor: MissionActor,
  fields: MissionUpdateFields,
): Promise<{ error: string | null }> {
  const auth = await authorizeMissionMutation(missionId, actor, 'modifier');
  if (!auth.ok) return { error: auth.error };

  const isAdmin = actor.role === 'admin';
  const patch: Record<string, unknown> = {};

  // Champs opérationnels — créateur et admin
  if (fields.dateFrom !== undefined) patch.date_from = fields.dateFrom;
  if (fields.timeFrom !== undefined) patch.time_from = fields.timeFrom || null;
  if (fields.type !== undefined) patch.type = fields.type;
  if (fields.service !== undefined) patch.service = fields.service;
  if (fields.deliveryInstructions !== undefined) patch.delivery_instructions = fields.deliveryInstructions || null;
  if (fields.airbnbId !== undefined) patch.airbnb_id = fields.airbnbId || null;
  if (fields.propertyName !== undefined) patch.property_name = fields.propertyName;
  if (fields.address !== undefined) patch.address = fields.address;
  if (fields.instructions !== undefined) patch.instructions = fields.instructions || null;
  if (fields.nextArrival !== undefined) patch.next_arrival = fields.nextArrival || null;
  if (fields.nextArrivalTime !== undefined) patch.next_arrival_time = fields.nextArrivalTime || null;

  // Champs réservés à l'admin — ignorés en silence si l'acteur n'est pas admin
  if (isAdmin) {
    if (fields.cleanerId !== undefined) {
      patch.cleaner_id = fields.cleanerId || null;
      patch.cleaner_name = fields.cleanerName ?? null;
    }
    if (fields.price !== undefined) patch.price = fields.price;  // prix CLIENT uniquement
    if (fields.status !== undefined) patch.status = toDbMissionStatus(fields.status);

    // ── Recalcul du gain cleaner ──────────────────────────────────────────
    // Déclenché si l'admin change le cleaner, l'appartement, la durée ou la
    // prestation. Ménage = taux horaire × durée / 60 ; livraison = montant fixe.
    const touchesPay = fields.cleanerId !== undefined
      || fields.airbnbId !== undefined
      || fields.missionDurationMinutes !== undefined
      || fields.service !== undefined;
    if (touchesPay) {
      const { data: current } = await supabase
        .from('missions')
        .select('cleaner_id, service, mission_duration_minutes, apartment_default_duration_snapshot')
        .eq('id', missionId).single();

      const cleanerId = fields.cleanerId !== undefined ? fields.cleanerId : current?.cleaner_id;
      const service = (fields.service !== undefined ? fields.service : current?.service) as MissionService | undefined;

      // Durée par défaut de l'appartement (si l'appart change ou pour fallback).
      let aptDefault: number | null = current?.apartment_default_duration_snapshot ?? null;
      if (fields.airbnbId !== undefined && fields.airbnbId) {
        const { data: apt } = await supabase.from('airbnbs')
          .select('estimated_cleaning_minutes').eq('id', fields.airbnbId).single();
        if (apt?.estimated_cleaning_minutes != null) aptDefault = Number(apt.estimated_cleaning_minutes);
      }

      // Durée retenue : explicite > durée courante > défaut appart > 60.
      const minutes = fields.missionDurationMinutes !== undefined
        ? Number(fields.missionDurationMinutes) || 0
        : (current?.mission_duration_minutes != null
            ? Number(current.mission_duration_minutes)
            : (aptDefault ?? 60));

      patch.mission_duration_minutes = minutes;
      patch.hours_worked = Math.round((minutes / 60) * 100) / 100;
      if (aptDefault != null) patch.apartment_default_duration_snapshot = aptDefault;

      if (cleanerId) {
        const { data: cleaner } = await supabase.from('cleaners')
          .select('hourly_rate, delivery_rate').eq('id', cleanerId).single();
        const rate = Number(cleaner?.hourly_rate) || 0;
        const deliveryRate = Number(cleaner?.delivery_rate) || 0;
        patch.cleaner_gain = computeMissionGain({ service, hourlyRate: rate, deliveryRate, durationMinutes: minutes });
        patch.cleaner_hourly_rate_snapshot = rate;
      } else {
        patch.cleaner_gain = 0;
        patch.cleaner_hourly_rate_snapshot = null;
      }
    }
  }

  if (Object.keys(patch).length === 0) return { error: null };

  // Garde atomique : la requête elle-même refuse de toucher une mission clôturée.
  const { data, error } = await supabase
    .from('missions')
    .update(patch)
    .eq('id', missionId)
    .not('status', 'in', '(done,cancelled)')
    .select('id');

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: 'Cette mission est clôturée et ne peut plus être modifiée.' };
  }
  // Notif : mission modifiée (admin + cleaner si assignée)
  await notifyMissionModified(missionId, actor.role, actor.id);
  return { error: null };
}

export async function deleteMissionDB(
  missionId: string,
  actor: MissionActor,
): Promise<{ error: string | null }> {
  const auth = await authorizeMissionMutation(missionId, actor, 'supprimer');
  if (!auth.ok) return { error: auth.error };

  // Notif AVANT suppression (le contexte de la mission disparaît ensuite)
  await notifyMissionCancelled(missionId, actor.role, actor.id);

  // L'admin peut supprimer une mission clôturée ; les autres rôles restent bloqués
  // par la garde atomique (.not status in done/cancelled).
  let del = supabase.from('missions').delete().eq('id', missionId);
  if (actor.role !== 'admin') del = del.not('status', 'in', '(done,cancelled)');
  const { data, error } = await del.select('id');

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: 'Cette mission est clôturée et ne peut plus être supprimée.' };
  }
  return { error: null };
}

// Admin : reprendre une mission terminée → la repasse « en cours » et efface la
// clôture (fin + durée réelle). Les compteurs (stats/compta/paie) la décomptent
// automatiquement puisqu'ils dérivent du statut courant.
export async function reopenMissionDB(missionId: string, actor: MissionActor): Promise<{ error: string | null }> {
  if (actor.role !== 'admin') return { error: "Action réservée à l'administrateur." };
  const { error } = await supabase.from('missions').update({
    status: 'inprogress',
    ended_at: null,
    actual_duration_minutes: null,
  }).eq('id', missionId);
  return { error: error?.message ?? null };
}

// (disponibilité cleaner déplacée dans ./db/cleaners)

// ── HOTEL REQUESTS ────────────────────────────────────────────────────────────

export async function getHotelRequestsDB(): Promise<HotelAnnounce[]> {
  try { const d = await getServer('/api/partners?op=hotelRequests'); return d.requests ?? []; }
  catch { return []; }
}

export async function getHotelRequestsForHotelDB(hotelId: string): Promise<HotelAnnounce[]> {
  try { const d = await getServer(`/api/partners?op=hotelRequestsForHotel&hotelId=${encodeURIComponent(hotelId)}`); return d.requests ?? []; }
  catch { return []; }
}

export async function createHotelRequestDB(fields: {
  hotelId: string; hotelName: string; type: string;
  dateFrom: string; dateTo: string; timeFrom: string; timeTo: string;
  persons: number; instructions?: string;
}) {
  try {
    await postServer('/api/partners', {
      op: 'createHotelRequest',
      hotelId: fields.hotelId, hotelName: fields.hotelName, type: fields.type,
      dateFrom: fields.dateFrom, dateTo: fields.dateTo, timeFrom: fields.timeFrom, timeTo: fields.timeTo,
      persons: fields.persons, instructions: fields.instructions,
    });
  } catch (e) { console.error('createHotelRequestDB:', e); }
}

export async function validateRequestDB(id: string, cleanerId: string, cleanerName: string, durationMinutesOverride?: number) {
  try {
    await postServer('/api/partners', {
      op: 'validateRequest', id, cleanerId, cleanerName, durationMinutesOverride,
    });
  } catch (e) { console.error('validateRequestDB:', e); }
}

export async function refuseRequestDB(id: string) {
  try { await postServer('/api/partners', { op: 'refuseRequest', id }); }
  catch (e) { console.error('refuseRequestDB:', e); }
}

// Annulation d'une demande hôtel par l'hôtel lui-même (seulement si « en attente »).
// Renvoie un message d'erreur éventuel pour l'afficher dans l'UI.
export async function cancelHotelRequestDB(id: string): Promise<{ error: string | null }> {
  try {
    await postServer('/api/partners', { op: 'cancelHotelRequest', id });
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Annulation impossible.' };
  }
}

// Classement mensuel par nombre de missions terminées — AGRÉGAT SANS MONTANT.
// Ne sélectionne ni price ni cleaner_gain : sûr à exposer côté cleaner (LOT 6).
export async function getMonthlyRankingDB(period: string): Promise<{ cleanerId: string; name: string; count: number }[]> {
  const { data, error } = await supabase
    .from('missions').select('cleaner_id, status, date_from, cleaners(name)')
    .eq('status', 'done').like('date_from', `${period}%`);
  if (error) { console.error('getMonthlyRankingDB:', error.code, error.message); return []; }
  const map = new Map<string, { name: string; count: number }>();
  (data ?? []).forEach((r: any) => {
    if (!r.cleaner_id) return;
    const e = map.get(r.cleaner_id) ?? { name: r.cleaners?.name ?? 'Cleaner', count: 0 };
    e.count += 1; map.set(r.cleaner_id, e);
  });
  return Array.from(map.entries()).map(([cleanerId, v]) => ({ cleanerId, ...v })).sort((a, b) => b.count - a.count);
}

// ── PAYMENTS / FACTURATION / RÉSERVATIONS — déplacés dans ./db/billing & ./db/reservations
// (les fonctions partenaires sont dans ./db/partners) ───────────────────────────

// ── SYNCHRONISATION DES RÉSERVATIONS — déplacée dans ./db/reservations ───────────
// (STATS déplacées dans ./db/stats)
