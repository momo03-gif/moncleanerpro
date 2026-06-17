import { supabase, hashPassword } from './supabase';
import type { User, Mission, MissionStatus, MissionType, MissionSource, HotelAnnounce, AnnounceStatus, Apartment, Payment, CompanyInfo, InvoiceLine, InvoiceRecord, Role } from './types';
import { computeCleanerGain } from './pay';
import { clusterApartments } from './zones';
import {
  notifyPartnerCreatedMission, notifyCleanerNewMission, notifyMissionModified,
  notifyMissionCancelled, notifyMissionCompleted,
} from './notifications';

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

export async function loginUser(email: string, password: string): Promise<User | null> {
  const hash = await hashPassword(password);
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .eq('password_hash', hash)
    .single();

  if (error || !data) return null;
  if (data.role === 'cleaner' && data.status === 'inactive') return null;

  if (data.role === 'hotel') {
    const { data: hotel } = await supabase.from('hotels').select('status_account').eq('user_id', data.id).single();
    if (hotel?.status_account === 'pending' || hotel?.status_account === 'refused') return null;
  }

  if (data.role === 'airbnb') {
    const { data: partner } = await supabase.from('airbnb_partners').select('status_account').eq('user_id', data.id).single();
    if (partner?.status_account === 'pending' || partner?.status_account === 'refused') return null;
  }

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    password: '',
    role: data.role,
    phone: data.phone,
    isActive: data.status === 'active',
  };
}

// ── CLEANERS ──────────────────────────────────────────────────────────────────

// missions.cleaner_id is a FK to cleaners.id (NOT users.id)
// When we only have users.id (e.g. logged-in cleaner), resolve to cleaners.id
async function resolveToCleanerTableId(userId: string): Promise<string | null> {
  const { data } = await supabase.from('cleaners').select('id').eq('user_id', userId).single();
  return data?.id ?? null;
}

export async function getCleaners() {
  const { data: cleaners } = await supabase.from('cleaners').select('*').order('created_at');
  if (cleaners && cleaners.length > 0) return cleaners;

  // Fallback: get cleaners from users table directly
  const { data: users } = await supabase.from('users').select('*').eq('role', 'cleaner');
  return (users ?? []).map(u => ({
    id: u.id, user_id: u.id, name: u.name, email: u.email, phone: u.phone ?? null,
    hourly_rate: 0, status: u.status ?? 'active',
  }));
}

export async function getActiveCleanersDB() {
  const { data: cleaners } = await supabase.from('cleaners').select('*').eq('status', 'active');
  if (cleaners && cleaners.length > 0) return cleaners;

  // Fallback: get from users table — id = users.id, consistent with missions.cleaner_id
  const { data: users } = await supabase.from('users').select('*').eq('role', 'cleaner').eq('status', 'active');
  return (users ?? []).map(u => ({
    id: u.id, user_id: u.id, name: u.name, email: u.email, phone: u.phone ?? null,
    hourly_rate: 0, status: 'active',
  }));
}

export async function createCleaner(fields: {
  name: string; email: string; phone?: string;
  password: string; hourlyRate?: number;
}) {
  const hash = await hashPassword(fields.password || 'cleaner123');
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert({ email: fields.email, password_hash: hash, role: 'cleaner', name: fields.name, phone: fields.phone, status: 'active' })
    .select()
    .single();

  if (userError || !user) {
    console.error('createCleaner - users insert error:', userError);
    return;
  }

  const { error: cleanerError } = await supabase.from('cleaners').insert({
    user_id: user.id,
    name: fields.name,
    email: fields.email,
    phone: fields.phone ?? null,
    hourly_rate: fields.hourlyRate ?? 0,
    status: 'active',
  });

  if (cleanerError) {
    console.error('createCleaner - cleaners insert error:', cleanerError);
  }
}

export async function setCleanerActive(id: string, active: boolean) {
  await supabase.from('cleaners').update({ status: active ? 'active' : 'inactive' }).eq('id', id);
}

export async function updateCleanerInfoDB(id: string, fields: { name: string; email: string; phone?: string }) {
  const { error } = await supabase.from('cleaners').update({
    name: fields.name,
    email: fields.email,
    phone: fields.phone ?? null,
  }).eq('id', id);
  // Garde le compte de connexion (users) synchronisé
  const { data: c } = await supabase.from('cleaners').select('user_id').eq('id', id).single();
  const userId = c?.user_id ?? id;
  await supabase.from('users').update({
    name: fields.name,
    email: fields.email.toLowerCase().trim(),
    phone: fields.phone ?? null,
  }).eq('id', userId);
  return { error: error?.message ?? null };
}

