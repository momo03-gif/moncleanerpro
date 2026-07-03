import { getServerDb } from './serverDb';
import { getMissionsByCleanerTableIdDB, getActiveCleanersDB } from './db';
import { serviceParts } from './service';

// service_role côté serveur (le moteur RH tourne dans des routes admin).
const supabase = getServerDb();
import {
  getRhConfigMapDB, getPrimeTypesDB, getIncidentsForCleanerDB, getCleanerRhDB,
  currentPeriod, type PrimeType, type CleanerRh,
} from './rh';

// ══════════════════════════════════════════════════════════════════════════════
//  Moteur de calcul RH (LOT 3 + 3bis).
//  Recalcule cleaner_rh à partir des données RÉELLES (missions terminées,
//  incidents, dates, zones/adresses). Tous les seuils/montants viennent de
//  rh_config — JAMAIS codés en dur. Réservé à l'admin (exécution côté app admin ;
//  durcissement serveur au LOT 4).
// ══════════════════════════════════════════════════════════════════════════════

type ConfigMap = Record<string, { value: number; enabled: boolean }>;

function cfg(map: ConfigMap, key: string, fallback = 0): { value: number; enabled: boolean } {
  return map[key] ?? { value: fallback, enabled: false };
}

// Ancienneté en mois pleins depuis la création du compte.
function monthsSince(iso?: string): number {
  if (!iso) return 0;
  const c = new Date(iso); const now = new Date();
  let m = (now.getFullYear() - c.getFullYear()) * 12 + (now.getMonth() - c.getMonth());
  if (now.getDate() < c.getDate()) m -= 1;
  return Math.max(0, m);
}

// Calcule (sans écrire) tous les agrégats RH d'un cleaner pour un mois donné.
async function computeRhFields(cleaner: { id: string; created_at?: string }, period: string, config: ConfigMap) {
  const missions = await getMissionsByCleanerTableIdDB(cleaner.id);
  const completed = missions.filter(m => m.status === 'completed' && m.date.startsWith(period));

  // Missions / jours travaillés
  const missionsCompleted = completed.length;
  const days = new Set(completed.map(m => m.date));
  const daysWorked = days.size;

  // Temps moyen réel par mission (ended_at - started_at)
  const durations = completed.map(m => m.actualDurationMinutes ?? 0).filter(d => d > 0);
  const avgMinutes = durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : 0;

  // Incidents du mois (source : rh_incidents)
  const incidents = (await getIncidentsForCleanerDB(cleaner.id)).filter(i => i.date.startsWith(period));
  const negative = incidents.filter(i => i.type === 'retour_negatif').length;
  const major = incidents.filter(i => i.type === 'oubli_majeur').length;
  const damage = incidents.filter(i => i.type === 'degradation_non_signalee').length;
  const totalIncidents = negative + major + damage;

  // Ancienneté
  const employmentMonths = monthsSince(cleaner.created_at);

  // Seuils & activations (rh_config)
  const seuilPerf = cfg(config, 'seuil_perf_missions');
  const anciennete = cfg(config, 'anciennete_min_mois');
  const tcl = cfg(config, 'tcl_pourcentage');
  const internet = cfg(config, 'internet_bonus');
  const seuilIncidents = cfg(config, 'seuil_incidents_priorite');
  const primeQualite = cfg(config, 'prime_qualite');
  const primePerf = cfg(config, 'prime_performance');

  const fields: Omit<CleanerRh, 'cleanerId'> = {
    period,
    employmentMonths,
    missionsCompletedThisMonth: missionsCompleted,
    daysWorkedMonth: daysWorked,
    avgMinutesPerMission: avgMinutes,
    travelPaidMinutes: 0, // déplacements supprimés de la paie ; champ conservé (colonne) à 0
    negativeFeedbackCount: negative,
    majorMistakesCount: major,
    damageNotReportedCount: damage,
    qualityScore: -totalIncidents,
    qualityBonusEligible: totalIncidents === 0 && primeQualite.enabled,
    performanceBonusEligible: missionsCompleted >= seuilPerf.value && primePerf.enabled,
    tclEligible: employmentMonths >= anciennete.value && tcl.enabled,
    internetBonusEligible: employmentMonths >= anciennete.value && internet.enabled,
    reducedPriority: totalIncidents > seuilIncidents.value,
  };
  return { fields, totalIncidents };
}

