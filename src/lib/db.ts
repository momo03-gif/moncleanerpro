import { supabase, hashPassword } from './supabase';
import type { User, Mission, MissionStatus, MissionType, MissionSource, HotelAnnounce, AnnounceStatus, Apartment, Payment } from './types';

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
    hourly_rate_hotel: 0, rate_airbnb: 0, status: u.status ?? 'active',
  }));
}

export async function getActiveCleanersDB() {
  const { data: cleaners } = await supabase.from('cleaners').select('*').eq('status', 'active');
  if (cleaners && cleaners.length > 0) return cleaners;

  // Fallback: get from users table — id = users.id, consistent with missions.cleaner_id
  const { data: users } = await supabase.from('users').select('*').eq('role', 'cleaner').eq('status', 'active');
  return (users ?? []).map(u => ({
    id: u.id, user_id: u.id, name: u.name, email: u.email, phone: u.phone ?? null,
    hourly_rate_hotel: 0, rate_airbnb: 0, status: 'active',
  }));
}

export async function createCleaner(fields: {
  name: string; email: string; phone?: string;
  password: string; hourlyRateHotel?: number; rateAirbnb?: number;
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
    hourly_rate_hotel: fields.hourlyRateHotel ?? 0,
    rate_airbnb: fields.rateAirbnb ?? 0,
    status: 'active',
  });

  if (cleanerError) {
    console.error('createCleaner - cleaners insert error:', cleanerError);
  }
}

export async function setCleanerActive(id: string, active: boolean) {
  await supabase.from('cleaners').update({ status: active ? 'active' : 'inactive' }).eq('id', id);
}

export async function updateCleanerRatesDB(id: string, hotelRate: number, airbnbRate: number) {
  await supabase.from('cleaners').update({ hourly_rate_hotel: hotelRate, rate_airbnb: airbnbRate }).eq('id', id);
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
    clientPrice: 0,
    cleanerGain: 0,
    partnerId: a.partner_id ?? undefined,
    partnerName: a.partner_name ?? undefined,
    bedrooms: a.bedrooms ?? undefined,
    beds: a.beds ?? undefined,
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
  bedrooms?: number; beds?: number; notes?: string;
}) {
  const { error } = await supabase.from('airbnbs').insert({
    name: fields.name,
    address: fields.address,
    code_portail: fields.portalCode || null,
    code_boite: fields.keyboxCode || null,
    entry_instructions: fields.entryDirectives,
    partner_id: fields.partnerId || null,
    partner_name: fields.partnerName || null,
    bedrooms: fields.bedrooms ?? null,
    beds: fields.beds ?? null,
    notes: fields.notes || null,
  });
  if (error) console.error('createAirbnb error:', error.code, error.message);
}

