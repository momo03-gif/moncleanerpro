import { getServerDb } from './serverDb';

// Client résolu : service_role côté serveur (routes admin), anon côté client.
// Toutes les tables RH ci-dessous sont protégées par RLS (LOT 4) → l'accès passe
// par les routes serveur, jamais directement depuis le navigateur.
const supabase = getServerDb();

// ══════════════════════════════════════════════════════════════════════════════
//  Module RH — couche d'accès données (LOT 1.B + 1bis).
//  Réglages (rh_config) + primes extensibles (prime_types). Aucune valeur RH n'est
//  codée en dur dans l'app : tout vient de ces tables. Réservé à l'admin (le
//  durcissement « lecture admin uniquement » côté serveur arrive au LOT 4).
// ══════════════════════════════════════════════════════════════════════════════

// ── RH_CONFIG ─────────────────────────────────────────────────────────────────

// Clés connues + métadonnées d'affichage (label, unité, section). La source de
// vérité des valeurs reste la base ; ceci ne sert qu'à présenter l'écran admin
// proprement et à regrouper les réglages. Toute clé inconnue reste affichable.
export type RhConfigKey =
  | 'prime_qualite' | 'prime_performance' | 'seuil_perf_missions'
  | 'anciennete_min_mois' | 'tcl_pourcentage' | 'internet_bonus'
  | 'minutes_trajet_paye' | 'seuil_incidents_priorite';

export interface RhConfigMeta {
  key: RhConfigKey;
  label: string;
  unit: string;          // suffixe affiché (€, %, missions, mois, min…)
  section: 'primes' | 'avantages' | 'deplacements';
  hint?: string;
}

// Ordre = ordre d'affichage dans l'écran Règles RH.
export const RH_CONFIG_META: RhConfigMeta[] = [
  { key: 'prime_qualite',            label: 'Prime qualité',              unit: '€',        section: 'primes',       hint: 'Versée si aucun incident sur le mois.' },
  { key: 'prime_performance',        label: 'Prime performance',          unit: '€',        section: 'primes',       hint: 'Versée au-delà du seuil de missions.' },
  { key: 'seuil_perf_missions',      label: 'Seuil performance',          unit: 'missions', section: 'primes',       hint: 'Missions terminées/mois pour la prime performance.' },
  { key: 'anciennete_min_mois',      label: 'Ancienneté minimale',        unit: 'mois',     section: 'avantages',    hint: 'Ancienneté requise pour ouvrir les avantages.' },
  { key: 'tcl_pourcentage',          label: 'Avantage TCL',               unit: '%',        section: 'avantages',    hint: 'Réduction transport (éligibilité, pas un montant de paie).' },
  { key: 'internet_bonus',           label: 'Avantage Internet',          unit: '€',        section: 'avantages',    hint: 'Participation Internet (éligibilité, pas un montant de paie).' },
  { key: 'minutes_trajet_paye',      label: 'Trajet payé entre adresses', unit: 'min',      section: 'deplacements', hint: 'Minutes payées au changement d’adresse le même jour.' },
  { key: 'seuil_incidents_priorite', label: 'Seuil priorité réduite',     unit: 'incidents',section: 'deplacements', hint: 'Incidents/mois avant de baisser la priorité d’attribution.' },
];

export interface RhConfigRow {
  key: string;
  value: number;
  enabled: boolean;
}

export async function getRhConfigDB(): Promise<RhConfigRow[]> {
  const { data, error } = await supabase.from('rh_config').select('*');
  if (error) { console.error('getRhConfigDB error:', error.code, error.message); return []; }
  return (data ?? []).map(r => ({ key: r.key, value: Number(r.value) || 0, enabled: !!r.enabled }));
}

// Lecture pratique pour le moteur de calcul (LOT 3) : { key → {value, enabled} }.
export async function getRhConfigMapDB(): Promise<Record<string, { value: number; enabled: boolean }>> {
  const rows = await getRhConfigDB();
  return Object.fromEntries(rows.map(r => [r.key, { value: r.value, enabled: r.enabled }]));
}

