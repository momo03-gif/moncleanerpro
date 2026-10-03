import type { User, Mission, MissionStatus, MissionType, MissionSource, MissionService, HotelAnnounce, Apartment, Payment, CompanyInfo, InvoiceLine, InvoiceRecord, Role, ReservationFeed, Reservation } from './types';
import { clusterApartments } from './zones';
import type { GeoPoint } from './geo';
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


// (CLEANERS déplacés dans ./db/cleaners ; AIRBNBS + ZONES dans ./db/airbnbs)

// ── MISSIONS ──────────────────────────────────────────────────────────────────

// (trimTime déplacé dans ./db/shared)

// Lecture des missions : par le serveur (cf. lib/missionRead.ts). La table
// n'est plus lisible avec la clé publique. Dans le navigateur on passe par
// GET /api/missions ; sur le serveur (moteur de paie), on lit directement.
// ⚠️ Les codes d'accès et les notes du logement ne voyagent pas par là : ils
// sont servis par /api/missions/terrain, pour les seuls ménages du demandeur.
async function lireMissions(params: Record<string, string | undefined>): Promise<any> {
  const qs = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => e[1] != null && e[1] !== ''));
  const res = await fetch(`/api/missions?${qs}`, { cache: 'no-store' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Erreur ${res.status}`);
  return body.data;
}

function rowToMission(row: any): Mission {
  let property = row.property_name ?? '';
  let address = row.address ?? '';
  let notes: string | undefined = row.instructions ?? undefined;

  // Mission liée à un appartement → source de vérité = la fiche appartement
  const apt = row.airbnbs;
  if (row.airbnb_id && apt) {
    property = apt.name ?? property;
    address = apt.address ?? address;
    // Les codes d'accès et les notes du logement arrivent par la route terrain ;
    // ici ne restent que les consignes ajoutées sur la mission elle-même.
    notes = row.instructions || undefined;
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
    partnerRating: row.partner_rating != null ? Number(row.partner_rating) : undefined,
    partnerRatingComment: row.partner_rating_comment ?? undefined,
    partnerRatedAt: row.partner_rated_at ?? undefined,
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
  try {
    return ((await lireMissions({ scope: 'all', since: sinceDate })) ?? []).map(rowToMission);
  } catch (e) {
    console.error('getMissionsDB:', e);
    return [];
  }
}

export async function getMissionsForCleanerDB(_userId: string, sinceDate?: string): Promise<Mission[]> {
  // Le cleaner est celui de la session : le serveur résout users.id → cleaners.id.
  try {
    return ((await lireMissions({ scope: 'cleaner', since: sinceDate })) ?? []).map(rowToMission);
  } catch (e) {
    console.error('getMissionsForCleanerDB:', e);
    return [];
  }
}

// Missions d'un cleaner identifié par cleaners.id (pas users.id) — utilisé par le
// moteur RH, qui raisonne directement en cleaners.id (= missions.cleaner_id).
// `sinceDate` (YYYY-MM-DD) borne la requête aux missions à partir de cette date
// (les missions futures sont toujours incluses). Sert à alléger le planning
// cleaner : inutile de charger tout l'historique sur un outil mobile quotidien.
// Sans `sinceDate` → comportement inchangé (tout l'historique), pour le moteur RH.
export async function getMissionsByCleanerTableIdDB(cleanerTableId: string, sinceDate?: string): Promise<Mission[]> {
  try {
    // Sur le serveur (moteur de paie) : lecture directe en service_role.
    if (typeof window === 'undefined') {
      const [{ getSupabaseAdmin }, { lireDuCleaner }] = await Promise.all([
        import('./supabaseAdmin'), import('./missionRead'),
      ]);
      return (await lireDuCleaner(getSupabaseAdmin(), cleanerTableId, sinceDate)).map(rowToMission);
    }
    return ((await lireMissions({ scope: 'cleaner', cleanerId: cleanerTableId, since: sinceDate })) ?? []).map(rowToMission);
  } catch (e) {
    console.error('getMissionsByCleanerTableIdDB:', e);
    return [];
  }
}

// Missions d'un partenaire Airbnb (avec compte) — filtrées par partner_id
export async function getMissionsForPartnerDB(_userId: string): Promise<Mission[]> {
  // Le serveur ne renvoie QUE les missions de la conciergerie connectée, déjà
  // débarrassées de la paie et du pointage ; on garde le filtre ici en double.
  try {
    return ((await lireMissions({ scope: 'partner' })) ?? []).map(rowToMission).map(stripInternalForPartner);
  } catch (e) {
    console.error('getMissionsForPartnerDB:', e);
    return [];
  }
}

// Retire d'une mission les champs réservés à l'usage interne (admin/cleaner) avant
// de l'exposer à un partenaire (hôte). Voir getMissionsForPartnerDB.
//
// Le pointage horaire (début, fin, durée réelle, GPS) ne sort JAMAIS d'ici : le
// temps de travail est une affaire entre l'entreprise et ses intervenants, elle
// pilote la paie. Le partenaire suit l'AVANCEMENT (statut + points de la
// checklist cochés), pas le chronomètre.
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

/**
 * Note d'un ménage par la conciergerie (1-5) + mot libre facultatif.
 * On vérifie `partner_id` côté requête : un partenaire ne peut noter que SES
 * ménages, même en forgeant un identifiant de mission.
 */
export async function rateMissionDB(
  missionId: string, _partnerId: string, rating: number, comment?: string,
): Promise<{ error: string | null }> {
  // Le partenaire est celui de la SESSION (côté serveur), pas celui annoncé ici.
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: 'Note attendue entre 1 et 5.' };
  const res = await ecrireMission({ action: 'rate', missionId, rating, comment });
  return { error: res.error };
}

// Missions ouvertes aux cleaners. On exclut celles DÉJÀ demandées par quelqu'un :
// tant que l'admin n'a pas tranché, elles ne doivent plus apparaître comme
// disponibles — sinon deux cleaners croient l'avoir décrochée.
export async function getPendingMissionsDB(): Promise<Mission[]> {
  try {
    return ((await lireMissions({ scope: 'open' })) ?? []).map(rowToMission);
  } catch (e) {
    console.error('getPendingMissionsDB:', e);
    return [];
  }
}

// Demandes en attente de décision (écran admin).
export async function getMissionRequestsDB(): Promise<Mission[]> {
  try {
    return ((await lireMissions({ scope: 'requests' })) ?? []).map(rowToMission);
  } catch (e) {
    console.error('getMissionRequestsDB:', e);
    return [];
  }
}

// Création d'une mission par un partenaire Airbnb : liée à un appartement,
// sans cleaner assigné (status 'pending' → « À assigner » côté admin).
export async function createAirbnbMissionDB(fields: {
  partnerId: string; partnerName?: string; airbnbId: string;
  dateFrom: string; timeFrom: string; instructions?: string; price?: number;
  nextArrival?: string; nextArrivalTime?: string;
}): Promise<{ error: string | null }> {
  // Prix et durée sont repris de la fiche logement par le serveur ; le logement
  // doit appartenir à la conciergerie connectée.
  const res = await ecrireMission({
    action: 'create-airbnb', airbnbId: fields.airbnbId, dateFrom: fields.dateFrom, timeFrom: fields.timeFrom,
    instructions: fields.instructions, nextArrival: fields.nextArrival, nextArrivalTime: fields.nextArrivalTime,
  });
  return { error: res.error };
}

export async function acceptMissionDB(missionId: string, _userId: string): Promise<{ error: string | null }> {
  // Le cleaner ne s'assigne pas la mission : il la DEMANDE, l'admin valide.
  // Prestation, formation obligatoire et « premier arrivé » : vérifiés côté serveur.
  const res = await ecrireMission({ action: 'request', missionId });
  return { error: res.error };
}

// Décision de l'admin sur une demande de mission.
export async function decideMissionRequestDB(missionId: string, approve: boolean): Promise<{ error: string | null }> {
  const res = await ecrireMission({ action: 'decide-request', missionId, approve });
  return { error: res.error };
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
  // Maison louée à la chambre : périmètre du ménage, identique à ce que produit
  // la synchro — une mission créée à la main doit être indiscernable des autres.
  coveredUnits?: string; wholeProperty?: boolean; coveredUnitNames?: string[];
}): Promise<{ error: string | null }> {
  // Le gain du cleaner est calculé par le serveur avec le taux EN BASE : les
  // taux transmis ici (cleanerHourlyRate…) ne sont plus pris en compte.
  const res = await ecrireMission({ action: 'create', fields });
  return { error: res.error };
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
  const res = await ecrireMission({ action: 'create-oneshot', fields });
  if (res.error) return { error: res.error, count: 0 };
  return { error: null, count: ((res.data?.ids as string[] | undefined) ?? []).length };
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
  const res = await ecrireMission({ action: 'create-batch', fields: params });
  if (res.error) return { error: res.error, count: 0 };
  return { error: null, count: ((res.data?.ids as string[] | undefined) ?? []).length };
}

// ── RENDEZ-VOUS (service = 'appointment') ───────────────────────────────────
// Personnes assignables à un rendez-vous : administrateurs (users.id) + cleaners
// actifs (cleaners.id). Le rôle permet à la création de router l'assignation
// (cleaner → cleaner_id, visible dans son planning ; admin → assignee_user_id).
export async function getAssignableStaffDB(): Promise<{ id: string; name: string; role: string }[]> {
  const cleaners = await getActiveCleanersDB();
  // Par le serveur : la table des comptes n'est plus lisible publiquement.
  let admins: { id: string; name: string }[] = [];
  try { admins = (await postServer('/api/annexes', { op: 'admins' })).data ?? []; }
  catch (e) { console.error('getAssignableStaffDB:', e); }
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
  // Cleaner assigné → son planning (cleaner_id) ; admin → assignee_user_id.
  const res = await ecrireMission({ action: 'create-appointment', fields });
  return { error: res.error };
}


export async function updateMissionStatusDB(id: string, status: MissionStatus, _actor?: MissionActor): Promise<void> {
  // Les notifications (annulée / terminée) partent du serveur.
  const res = await ecrireMission({ action: 'set-status', missionId: id, status });
  if (res.error) console.error('updateMissionStatusDB:', res.error);
}

export async function assignCleanerToMissionDB(missionId: string, cleanerId: string, cleanerName: string): Promise<void> {
  // Le gain du cleaner est recalculé côté serveur : taux horaire × durée. Il ne
  // se décide pas dans le navigateur.
  const res = await ecrireMission({ action: 'assign', missionId, cleanerId, cleanerName });
  if (res.error) await signalerEchecArgent('affectation', missionId, res.error);
}

// Ordre manuel des missions (par cleaner) fixé par l'admin. On persiste le rang
// `manual_order` de chaque mission ; le tri partagé (missionOrder.ts) l'applique
// à date égale, côté admin ET côté cleaner.
export async function updateMissionsOrderDB(orders: { id: string; order: number }[]): Promise<{ error: string | null }> {
  const res = await ecrireMission({ action: 'reorder', orders });
  if (res.error) console.error('updateMissionsOrderDB:', res.error);
  return { error: res.error };
}

// Assignation groupée d'un même cleaner à plusieurs missions (tournée par zone).
// Réutilise la logique unitaire → le gain de chaque mission est recalculé.
export async function assignCleanerToMissionsDB(missionIds: string[], cleanerId: string, cleanerName: string): Promise<void> {
  const res = await ecrireMission({ action: 'assign', missionIds, cleanerId, cleanerName });
  if (res.error) console.error('assignCleanerToMissionsDB:', res.error);
}

// ── TRANSFERT EN BLOC D'UN INTERVENANT À UN AUTRE ──────────────────────────────
// Un cleaner arrêté ou en congés : on reprend toutes ses missions à venir d'un
// geste. Le périmètre et le recalcul de la paie sont décidés côté serveur —
// cf. /api/missions action 'reassign' et lib/reassign.ts.

/** Ce qui serait transféré, sans rien changer. À montrer AVANT d'agir. */
export async function previewReassignCleanerDB(fromCleanerId: string): Promise<{
  nombre: number; premiere?: string; derniere?: string;
}> {
  const res = await ecrireMission({ action: 'reassign', fromCleanerId, apercu: true });
  if (res.error) { console.error('previewReassignCleanerDB:', res.error); return { nombre: 0 }; }
  const apercu = res.data?.apercu as { nombre: number; premiere?: string; derniere?: string } | undefined;
  return apercu ?? { nombre: 0 };
}

export async function reassignCleanerMissionsDB(
  fromCleanerId: string, toCleanerId: string,
): Promise<{ error: string | null; count: number }> {
  const res = await ecrireMission({ action: 'reassign', fromCleanerId, toCleanerId });
  if (res.error) return { error: res.error, count: 0 };
  return { error: null, count: Number(res.data?.count) || 0 };
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
  // Le cleaner ne peut agir que sur SA mission non clôturée (vérifié côté serveur).
  const res = await ecrireMission({
    action: 'extra-time-request', missionId: params.missionId, minutes, reason: params.reason, at: params.at,
  });
  return { error: res.error };
}

// Décision admin : approuver (ajoute le temps + recalcule le gain) ou refuser.
export async function resolveExtraTimeDB(
  missionId: string,
  approve: boolean,
  actor: MissionActor,
): Promise<{ error: string | null }> {
  if (actor.role !== 'admin') return { error: "Action réservée à l'administrateur." };
  // Approbation : la durée payée augmente, le gain est recalculé par le serveur.
  const res = await ecrireMission({ action: 'extra-time-resolve', missionId, approve });
  return { error: res.error };
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
  const res = await ecrireMission({ action: 'add-time', missionId, delta });
  return { error: res.error };
}

// ── POINTAGE AUTOMATIQUE (début / fin + géolocalisation) ────────────────────────
// Discret côté cleaner : il ne voit que « Démarrer » / « Terminer ». Le système
// enregistre l'heure et UNE position à chaque étape (pas de suivi continu), calcule
// la durée réelle à la fin et vérifie la proximité début ↔ fin. Données réservées
// à l'admin (temps réel, écart, statistiques).

// Démarrage : horodatage + statut « en cours » + position de départ (best-effort).
// Coordonnées de l'adresse d'une mission (via l'appartement lié). Null pour les
// missions hôtel (pas de géocodage) ou un appartement non géolocalisé.

// `at` = horodatage de l'action (ISO). En hors-ligne, l'action est capturée sur
// place puis rejouée plus tard : on enregistre l'heure du démarrage réel, pas celle
// du rejeu. Par défaut = maintenant (chemin en ligne classique).
export async function startMissionDB(
  missionId: string, _userId: string, coords?: GeoPoint | null, at?: string,
): Promise<{ error: string | null; tooFar?: boolean }> {
  // GPS OBLIGATOIRE pour le ménage (≤ 200 m de l'adresse) : contrôlé par le
  // serveur. Le cleaner est celui de la session.
  const res = await ecrireMission({ action: 'start', missionId, coords: coords ?? null, at });
  return { error: res.error, tooFar: res.data?.tooFar === true || undefined };
}

// Livraison : le livreur valide simplement « Livré » → mission terminée. Aucun
// pointage, aucun GPS, aucune étape de démarrage.
export async function markDeliveredDB(
  missionId: string, _userId: string, at?: string,
): Promise<{ error: string | null }> {
  const res = await ecrireMission({ action: 'deliver', missionId, at });
  return { error: res.error };
}

// Fin : vérifie la proximité (si les deux positions existent), calcule la durée
// réelle, horodate la fin et clôture la mission. Renvoie tooFar si trop éloigné.
export async function finishMissionDB(
  missionId: string, _userId: string, coords?: GeoPoint | null, at?: string,
): Promise<{ error: string | null; tooFar?: boolean }> {
  // Contrôle GPS, durée réelle et montants (hôtel) : tout se fait côté serveur.
  const res = await ecrireMission({ action: 'finish', missionId, coords: coords ?? null, at });
  if (res.error) return { error: res.error, tooFar: res.data?.tooFar === true || undefined };
  // La clôture est enregistrée ; un échec sur les montants ne la remet pas en cause.
  if (res.data?.argent) await signalerEchecArgent('clôture financière', missionId, String(res.data.argent));
  return { error: null };
}

// Désistement du cleaner : il renonce à SA mission non clôturée. La mission n'est
// NI annulée NI supprimée — le cleaner n'a pas ce pouvoir. Elle est simplement
// DÉTACHÉE de lui et repart dans le pool non assigné (statut 'pending'), à charge
// pour l'admin de la réattribuer ; l'admin est notifié.
// Garde atomique : impossible sur une mission déjà terminée/annulée, ou qui
// n'appartient pas au cleaner qui la demande.
export async function withdrawMissionDB(
  missionId: string, _userId: string,
): Promise<{ error: string | null }> {
  const res = await ecrireMission({ action: 'withdraw', missionId });
  return { error: res.error };
}

// Retrait par l'ADMIN : il reprend une mission à un cleaner et la remet au pot
// commun. Symétrique du désistement, mais dans l'autre sens — et le cleaner doit
// être prévenu, sinon il continue de compter dessus et se déplace pour rien.
// Interdit sur une mission terminée ou annulée : on ne réécrit pas le passé.
export async function unassignMissionDB(missionId: string): Promise<{ error: string | null }> {
  // Le cleaner retiré est prévenu par le serveur.
  const res = await ecrireMission({ action: 'unassign', missionId });
  return { error: res.error };
}


// ── MODIFICATION / SUPPRESSION SÉCURISÉES ──────────────────────────────────────
// La règle est appliquée ICI (logique métier = source de vérité), pas seulement
// dans l'UI : on relit le statut + le créateur en base avant toute mutation, on
// vérifie les droits, puis on applique une garde atomique au niveau de la requête
// (.not status in done/cancelled) pour bloquer toute course / contournement.

// Relit la mission pour l'autorisation. Tolère l'absence des colonnes created_by
// (migration_mission_owner.sql non encore appliquée) en retombant sur partner_id.

// Vérifie droits + statut. Renvoie un message d'erreur explicite si refusé.

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
  // Droits (admin ou créateur), verrouillage et recalcul de la paie : côté serveur.
  const res = await ecrireMission({ action: 'update', missionId, fields });
  if (res.error) return { error: res.error };
  if (res.data?.argent) await signalerEchecArgent('recalcul de la paie', missionId, String(res.data.argent));
  return { error: null };
}

/**
 * Signale bruyamment un échec sur un montant.
 *
 * Ces calculs se font côté serveur depuis le verrouillage. Si l'un échoue, la
 * mission est quand même enregistrée — on ne bloque pas un cleaner qui a fini
 * son ménage — mais le montant, lui, est faux. Une erreur dans la console du
 * navigateur ne serait vue par personne : celle-ci part dans Sentry, et se
 * découvre en minutes plutôt qu'au moment de la paie.
 */
async function signalerEchecArgent(quoi: string, missionId: string, message: string) {
  console.error(`${quoi}:`, message);
  try {
    const Sentry = await import('@sentry/nextjs');
    Sentry.captureException(new Error(`${quoi} — ${message}`), {
      tags: { area: 'argent', operation: quoi },
      extra: { missionId },
    });
  } catch { /* Sentry indisponible : la console reste le dernier recours */ }
}

// ── Suppression et affectation : par le serveur ──────────────────────────────
// Supprimer une mission efface une journée de planning ; assigner un cleaner
// écrit sa PAIE. Ces deux gestes ne passent plus par le navigateur : la route
// vérifie la session et les droits, et la base a retiré au rôle public le droit
// de supprimer et d'écrire les colonnes de paie
// (cf. supabase/migration_missions_verrouillage.sql).
async function ecrireMission(payload: Record<string, unknown>): Promise<{ error: string | null; data?: Record<string, unknown> }> {
  try {
    const res = await fetch('/api/missions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { error: res.ok ? null : String(data.error ?? 'Action impossible.'), data };
  } catch {
    return { error: 'Connexion impossible. Réessayez.' };
  }
}

export async function deleteMissionDB(
  missionId: string,
  _actor: MissionActor,
): Promise<{ error: string | null }> {
  // La notification part du serveur, AVANT la suppression.
  return ecrireMission({ action: 'delete', missionId });
}

// Admin : reprendre une mission terminée → la repasse « en cours » et efface la
// clôture (fin + durée réelle). Les compteurs (stats/compta/paie) la décomptent
// automatiquement puisqu'ils dérivent du statut courant.
export async function reopenMissionDB(missionId: string, actor: MissionActor): Promise<{ error: string | null }> {
  if (actor.role !== 'admin') return { error: "Action réservée à l'administrateur." };
  const res = await ecrireMission({ action: 'reopen', missionId });
  return { error: res.error };
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
  try {
    return (await lireMissions({ scope: 'ranking', period })) ?? [];
  } catch (e) {
    console.error('getMonthlyRankingDB:', e);
    return [];
  }
}

// ── PAYMENTS / FACTURATION / RÉSERVATIONS — déplacés dans ./db/billing & ./db/reservations
// (les fonctions partenaires sont dans ./db/partners) ───────────────────────────

// ── SYNCHRONISATION DES RÉSERVATIONS — déplacée dans ./db/reservations ───────────
// (STATS déplacées dans ./db/stats)
