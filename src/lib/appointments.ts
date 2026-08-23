
// ══════════════════════════════════════════════════════════════════════════════
//  Rendez-vous — couche d'accès données.
//  La table porte des données personnelles (nom, email, téléphone) : elle n'est
//  PAS lisible avec la clé publique. TOUT passe donc par le serveur :
//   • créneaux occupés (date + heure seulement)  → GET /api/appointment
//   • liste complète et changement de statut     → /api/admin/appointments
//   • création d'un rendez-vous                  → POST /api/appointment
//  Lire directement depuis le navigateur renvoyait zéro ligne SANS erreur :
//  l'écran admin paraissait vide alors que les rendez-vous étaient enregistrés.
// ══════════════════════════════════════════════════════════════════════════════

export type AppointmentStatus = 'confirmed' | 'cancelled' | 'done';
export interface Appointment {
  id: string; refCode: string; devisNumber?: string;
  clientName: string; clientEmail?: string; clientPhone?: string; message?: string;
  date: string; time: string; status: AppointmentStatus; createdAt?: string;
}

// Créneaux déjà réservés sur une plage (page publique : on grise ces créneaux).
export async function getBookedSlotsDB(fromISO: string, toISO: string): Promise<{ date: string; time: string }[]> {
  try {
    const res = await fetch(`/api/appointment?from=${fromISO}&to=${toISO}`);
    const data = await res.json();
    return Array.isArray(data.slots) ? data.slots : [];
  } catch { return []; }
}

// Rendez-vous déjà pris pour un devis donné (page publique du devis : on ne
// repropose pas de choisir une date si c'est déjà fait). Ne lit QUE date/heure —
// même niveau d'exposition que getBookedSlotsDB, aucune donnée personnelle.
export async function getAppointmentForDevisDB(devisNumber: string): Promise<{ date: string; time: string } | null> {
  if (!devisNumber) return null;
  try {
    const res = await fetch(`/api/appointment?devis=${encodeURIComponent(devisNumber)}`);
    const data = await res.json();
    return data.appointment ?? null;
  } catch { return null; }
}

// Liste admin (rendez-vous à venir + récents).
export async function getAppointmentsDB(): Promise<Appointment[]> {
  try {
    const res = await fetch('/api/admin/appointments');
    const data = await res.json();
    return Array.isArray(data.appointments) ? data.appointments : [];
  } catch { return []; }
}

export async function setAppointmentStatusDB(id: string, status: AppointmentStatus): Promise<{ error: string | null }> {
  try {
    const res = await fetch('/api/admin/appointments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    const data = await res.json();
    return { error: res.ok && data.ok ? null : (data.error ?? 'Enregistrement impossible.') };
  } catch { return { error: 'Enregistrement impossible.' }; }
}

// ── Configuration des disponibilités (jours + créneaux), éditable en admin ──────
export interface BookingConfig { workingDays: number[]; morning: string[]; afternoon: string[]; slotMin: number; }
export const DEFAULT_BOOKING: BookingConfig = {
  workingDays: [1, 2, 3, 4, 5, 6], morning: ['09:00', '10:00', '11:00'], afternoon: ['14:00', '15:00', '16:00', '17:00'], slotMin: 60,
};

export async function getBookingConfigDB(): Promise<BookingConfig> {
  let data: Record<string, unknown> | null = null;
  try {
    const res = await fetch('/api/appointment?config=1');
    data = (await res.json()).config ?? null;
  } catch { data = null; }
  if (!data) return DEFAULT_BOOKING;
  return {
    workingDays: Array.isArray(data.working_days) && data.working_days.length ? (data.working_days as unknown[]).map(Number) : DEFAULT_BOOKING.workingDays,
    morning: Array.isArray(data.morning) ? (data.morning as string[]) : DEFAULT_BOOKING.morning,
    afternoon: Array.isArray(data.afternoon) ? (data.afternoon as string[]) : DEFAULT_BOOKING.afternoon,
    slotMin: Number(data.slot_min) || 60,
  };
}

export async function saveBookingConfigDB(c: BookingConfig): Promise<{ error: string | null }> {
  try {
    const res = await fetch('/api/admin/appointments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'config', config: c }),
    });
    const data = await res.json();
    return { error: res.ok && data.ok ? null : (data.error ?? 'Enregistrement impossible.') };
  } catch { return { error: 'Enregistrement impossible.' }; }
}