function fieldsToRow(cleanerId: string, f: Omit<CleanerRh, 'cleanerId'>) {
  return {
    cleaner_id: cleanerId,
    period: f.period,
    employment_months: f.employmentMonths,
    missions_completed_this_month: f.missionsCompletedThisMonth,
    days_worked_month: f.daysWorkedMonth,
    avg_minutes_per_mission: f.avgMinutesPerMission,
    travel_paid_minutes: f.travelPaidMinutes,
    negative_feedback_count: f.negativeFeedbackCount,
    major_mistakes_count: f.majorMistakesCount,
    damage_not_reported_count: f.damageNotReportedCount,
    quality_score: f.qualityScore,
    quality_bonus_eligible: f.qualityBonusEligible,
    performance_bonus_eligible: f.performanceBonusEligible,
    tcl_eligible: f.tclEligible,
    internet_bonus_eligible: f.internetBonusEligible,
    reduced_priority: f.reducedPriority,
    updated_at: new Date().toISOString(),
  };
}

// Éligibilité d'une prime selon sa condition (interprétée dynamiquement).
export function isPrimeEligible(prime: PrimeType, rh: CleanerRh, config: ConfigMap): boolean {
  switch (prime.conditionType) {
    case 'missions_mois':
      return rh.missionsCompletedThisMonth >= (prime.conditionValeur ?? cfg(config, 'seuil_perf_missions').value);
    case 'zero_incident':
      return (rh.negativeFeedbackCount + rh.majorMistakesCount + rh.damageNotReportedCount) === 0;
    case 'anciennete':
      return rh.employmentMonths >= (prime.conditionValeur ?? cfg(config, 'anciennete_min_mois').value);
    case 'manuel':
      return false; // déclenchée à la main par l'admin, jamais automatiquement
  }
}

// Pour chaque prime à VALIDATION : si éligible et aucune demande pour ce mois,
// crée une demande « en_attente » (l'admin Accepte/Refuse).
async function evaluatePrimeRequests(cleanerId: string, rh: CleanerRh, primes: PrimeType[], config: ConfigMap, period: string) {
  const toValidate = primes.filter(p => p.actif && p.mode === 'validation_admin' && isPrimeEligible(p, rh, config));
  if (toValidate.length === 0) return;

  const { data: existing } = await supabase
    .from('prime_requests').select('prime_type_id').eq('cleaner_id', cleanerId).eq('period', period);
  const already = new Set((existing ?? []).map((r: any) => r.prime_type_id));

  const rows = toValidate
    .filter(p => !already.has(p.id))
    .map(p => ({ cleaner_id: cleanerId, prime_type_id: p.id, type: p.nom, montant: p.montant, period, statut: 'en_attente' }));
  if (rows.length > 0) await supabase.from('prime_requests').insert(rows);
}

// Recalcule un cleaner (cleaners.id) pour le mois courant : agrégats + primes.
export async function recomputeCleanerRhDB(cleanerId: string, period = currentPeriod()): Promise<void> {
  const { data: cleaner } = await supabase.from('cleaners').select('id, created_at').eq('id', cleanerId).single();
  if (!cleaner) return;
  const [config, primes] = await Promise.all([getRhConfigMapDB(), getPrimeTypesDB()]);
  const { fields } = await computeRhFields(cleaner, period, config);
  await supabase.from('cleaner_rh').upsert(fieldsToRow(cleanerId, fields), { onConflict: 'cleaner_id' });
  const rh: CleanerRh = { cleanerId, ...fields };
  await evaluatePrimeRequests(cleanerId, rh, primes, config, period);
}

// Recalcule tous les cleaners actifs (bouton « Recalculer la paie » côté admin).
export async function recomputeAllCleanerRhDB(period = currentPeriod()): Promise<{ count: number }> {
  const cleaners = await getActiveCleanersDB();
  for (const c of cleaners) await recomputeCleanerRhDB(c.id, period);
  return { count: cleaners.length };
}

// ── FICHE DE PAIE MENSUELLE (LOT 3bis B) ────────────────────────────────────────

export interface PayslipPrime { nom: string; montant: number; source: 'auto' | 'validee'; }

// Comparatif temps du mois (admin uniquement, information seule — aucune paie ici).
// Temps prévu = ménage accordé par appartement (missionDurationMinutes).
// Temps réel = pointage (actualDurationMinutes) ; pour une mission NON pointée,
// le temps ménage prévu est considéré comme le temps réel (fallback).
export interface PayslipTimeCompare {
  plannedMinutes: number;     // somme du temps ménage accordé (missions terminées)
  realMinutes: number;        // temps réel retenu (pointage, sinon prévu en fallback)
  missionsCount: number;      // missions terminées du mois
  pointedCount: number;       // dont missions réellement pointées
}