export async function updateAirbnb(id: string, fields: {
  name: string; address: string; portalCode?: string; keyboxCode?: string;
  entryDirectives: string; partnerName?: string;
  bedrooms?: number; beds?: number; notes?: string;
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

// ── MISSIONS ──────────────────────────────────────────────────────────────────

// Trim time to HH:mm (DB sometimes stores HH:mm:ss)
function trimTime(t: string | null | undefined): string {
  return (t ?? '').substring(0, 5);
}

// Sélection commune : on joint l'appartement lié pour les missions Airbnb
// afin d'en récupérer adresse + accès sans dupliquer l'info dans la mission.
const MISSION_SELECT = '*, airbnbs(name, address, code_portail, code_boite, entry_instructions)';

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
    if (row.instructions) parts.push(row.instructions); // consignes ajoutées par le partenaire
    notes = parts.length > 0 ? parts.join(' · ') : undefined;
  }

  return {
    id: row.id,
    property,
    address,
    date: row.date_from ?? '',
    time: trimTime(row.time_from),
    duration: Number(row.hours_worked) || 0,
    status: mapMissionStatus(row.status),
    cleanerId: row.cleaner_id,
    cleanerName: row.cleaner_name,
    price: Number(row.price) || 0,
    cleanerGain: Number(row.cleaner_gain) || 0,
    type: (row.type as MissionType) ?? 'regular',
    source: (row.source as MissionSource) ?? 'hotel',
    requestedBy: row.client_name,
    notes,
    partnerId: row.partner_id ?? undefined,
    airbnbId: row.airbnb_id ?? undefined,
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
  partnerId: string; airbnbId: string;
  dateFrom: string; timeFrom: string; instructions?: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('missions').insert({
    type: 'regular',
    source: 'airbnb',
    partner_id: fields.partnerId,
    airbnb_id: fields.airbnbId,
    date_from: fields.dateFrom,
    time_from: fields.timeFrom || null,
    instructions: fields.instructions || null,
    status: 'pending',
  });
  if (error) {
    console.error('createAirbnbMissionDB error:', error);
    return { error: error.message };
  }
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
  dateFrom: string; timeTo: string; timeFrom: string; duration: number;
  cleanerId?: string; cleanerName?: string; clientName?: string;
  price: number; cleanerGain: number; instructions?: string;
  airbnbId?: string; partnerId?: string;
}): Promise<{ error: string | null }> {
  // cleanerId from the form is already cleaners.id (from the cleaner dropdown)
  const cleanerIdToStore: string | null = fields.cleanerId || null;
  // Quand la mission est liée à un appartement, on ne duplique pas
  // nom/adresse : ils sont récupérés depuis la fiche appartement (join).
  const linked = !!fields.airbnbId;

  const { error } = await supabase.from('missions').insert({
    type: fields.type,
    source: fields.source,
    airbnb_id: fields.airbnbId || null,
    partner_id: fields.partnerId || null,
    property_name: linked ? null : fields.propertyName,
    address: linked ? null : fields.address,
    date_from: fields.dateFrom,
    time_from: fields.timeFrom || null,
    time_to: fields.timeTo || null,
    hours_worked: fields.duration,
    cleaner_id: cleanerIdToStore,
    cleaner_name: fields.cleanerName || null,
    client_name: fields.clientName || null,
    price: fields.price,
    cleaner_gain: fields.cleanerGain,
    instructions: fields.instructions || null,
    status: cleanerIdToStore ? 'assigned' : 'pending',
  });

  if (error) {
    console.error('createMissionDB error:', error);
    return { error: error.message };
  }
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

export async function updateMissionStatusDB(id: string, status: MissionStatus): Promise<void> {
  await supabase.from('missions').update({ status: toDbMissionStatus(status) }).eq('id', id);
}

export async function assignCleanerToMissionDB(missionId: string, cleanerId: string, cleanerName: string, gain?: number): Promise<void> {
  // cleanerId is already cleaners.id (from the dropdown) — store directly
  const patch: Record<string, unknown> = {
    cleaner_id: cleanerId,
    cleaner_name: cleanerName,
    status: 'assigned',
  };
  // Renseigne le gain cleaner s'il n'avait pas été fixé (missions créées par un partenaire)
  if (gain != null && gain > 0) patch.cleaner_gain = gain;
  await supabase.from('missions').update(patch).eq('id', missionId);
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
  if (error) console.error('createHotelRequestDB error:', error);
}

export async function validateRequestDB(id: string, cleanerId: string, cleanerName: string) {
  const { data: req } = await supabase.from('hotel_requests').select('*').eq('id', id).single();

  await supabase.from('hotel_requests').update({
    status: 'validated',
    cleaner_id: cleanerId,
    cleaner_name: cleanerName,
  }).eq('id', id);

  if (req) {
    // Gain cleaner = tarif horaire hôtel × durée (par défaut 2h)
    const { data: cleaner } = await supabase.from('cleaners').select('hourly_rate_hotel').eq('id', cleanerId).single();
    const hours = 2;
    const gain = (Number(cleaner?.hourly_rate_hotel) || 0) * hours;

    // cleanerId is cleaners.id (from dropdown) — store directly (FK to cleaners.id)
    const { error } = await supabase.from('missions').insert({
      type: req.type_prestation ?? 'regular',
      source: 'hotel',
      property_name: req.hotel_name ?? '',
      address: '',
      date_from: req.date_from,
      time_from: req.time_from || null,
      time_to: req.time_to || null,
      hours_worked: hours,
      cleaner_id: cleanerId,
      cleaner_name: cleanerName,
      client_name: req.hotel_name ?? '',
      price: 0,
      cleaner_gain: gain,
      instructions: req.instructions ?? null,
      status: 'assigned',
    });

    if (error) console.error('validateRequestDB - mission insert error:', error);
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
