// ── Interventions récurrentes (ménage programmé à jours fixes) ───────────────────
// Un planning décrit un ménage hebdomadaire (jours de semaine cochés). Les missions
// réelles sont matérialisées sur un horizon glissant — par le cron (piggyback) et à
// la création du planning. Ce sont des missions 'cleaning' normales (facturables/payées).
// Table `recurring_missions` non verrouillée (comme missions/airbnbs) → client anon OK.

import { supabase } from './supabase';
import { computeCleanerGain } from './pay';
import { parisToday, addDaysStr, occurrenceDates } from './recurringDates';
import type { RecurringMission } from './types';

const toRecurring = (r: any): RecurringMission => ({
  id: r.id,
  airbnbId: r.airbnb_id ?? undefined,
  propertyName: r.property_name ?? r.airbnbs?.name ?? undefined,
  address: r.address ?? r.airbnbs?.address ?? undefined,
  cleanerId: r.cleaner_id ?? undefined,
  cleanerName: r.cleaner_name ?? undefined,
  service: r.service ?? 'cleaning',
  weekdays: Array.isArray(r.weekdays) ? r.weekdays : [],
  timeFrom: r.time_from ?? undefined,
  durationMinutes: Number(r.duration_minutes) || 0,
  price: Number(r.price) || 0,
  startDate: r.start_date,
  endDate: r.end_date ?? undefined,
  active: r.active ?? true,
  lastGeneratedDate: r.last_generated_date ?? undefined,
  createdAt: r.created_at ?? undefined,
});

export async function listRecurringDB(): Promise<RecurringMission[]> {
  const { data, error } = await supabase.from('recurring_missions')
    .select('*, airbnbs(name, address)').order('created_at', { ascending: false });
  if (error) { console.error('listRecurringDB:', error.code, error.message); return []; }
  return (data ?? []).map(toRecurring);
}

export async function setRecurringActiveDB(id: string, active: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.from('recurring_missions').update({ active }).eq('id', id);
  // (Re)matérialise immédiatement à la réactivation.
  if (!error && active) await generateRecurringMissions();
  return { error: error?.message ?? null };
}

// Supprime le planning. Les missions DÉJÀ générées sont conservées (recurring_id
// passe à NULL via ON DELETE SET NULL) — ce sont des données de référence.
export async function deleteRecurringDB(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('recurring_missions').delete().eq('id', id);
  return { error: error?.message ?? null };
}

export async function createRecurringDB(fields: {
  airbnbId?: string; propertyName?: string; address?: string;
  cleanerId?: string; cleanerName?: string;
  weekdays: number[]; timeFrom?: string; durationMinutes: number; price: number;
  startDate: string; endDate?: string; createdBy?: string;
}): Promise<{ error: string | null; generated: number }> {
  const linked = !!fields.airbnbId;
  const { error } = await supabase.from('recurring_missions').insert({
    airbnb_id: fields.airbnbId || null,
    property_name: linked ? null : (fields.propertyName || null),
    address: linked ? null : (fields.address || null),
    cleaner_id: fields.cleanerId || null,
    cleaner_name: fields.cleanerName || null,
    service: 'cleaning',
    weekdays: fields.weekdays,
    time_from: fields.timeFrom || null,
    duration_minutes: fields.durationMinutes || 60,
    price: fields.price || 0,
    start_date: fields.startDate,
    end_date: fields.endDate || null,
    created_by: fields.createdBy || null,
  });
  if (error) { console.error('createRecurringDB:', error.code, error.message); return { error: error.message, generated: 0 }; }
  const gen = await generateRecurringMissions();
  return { error: null, generated: gen.created };
}