export async function deleteCleanerDB(id: string) {
  // missions.cleaner_id est FK ON DELETE SET NULL → les missions sont conservées
  const { data: c } = await supabase.from('cleaners').select('user_id').eq('id', id).single();
  const userId = c?.user_id ?? id;
  await supabase.from('cleaners').delete().eq('id', id);
  await supabase.from('users').delete().eq('id', userId);
}

export async function updateCleanerHourlyRateDB(id: string, hourlyRate: number) {
  await supabase.from('cleaners').update({ hourly_rate: hourlyRate }).eq('id', id);
}

export async function updateCleanerPasswordDB(cleanerId: string, newPassword: string) {
  const hash = await hashPassword(newPassword);
  const { data: cleaner } = await supabase.from('cleaners').select('user_id').eq('id', cleanerId).single();
  if (cleaner?.user_id) {
    await supabase.from('users').update({ password_hash: hash }).eq('id', cleaner.user_id);
  } else {
    // Fallback: cleanerId might be users.id directly
    await supabase.from('users').update({ password_hash: hash }).eq('id', cleanerId);
  }
}

export async function getCleanerByUserId(userId: string) {
  const { data } = await supabase.from('cleaners').select('*').eq('user_id', userId).single();
  if (data) return data;
  // Fallback: return user row if no cleaners entry
  const { data: user } = await supabase.from('users').select('*').eq('id', userId).single();
  return user;
}

// ── AIRBNBS ───────────────────────────────────────────────────────────────────

function rowToApartment(a: any): Apartment {
  return {
    id: a.id,
    name: a.name,
    address: a.address,
    portalCode: a.code_portail,
    keyboxCode: a.code_boite,
    entryDirectives: a.entry_instructions ?? '',
    cleanerId: a.cleaner_id,
    cleanerName: a.cleaners?.name,
    clientPrice: a.client_price != null ? Number(a.client_price) : undefined,
    estimatedCleaningMinutes: a.estimated_cleaning_minutes != null ? Number(a.estimated_cleaning_minutes) : undefined,
    cleanerGain: 0,
    latitude: a.latitude != null ? Number(a.latitude) : undefined,
    longitude: a.longitude != null ? Number(a.longitude) : undefined,
    zoneId: a.zone_id ?? undefined,
    zoneColor: a.zone_color ?? undefined,
    zoneName: a.zone_name ?? undefined,
    partnerId: a.partner_id ?? undefined,
    partnerName: a.partner_name ?? undefined,
    bedrooms: a.bedrooms ?? undefined,
    beds: a.beds ?? undefined,
    sofaBeds: a.sofa_beds ?? undefined,
    notes: a.notes ?? undefined,
  };
}

export async function getAirbnbs(): Promise<Apartment[]> {
  const { data, error } = await supabase.from('airbnbs').select('*, cleaners(name)').order('created_at');
  if (error) console.error('getAirbnbs error:', error.code, error.message);
  return (data ?? []).map(rowToApartment);
}

// Appartements d'un partenaire Airbnb (avec compte) — filtrés par partner_id
export async function getAirbnbsForPartner(userId: string): Promise<Apartment[]> {
  const { data, error } = await supabase
    .from('airbnbs')
    .select('*, cleaners(name)')
    .eq('partner_id', userId)
    .order('created_at');
  if (error) console.error('getAirbnbsForPartner error:', error.code, error.message);
  return (data ?? []).map(rowToApartment);
}

export async function createAirbnb(fields: {
  name: string; address: string; portalCode?: string; keyboxCode?: string;
  entryDirectives: string; partnerId?: string; partnerName?: string;
  bedrooms?: number; beds?: number; sofaBeds?: number; clientPrice?: number;
  estimatedCleaningMinutes?: number; zoneColor?: string; zoneName?: string; notes?: string;
}): Promise<string | null> {
  const { data, error } = await supabase.from('airbnbs').insert({
    name: fields.name,
    address: fields.address,
    code_portail: fields.portalCode || null,
    code_boite: fields.keyboxCode || null,
    entry_instructions: fields.entryDirectives,
    partner_id: fields.partnerId || null,
    partner_name: fields.partnerName || null,
    bedrooms: fields.bedrooms ?? null,
    beds: fields.beds ?? null,
    sofa_beds: fields.sofaBeds ?? null,
    client_price: fields.clientPrice ?? null,
    estimated_cleaning_minutes: fields.estimatedCleaningMinutes ?? 60,
    zone_color: fields.zoneColor || null,
    zone_name: fields.zoneName || null,
    notes: fields.notes || null,
  }).select('id').single();
  if (error) { console.error('createAirbnb error:', error.code, error.message); return null; }
  return data?.id ?? null;
}

