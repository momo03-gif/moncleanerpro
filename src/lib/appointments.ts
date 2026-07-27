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
