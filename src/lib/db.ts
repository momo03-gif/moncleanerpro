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

  // Check hotel account status
  if (data.role === 'hotel') {
    const { data: hotel } = await supabase
      .from('hotels')
      .select('status_account')
      .eq('user_id', data.id)
      .single();
    if (hotel?.status_account === 'pending' || hotel?.status_account === 'refused') return null;
  }

  return {
    id: data.id,
    name: data.name,
    email: data.email,
    password: '', // never expose
    role: data.role,
    phone: data.phone,
    isActive: data.status === 'active',
  };
}

// ── CLEANERS ──────────────────────────────────────────────────────────────────

export async function getCleaners() {
  const { data } = await supabase.from('cleaners').select('*').order('created_at');
  return data ?? [];
}

export async function getActiveCleanersDB() {
  const { data } = await supabase.from('cleaners').select('*').eq('status', 'active');
  return data ?? [];
}

export async function createCleaner(fields: {
  name: string; email: string; phone?: string;
  password: string; hourlyRateHotel?: number; rateAirbnb?: number;
}) {
  const hash = await hashPassword(fields.password || 'cleaner123');
  const { data: user } = await supabase
    .from('users')
    .insert({ email: fields.email, password_hash: hash, role: 'cleaner', name: fields.name, phone: fields.phone, status: 'active' })
    .select()
    .single();

  if (!user) return;

  await supabase.from('cleaners').insert({
    user_id: user.id,
    name: fields.name,
    email: fields.email,
    phone: fields.phone,
    hourly_rate_hotel: fields.hourlyRateHotel ?? 0,
    rate_airbnb: fields.rateAirbnb ?? 0,
    status: 'active',
  });
}

export async function setCleanerActive(id: string, active: boolean) {
  await supabase.from('cleaners').update({ status: active ? 'active' : 'inactive' }).eq('id', id);
}

export async function updateCleanerRatesDB(id: string, hotelRate: number, airbnbRate: number) {
  await supabase.from('cleaners').update({ hourly_rate_hotel: hotelRate, rate_airbnb: airbnbRate }).eq('id', id);
}

export async function updateCleanerPasswordDB(cleanerId: string, newPassword: string) {
  const hash = await hashPassword(newPassword);
  // Find the user_id
  const { data: cleaner } = await supabase.from('cleaners').select('user_id').eq('id', cleanerId).single();
  if (cleaner?.user_id) {
    await supabase.from('users').update({ password_hash: hash }).eq('id', cleaner.user_id);
  }
}

// ── AIRBNBS ───────────────────────────────────────────────────────────────────

export async function getAirbnbs() {
  const { data } = await supabase
    .from('airbnbs')
    .select('*, cleaners(name)')
    .order('created_at');
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
  const map: Record<string, MissionStatus> = { pending: 'pending', assigned: 'accepted', inprogress: 'in_progress', done: 'completed', cancelled: 'cancelled' };
  return map[s] ?? 'pending';
}

export async function getMissionsDB(): Promise<Mission[]> {
  const { data } = await supabase.from('missions').select('*').order('date_from', { ascending: false });
  return (data ?? []).map(rowToMission);
}

export async function getMissionsForCleanerDB(userId: string): Promise<Mission[]> {
  // missions.cleaner_id stores cleaners.id, not users.id — resolve first
  const { data: cleaner } = await supabase.from('cleaners').select('id').eq('user_id', userId).single();
  if (!cleaner) return [];
  const { data } = await supabase.from('missions').select('*').eq('cleaner_id', cleaner.id).order('date_from', { ascending: false });
  return (data ?? []).map(rowToMission);
}

export async function getPendingMissionsDB(): Promise<Mission[]> {
  const { data } = await supabase.from('missions').select('*').eq('status', 'pending').order('date_from');
  return (data ?? []).map(rowToMission);
}

export async function acceptMissionDB(missionId: string, userId: string): Promise<void> {
  const { data: cleaner } = await supabase.from('cleaners').select('id, name').eq('user_id', userId).single();
  if (!cleaner) return;
  await supabase.from('missions').update({ cleaner_id: cleaner.id, cleaner_name: cleaner.name, status: 'assigned' }).eq('id', missionId);
}

export async function getCleanerByUserId(userId: string) {
  const { data } = await supabase.from('cleaners').select('*').eq('user_id', userId).single();
  return data;
}

export async function createMissionDB(fields: {
  type: string; source: string; propertyName: string; address: string;
  dateFrom: string; timeTo: string; timeFrom: string; duration: number;
  cleanerId?: string; cleanerName?: string; clientName?: string;
  price: number; cleanerGain: number; instructions?: string;
}) {
  await supabase.from('missions').insert({
    type: fields.type,
    source: fields.source,
    property_name: fields.propertyName,
    address: fields.address,
    date_from: fields.dateFrom,
    time_from: fields.timeFrom,
    time_to: fields.timeTo,
    hours_worked: fields.duration,
    cleaner_id: fields.cleanerId || null,
    cleaner_name: fields.cleanerName || null,
    client_name: fields.clientName || null,
    price: fields.price,
    cleaner_gain: fields.cleanerGain,
    instructions: fields.instructions || null,
    status: fields.cleanerId ? 'assigned' : 'pending',
  });
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
  await supabase.from('hotel_requests').insert({
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
}

export async function validateRequestDB(id: string, cleanerId: string, cleanerName: string) {
  // Fetch request details first
  const { data: req } = await supabase.from('hotel_requests').select('*').eq('id', id).single();

  // Update the hotel request
  await supabase.from('hotel_requests').update({ status: 'validated', cleaner_id: cleanerId, cleaner_name: cleanerName }).eq('id', id);

  // Create the corresponding mission so the cleaner sees it
  if (req) {
    await supabase.from('missions').insert({
      type: req.type_prestation ?? 'regular',
      source: 'hotel',
      property_name: req.hotel_name ?? '',
      address: '',
      date_from: req.date_from,
      time_from: req.time_from ?? '',
      time_to: req.time_to ?? '',
      hours_worked: 2,
      cleaner_id: cleanerId,
      cleaner_name: cleanerName,
      client_name: req.hotel_name ?? '',
      price: 0,
      cleaner_gain: 0,
      instructions: req.instructions ?? null,
      status: 'assigned',
    });
  }
}

export async function refuseRequestDB(id: string) {
  await supabase.from('hotel_requests').update({ status: 'refused' }).eq('id', id);
}

// ── HOTELS / ACCOUNTS ─────────────────────────────────────────────────────────

export async function getPendingHotelsDB() {
  const { data } = await supabase.from('hotels').select('*, users(name, email, phone)').eq('status_account', 'pending');
  return (data ?? []).map(h => ({
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
  // Also activate the user
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
  const totalRevenue = completed.reduce((s, m) => s + (m.price ?? 0), 0);
  const totalSalaries = completed.reduce((s, m) => s + (m.cleaner_gain ?? 0), 0);

  return {
    totalMissions: (missions ?? []).length,
    completedMissions: completed.length,
    totalRevenue,
    totalSalaries,
    netProfit: totalRevenue - totalSalaries,
    activeCleaners: (cleaners ?? []).filter(c => c.status === 'active').length,
    approvedHotels: (hotels ?? []).filter(h => h.status_account === 'approved').length,
  };
}