export async function updateAirbnb(id: string, fields: {
  name: string; address: string; portalCode?: string; keyboxCode?: string;
  entryDirectives: string; partnerName?: string;
  bedrooms?: number; beds?: number; sofaBeds?: number; clientPrice?: number;
  estimatedCleaningMinutes?: number; zoneColor?: string; zoneName?: string; notes?: string;
}) {
  const { error } = await supabase.from('airbnbs').update({
    name: fields.name,
    address: fields.address,
    code_portail: fields.portalCode || null,
    code_boite: fields.keyboxCode || null,
    entry_instructions: fields.entryDirectives,
    partner_name: fields.partnerName || null,
    bedrooms: fields.bedrooms ?? null,
    beds: fields.beds ?? null,
    sofa_beds: fields.sofaBeds ?? null,
    client_price: fields.clientPrice ?? null,
    estimated_cleaning_minutes: fields.estimatedCleaningMinutes ?? 60,
    zone_color: fields.zoneColor || null,
    zone_name: fields.zoneName || null,
    notes: fields.notes || null,
  }).eq('id', id);
  if (error) console.error('updateAirbnb error:', error.code, error.message);
  return { error: error?.message ?? null };
}

export async function deleteAirbnb(id: string) {
  const { error } = await supabase.from('airbnbs').delete().eq('id', id);
  if (error) console.error('deleteAirbnb error:', error.code, error.message);
}

export async function assignAirbnbCleaner(airbnbId: string, cleanerId: string | null) {
  await supabase.from('airbnbs').update({ cleaner_id: cleanerId }).eq('id', airbnbId);
}

// ── ZONES GÉOGRAPHIQUES ─────────────────────────────────────────────────────────

// Enregistre les coordonnées géocodées d'un appartement.
export async function setAirbnbCoordsDB(id: string, lat: number, lng: number) {
  const { error } = await supabase.from('airbnbs').update({ latitude: lat, longitude: lng }).eq('id', id);
  if (error) console.error('setAirbnbCoordsDB error:', error.code, error.message);
}

// Recalcule les zones de tous les appartements géolocalisés (clustering 2 km)
// et persiste zone_id / zone_color / zone_name. Renvoie le nombre de zones.
export async function regenerateZonesDB(): Promise<{ zones: number; assigned: number }> {
  const { data } = await supabase.from('airbnbs').select('id, latitude, longitude');
  const apts = (data ?? []).map((a: any) => ({
    id: a.id,
    latitude: a.latitude != null ? Number(a.latitude) : null,
    longitude: a.longitude != null ? Number(a.longitude) : null,
  }));
  const assignment = clusterApartments(apts);

  // Écrit chaque appartement (ceux sans coords sont remis à zone nulle).
  await Promise.all(apts.map(a => {
    const z = assignment.get(a.id);
    return supabase.from('airbnbs').update({
      zone_id: z?.zoneId ?? null,
      zone_color: z?.zoneColor ?? null,
      zone_name: z?.zoneName ?? null,
    }).eq('id', a.id);
  }));

  const zoneIds = new Set(Array.from(assignment.values()).map(z => z.zoneId));
  return { zones: zoneIds.size, assigned: assignment.size };
}

// ── MISSIONS ──────────────────────────────────────────────────────────────────

// Trim time to HH:mm (DB sometimes stores HH:mm:ss)
function trimTime(t: string | null | undefined): string {
  return (t ?? '').substring(0, 5);
}

