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

// Resolve cleaners.id → users.id (missions.cleaner_id must always be users.id)
async function resolveToUserId(cleanerTableId: string): Promise<string> {
  const { data } = await supabase.from('cleaners').select('user_id').eq('id', cleanerTableId).single();
  return data?.user_id ?? cleanerTableId;
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

export async function getAirbnbs() {
  const { data } = await supabase.from('airbnbs').select('*, cleaners(name)').order('created_at');
  return (data ?? []).map(a => ({
    id: a.id,
    name: a.name,
    address: a.address,
    portalCode: a.code_portail,
    keyboxCode: a.code_boite,
    entryDirectives: a.entry_instructions ?? '',
    cleanerId: a.cleaner_id,
    cleanerName: a.cleaners?.name,
  })) as Apartment[];
}

export async function createAirbnb(fields: {
  name: string; address: string; portalCode?: string; keyboxCode?: string; entryDirectives: string;
}) {
  await supabase.from('airbnbs').insert({
    name: fields.name,
    address: fields.address,
    code_portail: fields.portalCode || null,
    code_boite: fields.keyboxCode || null,
    entry_instructions: fields.entryDirectives,
  });
}

export async function assignAirbnbCleaner(airbnbId: string, cleanerId: string | null) {
  await supabase.from('airbnbs').update({ cleaner_id: cleanerId }).eq('id', airbnbId);
}

// ── MISSIONS ──────────────────────────────────────────────────────────────────

function rowToMission(row: any): Mission {
  return {
    id: row.id,
    property: row.property_name ?? '',
    address: row.address ?? '',
    date: row.date_from ?? '',
    time: row.time_from ?? '',
    duration: Number(row.hours_worked) || 0,
    status: mapMissionStatus(row.status),
    cleanerId: row.cleaner_id,
    cleanerName: row.cleaner_name,
    price: Number(row.price) || 0,
    cleanerGain: Number(row.cleaner_gain) || 0,
    type: (row.type as MissionType) ?? 'regular',
    source: (row.source as MissionSource) ?? 'hotel',
    requestedBy: row.client_name,
    notes: row.instructions,
  };
}

function mapMissionStatus(s: string): MissionStatus {
  const map: Record<string, MissionStatus> = {
    pending: 'pending', assigned: 'accepted', inprogress: 'in_progress', done: 'completed', cancelled: 'cancelled',
  };
  return map[s] ?? 'pending';
}

export async function getMissionsDB(): Promise<Mission[]> {
  const { data } = await supabase.from('missions').select('*').order('date_from', { ascending: false });
  return (data ?? []).map(rowToMission);
}

export async function getMissionsForCleanerDB(userId: string): Promise<Mission[]> {
  // PRIMARY: missions.cleaner_id should now be users.id
  const { data: direct } = await supabase
    .from('missions')
    .select('*')
    .eq('cleaner_id', userId)
    .order('date_from', { ascending: false });

  // FALLBACK: old missions might have stored cleaners.id instead of users.id
  const { data: cleanerRow } = await supabase.from('cleaners').select('id').eq('user_id', userId).single();
  const { data: indirect } = cleanerRow
    ? await supabase.from('missions').select('*').eq('cleaner_id', cleanerRow.id).order('date_from', { ascending: false })
    : { data: [] };

  // Merge and deduplicate by id
  const all = [...(direct ?? []), ...(indirect ?? [])];
  const seen = new Set<string>();
  const unique = all.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
  return unique.map(rowToMission);
}

export async function getPendingMissionsDB(): Promise<Mission[]> {
  const { data } = await supabase.from('missions').select('*').eq('status', 'pending').order('date_from');
  return (data ?? []).map(rowToMission);
}

export async function acceptMissionDB(missionId: string, userId: string): Promise<void> {
  // userId is users.id — store directly so getMissionsForCleanerDB finds it
  const { data: cleanerRow } = await supabase.from('cleaners').select('name').eq('user_id', userId).single();
  const cleanerName = cleanerRow?.name ?? '';
  await supabase.from('missions').update({
    cleaner_id: userId,
    cleaner_name: cleanerName,
    status: 'assigned',
  }).eq('id', missionId);
}

export async function createMissionDB(fields: {
  type: string; source: string; propertyName: string; address: string;
  dateFrom: string; timeTo: string; timeFrom: string; duration: number;
  cleanerId?: string; cleanerName?: string; clientName?: string;
  price: number; cleanerGain: number; instructions?: string;
}) {
  // Resolve cleaners.id → users.id so the cleaner can find this mission
  let cleanerIdToStore: string | null = null;
  if (fields.cleanerId) {
    cleanerIdToStore = await resolveToUserId(fields.cleanerId);
  }

  const { error } = await supabase.from('missions').insert({
    type: fields.type,
    source: fields.source,
    property_name: fields.propertyName,
    address: fields.address,
    date_from: fields.dateFrom,
    time_from: fields.timeFrom,
    time_to: fields.timeTo,
    hours_worked: fields.duration,
    cleaner_id: cleanerIdToStore,
    cleaner_name: fields.cleanerName || null,
    client_name: fields.clientName || null,
    price: fields.price,
    cleaner_gain: fields.cleanerGain,
    instructions: fields.instructions || null,
    status: cleanerIdToStore ? 'assigned' : 'pending',
  });

  if (error) console.error('createMissionDB error:', error);
}

export async function updateMissionStatusDB(id: string, status: string) {
  await supabase.from('missions').update({ status }).eq('id', id);
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
    timeStart: row.time_from ?? '',
    timeEnd: row.time_to ?? '',
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
    // Resolve cleaners.id → users.id so the cleaner finds the mission on their dashboard
    const userIdToStore = await resolveToUserId(cleanerId);

    const { error } = await supabase.from('missions').insert({
      type: req.type_prestation ?? 'regular',
      source: 'hotel',
      property_name: req.hotel_name ?? '',
      address: '',
      date_from: req.date_from,
      time_from: req.time_from ?? '',
      time_to: req.time_to ?? '',
      hours_worked: 2,
      cleaner_id: userIdToStore,   // users.id — cleaner can find it
      cleaner_name: cleanerName,
      client_name: req.hotel_name ?? '',
      price: 0,
      cleaner_gain: 0,
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

export async function getHotelByUserId(userId: string) {
  const { data } = await supabase.from('hotels').select('*').eq('user_id', userId).single();
  return data;
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
