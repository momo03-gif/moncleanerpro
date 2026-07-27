import { supabase } from './supabase';

// ══════════════════════════════════════════════════════════════════════════════
//  Rendez-vous — couche d'accès données.
//  • Lecture des créneaux OCCUPÉS (date + heure, sans PII) : page publique.
//  • Liste complète + changement de statut : admin (tables RLS désactivée, comme
//    devis/tarifs). La CRÉATION passe par la route serveur /api/appointment
//    (service_role) pour éviter les réservations anonymes abusives.
// ══════════════════════════════════════════════════════════════════════════════

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'done';
export interface Appointment {
  id: string; refCode: string; devisNumber?: string;
  clientName: string; clientEmail?: string; clientPhone?: string; message?: string;
  date: string; time: string; status: AppointmentStatus; createdAt?: string;
}

const toAppt = (r: any): Appointment => ({
  id: r.id, refCode: r.ref_code ?? '', devisNumber: r.devis_number ?? undefined,
  clientName: r.client_name ?? '', clientEmail: r.client_email ?? undefined, clientPhone: r.client_phone ?? undefined,
  message: r.message ?? undefined, date: r.date, time: r.time, status: r.status ?? 'confirmed', createdAt: r.created_at ?? undefined,
});

// Créneaux déjà réservés sur une plage (page publique : on grise ces créneaux).
export async function getBookedSlotsDB(fromISO: string, toISO: string): Promise<{ date: string; time: string }[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('date, time')
    .eq('status', 'confirmed')
    .gte('date', fromISO)
    .lte('date', toISO);
  if (error) { console.error('getBookedSlotsDB:', error.code, error.message); return []; }
  return (data ?? []).map((r: any) => ({ date: r.date, time: r.time }));
}

// Liste admin (rendez-vous à venir + récents).
export async function getAppointmentsDB(): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select('*')
    .order('date', { ascending: true })
    .order('time', { ascending: true });
  if (error) { console.error('getAppointmentsDB:', error.code, error.message); return []; }
  return (data ?? []).map(toAppt);
}

export async function setAppointmentStatusDB(id: string, status: AppointmentStatus): Promise<{ error: string | null }> {
  const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
  return { error: error?.message ?? null };
}

// ── Configuration des disponibilités (jours + créneaux), éditable en admin ──────
export interface BookingConfig { workingDays: number[]; morning: string[]; afternoon: string[]; slotMin: number; }
export const DEFAULT_BOOKING: BookingConfig = {
  workingDays: [1, 2, 3, 4, 5, 6], morning: ['09:00', '10:00', '11:00'], afternoon: ['14:00', '15:00', '16:00', '17:00'], slotMin: 60,
};

export async function getBookingConfigDB(): Promise<BookingConfig> {
  const { data, error } = await supabase.from('booking_config').select('*').eq('id', 1).maybeSingle();
  if (error || !data) return DEFAULT_BOOKING;
  return {
    workingDays: Array.isArray(data.working_days) && data.working_days.length ? data.working_days.map(Number) : DEFAULT_BOOKING.workingDays,
    morning: Array.isArray(data.morning) ? data.morning : DEFAULT_BOOKING.morning,
    afternoon: Array.isArray(data.afternoon) ? data.afternoon : DEFAULT_BOOKING.afternoon,
    slotMin: Number(data.slot_min) || 60,
  };
}

export async function saveBookingConfigDB(c: BookingConfig): Promise<{ error: string | null }> {
  const { error } = await supabase.from('booking_config').upsert({
    id: 1, working_days: c.workingDays, morning: c.morning, afternoon: c.afternoon, slot_min: c.slotMin, updated_at: new Date().toISOString(),
  });
  return { error: error?.message ?? null };
}