// Sélection commune : on joint l'appartement lié pour les missions Airbnb
// afin d'en récupérer adresse + accès sans dupliquer l'info dans la mission.
const MISSION_SELECT = '*, airbnbs(name, address, code_portail, code_boite, entry_instructions, partner_name, notes, estimated_cleaning_minutes, zone_id, zone_color, zone_name)';

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
    price: Number(row.price) || 0,
    cleanerGain: Number(row.cleaner_gain) || 0,
    missionDurationMinutes: minutes,
    cleanerHourlyRateSnapshot: row.cleaner_hourly_rate_snapshot != null ? Number(row.cleaner_hourly_rate_snapshot) : undefined,
    apartmentDefaultDurationSnapshot: row.apartment_default_duration_snapshot != null ? Number(row.apartment_default_duration_snapshot) : undefined,
    // Zone dérivée de l'appartement lié (join), toujours à jour.
    zoneId: apt?.zone_id ?? undefined,
    zoneColor: apt?.zone_color ?? undefined,
    zoneName: apt?.zone_name ?? undefined,
    type: (row.type as MissionType) ?? 'regular',
    source: (row.source as MissionSource) ?? 'hotel',
    requestedBy: row.client_name,
    notes,
    instructionsRaw: row.instructions ?? undefined,
    partnerId: row.partner_id ?? undefined,
    partnerName: row.airbnbs?.partner_name ?? undefined,
    airbnbId: row.airbnb_id ?? undefined,
    nextArrival: row.next_arrival ?? undefined,
    nextArrivalTime: row.next_arrival_time ? trimTime(row.next_arrival_time) : undefined,
    createdAt: row.created_at ?? undefined,
  };
}

function mapMissionStatus(s: string): MissionStatus {
  const map: Record<string, MissionStatus> = {
    pending: 'pending',
    assigned: 'accepted',
    validated: 'validated',
    inprogress: 'in_progress',
    done: 'completed',
    cancelled: 'cancelled',
  };
  return map[s] ?? 'pending';
}

export async function getMissionsDB(): Promise<Mission[]> {
  const { data, error } = await supabase.from('missions').select(MISSION_SELECT).order('date_from', { ascending: false });
  if (error) console.error('getMissionsDB error:', error.code, error.message);
  return (data ?? []).map(rowToMission);
}

export async function getMissionsForCleanerDB(userId: string): Promise<Mission[]> {
  // missions.cleaner_id is a FK to cleaners.id — resolve users.id → cleaners.id
  const cleanerTableId = await resolveToCleanerTableId(userId);
  if (!cleanerTableId) return [];

  const { data, error } = await supabase
    .from('missions')
    .select(MISSION_SELECT)
    .eq('cleaner_id', cleanerTableId)
    .order('date_from', { ascending: false });
  if (error) console.error('getMissionsForCleanerDB:', error.code, error.message);
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
  return (data ?? []).map(rowToMission);
}