// Modifie un planning : met à jour la règle, puis RÉALIGNE l'agenda — supprime les
// missions FUTURES non démarrées qu'il avait générées (status pending/assigned, date ≥
// aujourd'hui) et régénère selon la nouvelle règle. Les missions passées / en cours /
// terminées sont conservées (données de référence).
export async function updateRecurringDB(id: string, fields: {
  airbnbId?: string; propertyName?: string; address?: string;
  cleanerId?: string; cleanerName?: string;
  weekdays: number[]; timeFrom?: string; durationMinutes: number; price: number;
  startDate: string; endDate?: string;
}): Promise<{ error: string | null; generated: number }> {
  const linked = !!fields.airbnbId;
  const { error } = await supabase.from('recurring_missions').update({
    airbnb_id: fields.airbnbId || null,
    property_name: linked ? null : (fields.propertyName || null),
    address: linked ? null : (fields.address || null),
    cleaner_id: fields.cleanerId || null,
    cleaner_name: fields.cleanerName || null,
    weekdays: fields.weekdays,
    time_from: fields.timeFrom || null,
    duration_minutes: fields.durationMinutes || 60,
    price: fields.price || 0,
    start_date: fields.startDate,
    end_date: fields.endDate || null,
  }).eq('id', id);
  if (error) { console.error('updateRecurringDB:', error.code, error.message); return { error: error.message, generated: 0 }; }

  const today = parisToday();
  await supabase.from('missions').delete()
    .eq('recurring_id', id).gte('date_from', today).in('status', ['pending', 'assigned']);
  const gen = await generateRecurringMissions();
  return { error: null, generated: gen.created };
}

// Matérialise les missions des plannings actifs sur un horizon glissant. Idempotent :
// dédoublonne via (recurring_id, date_from) → jamais de doublon si le cron repasse.
export async function generateRecurringMissions(horizonDays = 60): Promise<{ created: number }> {
  const today = parisToday();
  const horizon = addDaysStr(today, horizonDays);

  const { data: recs } = await supabase.from('recurring_missions').select('*').eq('active', true);
  if (!recs || recs.length === 0) return { created: 0 };

  // Taux horaire des cleaners (pour le gain), chargé une fois.
  const { data: cls } = await supabase.from('cleaners').select('id, name, hourly_rate');
  const rateOf = new Map((cls ?? []).map((c: any) => [c.id, Number(c.hourly_rate) || 0]));
  const nameOf = new Map((cls ?? []).map((c: any) => [c.id, c.name]));

  let created = 0;
  for (const r of recs) {
    const weekdays: number[] = Array.isArray(r.weekdays) ? r.weekdays : [];
    if (weekdays.length === 0) continue;
    const start = r.start_date > today ? r.start_date : today;
    const end = r.end_date && r.end_date < horizon ? r.end_date : horizon;
    const dates = occurrenceDates(start, end, weekdays);
    if (dates.length === 0) continue;

    // Occurrences déjà matérialisées dans la fenêtre.
    const { data: existing } = await supabase.from('missions')
      .select('date_from').eq('recurring_id', r.id).gte('date_from', start).lte('date_from', end);
    const have = new Set((existing ?? []).map((m: any) => m.date_from));

    const minutes = Number(r.duration_minutes) || 0;
    const rate = r.cleaner_id ? (rateOf.get(r.cleaner_id) ?? 0) : 0;
    const gain = r.cleaner_id ? computeCleanerGain(rate, minutes) : 0;
    const linked = !!r.airbnb_id;

    const rows = dates.filter(d => !have.has(d)).map(d => ({
      type: 'regular',
      // Lié à un site → 'airbnb' (cohérent avec l'app) ; le badge affiché dérive du
      // type de site / du caractère récurrent (jamais « Hôtel » à tort). Cf. missionOriginLabel.
      source: r.airbnb_id ? 'airbnb' : 'hotel',
      service: r.service || 'cleaning',
      airbnb_id: r.airbnb_id || null,
      property_name: linked ? null : (r.property_name || null),
      address: linked ? null : (r.address || null),
      date_from: d,
      time_from: r.time_from || null,
      mission_duration_minutes: minutes,
      hours_worked: Math.round((minutes / 60) * 100) / 100,
      cleaner_id: r.cleaner_id || null,
      cleaner_name: r.cleaner_name || (r.cleaner_id ? nameOf.get(r.cleaner_id) : null) || null,
      cleaner_gain: gain,
      cleaner_hourly_rate_snapshot: r.cleaner_id ? rate : null,
      price: Number(r.price) || 0,
      recurring_id: r.id,
      status: r.cleaner_id ? 'assigned' : 'pending',
    }));

    if (rows.length > 0) {
      const { data: ins, error } = await supabase.from('missions').insert(rows).select('id');
      if (error) console.error('generateRecurringMissions insert:', error.message);
      else created += ins?.length ?? 0;
    }
    await supabase.from('recurring_missions').update({ last_generated_date: horizon }).eq('id', r.id);
  }
  return { created };
}