// Sauvegarde groupée des réglages (un upsert par ligne modifiée).
export async function saveRhConfigDB(rows: RhConfigRow[]): Promise<{ error: string | null }> {
  const payload = rows.map(r => ({
    key: r.key,
    value: r.value,
    enabled: r.enabled,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from('rh_config').upsert(payload, { onConflict: 'key' });
  if (error) console.error('saveRhConfigDB error:', error.code, error.message);
  return { error: error?.message ?? null };
}

// ── PRIME_TYPES ───────────────────────────────────────────────────────────────

export type PrimeConditionType = 'missions_mois' | 'zero_incident' | 'anciennete' | 'manuel';
export type PrimeMode = 'automatique' | 'validation_admin';

export interface PrimeType {
  id: string;
  nom: string;
  montant: number;
  conditionType: PrimeConditionType;
  conditionValeur?: number;
  mode: PrimeMode;
  actif: boolean;
}

// Libellés des conditions (affichage). Le moteur (LOT 3) interprète conditionType.
export const PRIME_CONDITION_LABEL: Record<PrimeConditionType, string> = {
  missions_mois: 'Missions terminées dans le mois ≥ seuil',
  zero_incident: 'Aucun incident sur le mois',
  anciennete:    'Ancienneté (mois) ≥ seuil',
  manuel:        'Déclenchement manuel',
};

function rowToPrimeType(r: any): PrimeType {
  return {
    id: r.id,
    nom: r.nom,
    montant: Number(r.montant) || 0,
    conditionType: (r.condition_type as PrimeConditionType) ?? 'manuel',
    conditionValeur: r.condition_valeur != null ? Number(r.condition_valeur) : undefined,
    mode: (r.mode as PrimeMode) ?? 'validation_admin',
    actif: !!r.actif,
  };
}

export async function getPrimeTypesDB(): Promise<PrimeType[]> {
  const { data, error } = await supabase.from('prime_types').select('*').order('created_at');
  if (error) { console.error('getPrimeTypesDB error:', error.code, error.message); return []; }
  return (data ?? []).map(rowToPrimeType);
}

export async function createPrimeTypeDB(fields: {
  nom: string; montant: number; conditionType: PrimeConditionType;
  conditionValeur?: number; mode: PrimeMode; actif?: boolean;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('prime_types').insert({
    nom: fields.nom,
    montant: fields.montant,
    condition_type: fields.conditionType,
    condition_valeur: fields.conditionValeur ?? null,
    mode: fields.mode,
    actif: fields.actif ?? true,
  });
  if (error) console.error('createPrimeTypeDB error:', error.code, error.message);
  return { error: error?.message ?? null };
}

export async function updatePrimeTypeDB(id: string, fields: {
  nom?: string; montant?: number; conditionType?: PrimeConditionType;
  conditionValeur?: number | null; mode?: PrimeMode; actif?: boolean;
}): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = {};
  if (fields.nom !== undefined) patch.nom = fields.nom;
  if (fields.montant !== undefined) patch.montant = fields.montant;
  if (fields.conditionType !== undefined) patch.condition_type = fields.conditionType;
  if (fields.conditionValeur !== undefined) patch.condition_valeur = fields.conditionValeur;
  if (fields.mode !== undefined) patch.mode = fields.mode;
  if (fields.actif !== undefined) patch.actif = fields.actif;
  if (Object.keys(patch).length === 0) return { error: null };
  const { error } = await supabase.from('prime_types').update(patch).eq('id', id);
  if (error) console.error('updatePrimeTypeDB error:', error.code, error.message);
  return { error: error?.message ?? null };
}

export async function deletePrimeTypeDB(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('prime_types').delete().eq('id', id);
  if (error) console.error('deletePrimeTypeDB error:', error.code, error.message);
  return { error: error?.message ?? null };
}

// ── INCIDENTS + CLEANER_RH (LOT 2) ──────────────────────────────────────────────

export type RhIncidentType = 'retour_negatif' | 'oubli_majeur' | 'degradation_non_signalee';

export const INCIDENT_LABEL: Record<RhIncidentType, string> = {
  retour_negatif: 'Retour négatif',
  oubli_majeur: 'Oubli majeur',
  degradation_non_signalee: 'Dégradation non signalée',
};

// Quel compteur de cleaner_rh chaque type d'incident alimente.
const INCIDENT_COUNTER: Record<RhIncidentType, 'negative_feedback_count' | 'major_mistakes_count' | 'damage_not_reported_count'> = {
  retour_negatif: 'negative_feedback_count',
  oubli_majeur: 'major_mistakes_count',
  degradation_non_signalee: 'damage_not_reported_count',
};

export interface RhIncident {
  id: string;
  cleanerId: string;
  type: RhIncidentType;
  note?: string;
  date: string;
}

export interface CleanerRh {
  cleanerId: string;
  period?: string;
  employmentMonths: number;
  missionsCompletedThisMonth: number;
  daysWorkedMonth: number;
  avgMinutesPerMission: number;
  travelPaidMinutes: number;
  negativeFeedbackCount: number;
  majorMistakesCount: number;
  damageNotReportedCount: number;
  qualityScore: number;
  qualityBonusEligible: boolean;
  performanceBonusEligible: boolean;
  tclEligible: boolean;
  internetBonusEligible: boolean;
  reducedPriority: boolean;
}

// Mois courant au format « YYYY-MM ».
export function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}
function monthBounds(period: string): { start: string; nextStart: string } {
  const [y, m] = period.split('-').map(Number);
  const start = `${period}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { start, nextStart: next };
}

function rowToCleanerRh(r: any): CleanerRh {
  return {
    cleanerId: r.cleaner_id,
    period: r.period ?? undefined,
    employmentMonths: Number(r.employment_months) || 0,
    missionsCompletedThisMonth: Number(r.missions_completed_this_month) || 0,
    daysWorkedMonth: Number(r.days_worked_month) || 0,
    avgMinutesPerMission: Number(r.avg_minutes_per_mission) || 0,
    travelPaidMinutes: Number(r.travel_paid_minutes) || 0,
    negativeFeedbackCount: Number(r.negative_feedback_count) || 0,
    majorMistakesCount: Number(r.major_mistakes_count) || 0,
    damageNotReportedCount: Number(r.damage_not_reported_count) || 0,
    qualityScore: Number(r.quality_score) || 0,
    qualityBonusEligible: !!r.quality_bonus_eligible,
    performanceBonusEligible: !!r.performance_bonus_eligible,
    tclEligible: !!r.tcl_eligible,
    internetBonusEligible: !!r.internet_bonus_eligible,
    reducedPriority: !!r.reduced_priority,
  };
}

export async function getCleanerRhDB(cleanerId: string): Promise<CleanerRh | null> {
  const { data } = await supabase.from('cleaner_rh').select('*').eq('cleaner_id', cleanerId).single();
  return data ? rowToCleanerRh(data) : null;
}

export async function getAllCleanerRhDB(): Promise<CleanerRh[]> {
  const { data, error } = await supabase.from('cleaner_rh').select('*');
  if (error) { console.error('getAllCleanerRhDB error:', error.code, error.message); return []; }
  return (data ?? []).map(rowToCleanerRh);
}

export async function getIncidentsForCleanerDB(cleanerId: string): Promise<RhIncident[]> {
  const { data, error } = await supabase
    .from('rh_incidents').select('*').eq('cleaner_id', cleanerId).order('date', { ascending: false });
  if (error) { console.error('getIncidentsForCleanerDB error:', error.code, error.message); return []; }
  return (data ?? []).map(r => ({ id: r.id, cleanerId: r.cleaner_id, type: r.type, note: r.note ?? undefined, date: r.date }));
}

// Recalcule UNIQUEMENT les champs liés aux incidents du mois en cours dans
// cleaner_rh (compteurs + quality_score). Source de vérité = rh_incidents.
// Les autres champs (ancienneté, missions, déplacements, éligibilités) sont
// calculés par le moteur du LOT 3 et laissés intacts ici.
async function recomputeIncidentFieldsDB(cleanerId: string, period = currentPeriod()): Promise<void> {
  const { start, nextStart } = monthBounds(period);
  const { data } = await supabase
    .from('rh_incidents').select('type')
    .eq('cleaner_id', cleanerId).gte('date', start).lt('date', nextStart);

  const counts = { negative_feedback_count: 0, major_mistakes_count: 0, damage_not_reported_count: 0 };
  (data ?? []).forEach((r: any) => {
    const col = INCIDENT_COUNTER[r.type as RhIncidentType];
    if (col) counts[col] += 1;
  });
  const total = counts.negative_feedback_count + counts.major_mistakes_count + counts.damage_not_reported_count;

  await supabase.from('cleaner_rh').upsert({
    cleaner_id: cleanerId,
    period,
    ...counts,
    quality_score: -total,                    // part de 0, -1 par incident
    quality_bonus_eligible: total === 0,      // aucun incident sur le mois
    updated_at: new Date().toISOString(),
  }, { onConflict: 'cleaner_id' });
}

// Enregistre un incident (historique) puis met à jour les compteurs du mois.
export async function createIncidentDB(fields: {
  cleanerId: string; type: RhIncidentType; note?: string; date?: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('rh_incidents').insert({
    cleaner_id: fields.cleanerId,
    type: fields.type,
    note: fields.note || null,
    date: fields.date || new Date().toISOString().slice(0, 10),
  });
  if (error) { console.error('createIncidentDB error:', error.code, error.message); return { error: error.message }; }
  await recomputeIncidentFieldsDB(fields.cleanerId);
  return { error: null };
}

// Suppression d'un incident (correction) → recalcule les compteurs.
export async function deleteIncidentDB(id: string, cleanerId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('rh_incidents').delete().eq('id', id);
  if (error) return { error: error.message };
  await recomputeIncidentFieldsDB(cleanerId);
  return { error: null };
}

// Résumé incidents d'un cleaner pour les badges (LOT 6) : compteur du mois +
// date du dernier incident (pour les séries « sans incident »). Renvoie un AGRÉGAT,
// pas les montants/détails RH. (Sera relocalisé côté serveur au LOT 4.)
export async function getIncidentSummaryForCleanerDB(cleanerId: string, period = currentPeriod()): Promise<{ thisMonth: number; lastDate: string | null }> {
  const { start, nextStart } = monthBounds(period);
  const [{ data: monthRows }, { data: lastRow }] = await Promise.all([
    supabase.from('rh_incidents').select('id').eq('cleaner_id', cleanerId).gte('date', start).lt('date', nextStart),
    supabase.from('rh_incidents').select('date').eq('cleaner_id', cleanerId).order('date', { ascending: false }).limit(1),
  ]);
  return { thisMonth: (monthRows ?? []).length, lastDate: lastRow?.[0]?.date ?? null };
}

// ── PRIME_REQUESTS (primes à valider par l'admin — LOT 3bis C) ──────────────────

export type PrimeRequestStatus = 'en_attente' | 'acceptee' | 'refusee';

export interface PrimeRequest {
  id: string;
  cleanerId: string;
  primeTypeId?: string;
  type: string;
  montant: number;
  period?: string;
  statut: PrimeRequestStatus;
  createdAt?: string;
}

function rowToPrimeRequest(r: any): PrimeRequest {
  return {
    id: r.id,
    cleanerId: r.cleaner_id,
    primeTypeId: r.prime_type_id ?? undefined,
    type: r.type ?? '',
    montant: Number(r.montant) || 0,
    period: r.period ?? undefined,
    statut: (r.statut as PrimeRequestStatus) ?? 'en_attente',
    createdAt: r.created_at ?? undefined,
  };
}

export async function getPrimeRequestsDB(statut?: PrimeRequestStatus): Promise<PrimeRequest[]> {
  let q = supabase.from('prime_requests').select('*').order('created_at', { ascending: false });
  if (statut) q = q.eq('statut', statut);
  const { data, error } = await q;
  if (error) { console.error('getPrimeRequestsDB error:', error.code, error.message); return []; }
  return (data ?? []).map(rowToPrimeRequest);
}

export async function resolvePrimeRequestDB(id: string, accept: boolean): Promise<{ error: string | null }> {
  const { error } = await supabase.from('prime_requests').update({
    statut: accept ? 'acceptee' : 'refusee',
    resolved_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) console.error('resolvePrimeRequestDB error:', error.code, error.message);
  return { error: error?.message ?? null };
}