export async function getPendingMissionsDB(): Promise<Mission[]> {
  const { data } = await supabase.from('missions').select(MISSION_SELECT).eq('status', 'pending').order('date_from');
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

export async function acceptMissionDB(missionId: string, userId: string): Promise<void> {
  // userId is users.id — resolve to cleaners.id (FK constraint)
  const { data: cleanerRow } = await supabase.from('cleaners').select('id, name').eq('user_id', userId).single();
  if (!cleanerRow) return;
  await supabase.from('missions').update({
    cleaner_id: cleanerRow.id,
    cleaner_name: cleanerRow.name,
    status: 'assigned',
  }).eq('id', missionId);
}

export async function createMissionDB(fields: {
  type: string; source: string; propertyName: string; address: string;
  dateFrom: string; timeTo: string; timeFrom: string;
  missionDurationMinutes: number; cleanerHourlyRate?: number; apartmentDefaultDuration?: number;
  cleanerId?: string; cleanerName?: string; clientName?: string;
  price: number; instructions?: string;
  airbnbId?: string; partnerId?: string;
  nextArrival?: string; nextArrivalTime?: string;
  createdBy?: string; createdByRole?: string;
}): Promise<{ error: string | null }> {
  // cleanerId from the form is already cleaners.id (from the cleaner dropdown)
  const cleanerIdToStore: string | null = fields.cleanerId || null;
  // Quand la mission est liée à un appartement, on ne duplique pas
  // nom/adresse : ils sont récupérés depuis la fiche appartement (join).
  const linked = !!fields.airbnbId;

  // Paiement cleaner : taux horaire × durée / 60 (indépendant du prix client).
  const minutes = Number(fields.missionDurationMinutes) || 0;
  const rate = Number(fields.cleanerHourlyRate) || 0;
  const gain = cleanerIdToStore ? computeCleanerGain(rate, minutes) : 0;

  const { data, error } = await supabase.from('missions').insert({
    type: fields.type,
    source: fields.source,
    airbnb_id: fields.airbnbId || null,
    partner_id: fields.partnerId || null,
    created_by: fields.createdBy || null,
    created_by_role: fields.createdByRole || 'admin',
    property_name: linked ? null : fields.propertyName,
    address: linked ? null : fields.address,
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

// Maps app-level MissionStatus → DB status string
function toDbMissionStatus(appStatus: MissionStatus): string {
  const map: Record<MissionStatus, string> = {
    pending: 'pending',
    accepted: 'assigned',
    validated: 'validated',
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
    supabase.from('cleaners').select('hourly_rate').eq('id', cleanerId).single(),
    supabase.from('missions').select('mission_duration_minutes, apartment_default_duration_snapshot, airbnbs(estimated_cleaning_minutes)').eq('id', missionId).single(),
  ]);
  const rate = Number(cleaner?.hourly_rate) || 0;
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
    cleaner_gain: computeCleanerGain(rate, minutes),
    cleaner_hourly_rate_snapshot: rate,
    mission_duration_minutes: minutes,
    apartment_default_duration_snapshot: aptDefault != null ? Number(aptDefault) : null,
    hours_worked: Math.round((minutes / 60) * 100) / 100,
  }).eq('id', missionId);
  // Notif cleaner : nouvelle mission
  await notifyCleanerNewMission(missionId);
}

// Assignation groupée d'un même cleaner à plusieurs missions (tournée par zone).
// Réutilise la logique unitaire → le gain de chaque mission est recalculé.
export async function assignCleanerToMissionsDB(missionIds: string[], cleanerId: string, cleanerName: string): Promise<void> {
  for (const id of missionIds) {
    await assignCleanerToMissionDB(id, cleanerId, cleanerName);
  }
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

  // 1) Statut verrouillé (terminée / annulée) → refus, quel que soit le rôle
  const appStatus = mapMissionStatus(row.status);
  if (isMissionLocked(appStatus)) {
    return { ok: false, error: missionLockMessage(appStatus, action) };
  }

  // 2) Droits : admin autorisé ; sinon doit être le créateur de la mission
  const isAdmin = actor.role === 'admin';
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
    // Déclenché si l'admin change le cleaner, l'appartement ou la durée.
    // gain = taux horaire du cleaner × durée de la mission / 60.
    const touchesPay = fields.cleanerId !== undefined
      || fields.airbnbId !== undefined
      || fields.missionDurationMinutes !== undefined;
    if (touchesPay) {
      const { data: current } = await supabase
        .from('missions')
        .select('cleaner_id, mission_duration_minutes, apartment_default_duration_snapshot')
        .eq('id', missionId).single();

      const cleanerId = fields.cleanerId !== undefined ? fields.cleanerId : current?.cleaner_id;

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
          .select('hourly_rate').eq('id', cleanerId).single();
        const rate = Number(cleaner?.hourly_rate) || 0;
        patch.cleaner_gain = computeCleanerGain(rate, minutes);
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

  const { data, error } = await supabase
    .from('missions')
    .delete()
    .eq('id', missionId)
    .not('status', 'in', '(done,cancelled)')
    .select('id');

  if (error) return { error: error.message };
  if (!data || data.length === 0) {
    return { error: 'Cette mission est clôturée et ne peut plus être supprimée.' };
  }
  return { error: null };
}

// ── CLEANER AVAILABILITY ──────────────────────────────────────────────────────

export async function updateCleanerStatusDB(userId: string, status: 'available' | 'busy' | 'offline'): Promise<boolean> {
  const { data: cleaner } = await supabase.from('cleaners').select('id').eq('user_id', userId).single();
  if (cleaner) {
    const { error } = await supabase.from('cleaners').update({ status }).eq('id', cleaner.id);
    return !error;
  }
  // Fallback: try by id directly (when cleaners table uses users.id)
  const { error } = await supabase.from('cleaners').update({ status }).eq('id', userId);
  return !error;
}

export async function updateCleanerAvailableDaysDB(userId: string, days: string[]): Promise<boolean> {
  const { data: cleaner } = await supabase.from('cleaners').select('id').eq('user_id', userId).single();
  const targetId = cleaner?.id ?? userId;
  const { error } = await supabase.from('cleaners').update({ available_days: days }).eq('id', targetId);
  if (error) console.warn('updateCleanerAvailableDaysDB:', error.message);
  return !error;
}

// ── HOTEL REQUESTS ────────────────────────────────────────────────────────────

function rowToAnnounce(row: any): HotelAnnounce {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    hotelName: row.hotel_name ?? '',
    type: row.type_prestation as any,
    date: row.date_from ?? '',
    dateEnd: row.date_to ?? undefined,
    timeStart: trimTime(row.time_from),
    timeEnd: trimTime(row.time_to),
    guestCount: row.persons ?? 1,
    instructions: row.instructions ?? undefined,
    status: row.status as AnnounceStatus,
    cleanerId: row.cleaner_id ?? undefined,
    cleanerName: row.cleaner_name ?? undefined,
  };
}

export async function getHotelRequestsDB(): Promise<HotelAnnounce[]> {
  const { data } = await supabase.from('hotel_requests').select('*').order('created_at', { ascending: false });
  return (data ?? []).map(rowToAnnounce);
}

export async function getHotelRequestsForHotelDB(hotelId: string): Promise<HotelAnnounce[]> {
  const { data } = await supabase.from('hotel_requests').select('*').eq('hotel_id', hotelId).order('created_at', { ascending: false });
  return (data ?? []).map(rowToAnnounce);
}

export async function createHotelRequestDB(fields: {
  hotelId: string; hotelName: string; type: string;
  dateFrom: string; dateTo: string; timeFrom: string; timeTo: string;
  persons: number; instructions?: string;
}) {
  const { error } = await supabase.from('hotel_requests').insert({
    hotel_id: fields.hotelId,
    hotel_name: fields.hotelName,
    type_prestation: fields.type,
    date_from: fields.dateFrom,
    date_to: fields.dateTo,
    time_from: fields.timeFrom,
    time_to: fields.timeTo,
    persons: fields.persons,
    instructions: fields.instructions || null,
    status: 'pending',
  });
  if (error) { console.error('createHotelRequestDB error:', error); return; }
  // Notif admin : nouvelle mission créée par un hôtel
  await notifyPartnerCreatedMission(fields.hotelName, fields.dateFrom, fields.timeFrom, null);
}

export async function validateRequestDB(id: string, cleanerId: string, cleanerName: string) {
  const { data: req } = await supabase.from('hotel_requests').select('*').eq('id', id).single();

  await supabase.from('hotel_requests').update({
    status: 'validated',
    cleaner_id: cleanerId,
    cleaner_name: cleanerName,
  }).eq('id', id);

  if (req) {
    // Gain cleaner = taux horaire du cleaner × durée (par défaut 2 h = 120 min) / 60.
    const { data: cleaner } = await supabase.from('cleaners').select('hourly_rate').eq('id', cleanerId).single();
    const minutes = 120;
    const rate = Number(cleaner?.hourly_rate) || 0;
    const gain = computeCleanerGain(rate, minutes);

    // Créateur = l'hôtel (pour la notif « mission terminée » au client)
    const { data: hotel } = await supabase.from('hotels').select('user_id').eq('id', req.hotel_id).single();

    // cleanerId is cleaners.id (from dropdown) — store directly (FK to cleaners.id)
    const { data: created, error } = await supabase.from('missions').insert({
      type: req.type_prestation ?? 'regular',
      source: 'hotel',
      created_by: hotel?.user_id ?? null,
      created_by_role: 'hotel',
      property_name: req.hotel_name ?? '',
      address: '',
      date_from: req.date_from,
      time_from: req.time_from || null,
      time_to: req.time_to || null,
      hours_worked: minutes / 60,
      mission_duration_minutes: minutes,
      cleaner_id: cleanerId,
      cleaner_name: cleanerName,
      client_name: req.hotel_name ?? '',
      price: 0,  // prix CLIENT hôtel géré par ailleurs (facturation) — pas le gain cleaner
      cleaner_gain: gain,
      cleaner_hourly_rate_snapshot: rate,
      instructions: req.instructions ?? null,
      status: 'assigned',
    }).select('id').single();

    if (error) console.error('validateRequestDB - mission insert error:', error);
    // Notif cleaner : nouvelle mission
    else if (created?.id) await notifyCleanerNewMission(created.id);
  }
}

export async function refuseRequestDB(id: string) {
  await supabase.from('hotel_requests').update({ status: 'refused' }).eq('id', id);
}

// ── HOTELS / ACCOUNTS ─────────────────────────────────────────────────────────

export async function getPendingHotelsDB() {
  const { data } = await supabase.from('hotels').select('*, users(name, email, phone)').eq('status_account', 'pending');
  return (data ?? []).map((h: any) => ({
    id: h.id,
    name: h.hotel_name,
    address: h.address,
    email: h.email ?? h.users?.email,
    phone: h.phone ?? h.users?.phone,
    userId: h.user_id,
  }));
}

export async function approveHotelDB(id: string) {
  await supabase.from('hotels').update({ status_account: 'approved' }).eq('id', id);
  const { data } = await supabase.from('hotels').select('user_id').eq('id', id).single();
  if (data?.user_id) await supabase.from('users').update({ status: 'active' }).eq('id', data.user_id);
}

export async function refuseHotelDB(id: string) {
  await supabase.from('hotels').update({ status_account: 'refused' }).eq('id', id);
}

export async function registerHotelDB(fields: {
  name: string; address: string; email: string; phone: string; password: string;
}) {
  const hash = await hashPassword(fields.password);
  const { data: user, error } = await supabase
    .from('users')
    .insert({ email: fields.email.toLowerCase(), password_hash: hash, role: 'hotel', name: fields.name, phone: fields.phone, status: 'pending' })
    .select()
    .single();

  if (error || !user) throw new Error(error?.message ?? 'Erreur lors de la création du compte');

  await supabase.from('hotels').insert({
    user_id: user.id,
    hotel_name: fields.name,
    address: fields.address,
    email: fields.email,
    phone: fields.phone,
    status_account: 'pending',
  });
}

export async function getApprovedHotelsDB() {
  const { data } = await supabase.from('hotels').select('*').eq('status_account', 'approved').order('hotel_name');
  return data ?? [];
}

export async function getHotelByUserId(userId: string) {
  const { data } = await supabase.from('hotels').select('*').eq('user_id', userId).single();
  return data;
}

// ── AIRBNB PARTNERS (comptes) ──────────────────────────────────────────────────

export async function registerAirbnbPartnerDB(fields: {
  name: string; email: string; phone: string; password: string;
}) {
  const hash = await hashPassword(fields.password);
  const { data: user, error } = await supabase
    .from('users')
    .insert({ email: fields.email.toLowerCase(), password_hash: hash, role: 'airbnb', name: fields.name, phone: fields.phone, status: 'pending' })
    .select()
    .single();

  if (error || !user) throw new Error(error?.message ?? 'Erreur lors de la création du compte');

  const { error: pErr } = await supabase.from('airbnb_partners').insert({
    user_id: user.id,
    partner_name: fields.name,
    email: fields.email,
    phone: fields.phone,
    status_account: 'pending',
  });
  if (pErr) throw new Error(pErr.message);
}

export async function getAirbnbPartnerByUserId(userId: string) {
  const { data } = await supabase.from('airbnb_partners').select('*').eq('user_id', userId).single();
  return data;
}

export async function getPendingAirbnbPartnersDB() {
  const { data } = await supabase.from('airbnb_partners').select('*, users(name, email, phone)').eq('status_account', 'pending');
  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.partner_name,
    email: p.email ?? p.users?.email,
    phone: p.phone ?? p.users?.phone,
    userId: p.user_id,
    partnerKind: 'airbnb' as const,
  }));
}