export interface Payslip {
  cleanerId: string;
  period: string;
  missionsGain: number;       // somme des gains des missions terminées du mois
  primes: PayslipPrime[];
  adjustment: number;         // ajustement manuel admin (€, peut être négatif)
  adjustmentNote?: string;    // raison de l'ajustement
  total: number;              // missions + primes + ajustement
  time: PayslipTimeCompare;   // comparatif temps prévu / réel (admin)
}

// Calcule la fiche de paie d'un cleaner pour un mois. Tout vient de la base.
export async function computePayslipDB(cleanerId: string, period = currentPeriod()): Promise<Payslip> {
  const [missions, rh, config, primes] = await Promise.all([
    getMissionsByCleanerTableIdDB(cleanerId),
    getCleanerRhDB(cleanerId),
    getRhConfigMapDB(),
    getPrimeTypesDB(),
  ]);

  const completed = missions.filter(m => m.status === 'completed' && m.date.startsWith(period));
  const missionsGain = Math.round(completed.reduce((s, m) => s + (m.cleanerGain ?? 0), 0) * 100) / 100;

  const list: PayslipPrime[] = [];

  // Primes automatiques éligibles → ajoutées directement.
  if (rh) {
    for (const p of primes.filter(p => p.actif && p.mode === 'automatique')) {
      if (isPrimeEligible(p, rh, config)) list.push({ nom: p.nom, montant: p.montant, source: 'auto' });
    }
  }

  // Primes à validation déjà ACCEPTÉES pour ce mois.
  const { data: accepted } = await supabase
    .from('prime_requests').select('type, montant')
    .eq('cleaner_id', cleanerId).eq('period', period).eq('statut', 'acceptee');
  (accepted ?? []).forEach((r: any) => list.push({ nom: r.type, montant: Number(r.montant) || 0, source: 'validee' }));

  const primesTotal = list.reduce((s, p) => s + p.montant, 0);

  // Ajustement manuel admin pour ce mois (delta €, peut être négatif).
  const { data: adj } = await supabase
    .from('payroll_adjustments').select('amount, note')
    .eq('cleaner_id', cleanerId).eq('period', period).maybeSingle();
  const adjustment = Number(adj?.amount) || 0;
  const adjustmentNote = adj?.note ?? undefined;

  const total = Math.round((missionsGain + primesTotal + adjustment) * 100) / 100;

  // ── Comparatif temps prévu vs réel (information seule) ──────────────────────
  // Temps accordé = ménage prévu par appartement ; temps réel = pointage, ou le
  // temps prévu en fallback quand la mission n'a pas été pointée.
  // Les livraisons (forfait) ne sont pas pointées et n'ont pas de temps : on les
  // exclut des statistiques de pointage. Seul le nettoyage compte.
  const pointable = completed.filter(m => serviceParts(m.service).cleaning);
  const plannedMinutes = pointable.reduce((s, m) => s + (m.missionDurationMinutes ?? 0), 0);
  const pointed = pointable.filter(m => (m.actualDurationMinutes ?? 0) > 0);
  const realMinutes = pointable.reduce(
    (s, m) => s + ((m.actualDurationMinutes ?? 0) > 0 ? m.actualDurationMinutes! : (m.missionDurationMinutes ?? 0)), 0);

  const time: PayslipTimeCompare = {
    plannedMinutes, realMinutes,
    missionsCount: pointable.length, pointedCount: pointed.length,
  };

  return { cleanerId, period, missionsGain, primes: list, adjustment, adjustmentNote, total, time };
}

// Enregistre (ou efface) l'ajustement manuel de paie d'un cleaner pour un mois.
// amount = 0 sans note → on supprime la ligne pour rester propre.
export async function setPayAdjustmentDB(cleanerId: string, period: string, amount: number, note?: string): Promise<void> {
  const clean = Math.round((Number(amount) || 0) * 100) / 100;
  const trimmedNote = note?.trim() || null;
  if (clean === 0 && !trimmedNote) {
    await supabase.from('payroll_adjustments').delete().eq('cleaner_id', cleanerId).eq('period', period);
    return;
  }
  await supabase.from('payroll_adjustments').upsert(
    { cleaner_id: cleanerId, period, amount: clean, note: trimmedNote, updated_at: new Date().toISOString() },
    { onConflict: 'cleaner_id,period' },
  );
}