export async function approveAirbnbPartnerDB(id: string) {
  await supabase.from('airbnb_partners').update({ status_account: 'approved' }).eq('id', id);
  const { data } = await supabase.from('airbnb_partners').select('user_id').eq('id', id).single();
  if (data?.user_id) await supabase.from('users').update({ status: 'active' }).eq('id', data.user_id);
}

export async function refuseAirbnbPartnerDB(id: string) {
  await supabase.from('airbnb_partners').update({ status_account: 'refused' }).eq('id', id);
}

// Liste des noms de partenaires connus (comptes + libellés saisis sur les apparts)
// — utile pour proposer une auto-complétion côté admin.
export async function getPartnerNamesDB(): Promise<string[]> {
  const [{ data: partners }, { data: apts }] = await Promise.all([
    supabase.from('airbnb_partners').select('partner_name').eq('status_account', 'approved'),
    supabase.from('airbnbs').select('partner_name'),
  ]);
  const names = new Set<string>();
  (partners ?? []).forEach((p: any) => p.partner_name && names.add(p.partner_name));
  (apts ?? []).forEach((a: any) => a.partner_name && names.add(a.partner_name));
  return Array.from(names).sort();
}

// ── PAYMENTS ──────────────────────────────────────────────────────────────────

export async function getPaymentsDB(): Promise<Payment[]> {
  const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
  return (data ?? []).map(p => ({
    id: p.id,
    cleanerId: p.cleaner_id,
    cleanerName: p.cleaner_name ?? '',
    amount: Number(p.amount),
    missionIds: p.missions_ids ?? [],
    date: p.paid_at ?? p.created_at?.split('T')[0] ?? '',
    month: p.period ?? '',
  }));
}

export async function createPaymentDB(fields: {
  cleanerId: string; cleanerName: string; amount: number; missionIds: string[]; month: string;
}) {
  await supabase.from('payments').insert({
    cleaner_id: fields.cleanerId,
    cleaner_name: fields.cleanerName,
    amount: fields.amount,
    missions_ids: fields.missionIds,
    period: fields.month,
    status: 'paid',
    paid_at: new Date().toISOString().split('T')[0],
  });
}

// ── FACTURATION (infos société + historique) ───────────────────────────────────

export async function getCompanyInfoDB(): Promise<CompanyInfo> {
  const { data, error } = await supabase.from('company_info').select('*').eq('id', 1).single();
  if (error || !data) return {};
  return {
    name: data.name ?? undefined,
    address: data.address ?? undefined,
    siret: data.siret ?? undefined,
    vat: data.vat ?? undefined,
    email: data.email ?? undefined,
    phone: data.phone ?? undefined,
    iban: data.iban ?? undefined,
    bic: data.bic ?? undefined,
  };
}

export async function saveCompanyInfoDB(fields: CompanyInfo): Promise<{ error: string | null }> {
  const { error } = await supabase.from('company_info').upsert({
    id: 1,
    name: fields.name || null,
    address: fields.address || null,
    siret: fields.siret || null,
    vat: fields.vat || null,
    email: fields.email || null,
    phone: fields.phone || null,
    iban: fields.iban || null,
    bic: fields.bic || null,
    updated_at: new Date().toISOString(),
  });
  return { error: error?.message ?? null };
}

function rowToInvoice(r: any): InvoiceRecord {
  return {
    id: r.id,
    number: r.number ?? '',
    partnerLabel: r.partner_label ?? '',
    partnerType: r.partner_type ?? '',
    periodFrom: r.period_from ?? '',
    periodTo: r.period_to ?? '',
    total: Number(r.total) || 0,
    lines: Array.isArray(r.lines) ? r.lines : [],
    status: r.status ?? 'issued',
    createdAt: r.created_at ?? '',
  };
}

export async function getInvoicesDB(): Promise<InvoiceRecord[]> {
  const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
  if (error) console.error('getInvoicesDB error:', error.code, error.message);
  return (data ?? []).map(rowToInvoice);
}

export async function saveInvoiceDB(fields: {
  number: string; partnerLabel: string; partnerType: string;
  periodFrom: string; periodTo: string; total: number; lines: InvoiceLine[];
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('invoices').insert({
    number: fields.number,
    partner_label: fields.partnerLabel,
    partner_type: fields.partnerType,
    period_from: fields.periodFrom,
    period_to: fields.periodTo,
    total: fields.total,
    lines: fields.lines,
    status: 'issued',
  });
  return { error: error?.message ?? null };
}

// ── STATS ─────────────────────────────────────────────────────────────────────

export async function getStatsDB() {
  const [{ data: missions }, { data: cleaners }, { data: hotels }] = await Promise.all([
    supabase.from('missions').select('*'),
    supabase.from('cleaners').select('*'),
    supabase.from('hotels').select('status_account'),
  ]);

  const completed = (missions ?? []).filter(m => m.status === 'done');
  const totalRevenue = completed.reduce((s: number, m: any) => s + (m.price ?? 0), 0);
  const totalSalaries = completed.reduce((s: number, m: any) => s + (m.cleaner_gain ?? 0), 0);

  return {
    totalMissions: (missions ?? []).length,
    completedMissions: completed.length,
    totalRevenue,
    totalSalaries,
    netProfit: totalRevenue - totalSalaries,
    activeCleaners: (cleaners ?? []).filter((c: any) => c.status === 'active').length,
    approvedHotels: (hotels ?? []).filter((h: any) => h.status_account === 'approved').length,
  };
}
