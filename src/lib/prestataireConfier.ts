// ── Confier des missions à un prestataire (serveur uniquement) ──────────────
//
// Deux chemins, une seule règle :
//   • l'admin confie à la main (« Confier à un prestataire », /api/prestataire) ;
//   • le logement a un PRESTATAIRE ATTITRÉ (airbnbs.prestataire_id) : chaque
//     ménage prévu sur ce logement et attribué à personne lui est confié
//     d'office — synchro des réservations, création manuelle, récurrents…
//
// Ce qu'on lui doit est figé au moment où on lui confie : son taux × la durée.
// Un domicile de particulier (crédit d'impôt) ne va qu'à un prestataire SAP.

import type { SupabaseClient } from '@supabase/supabase-js';
import { gainPrestataire, attribuable, peutConfier } from './prestataireRegles';
import { serviceParts } from './service';
import type { MissionService } from './types';
import {
  notifyCleanerMissionUnassigned, notifyPrestataireMissionReprise, notifyPrestataireMissionsConfiees,
} from './notificationEvents';
import { assurerAgentPerso, emailAgentPerso } from './agentPerso';

export interface PrestataireConfiable {
  id: string; user_id: string; name: string; hourly_rate: number; sap_declare: boolean;
}

/** Durée retenue pour la paie du prestataire. */
export function minutesDe(m: Record<string, unknown>): number {
  const apt = (m.airbnbs as { estimated_cleaning_minutes?: number } | null)?.estimated_cleaning_minutes;
  if (m.mission_duration_minutes != null) return Number(m.mission_duration_minutes) || 0;
  if (apt != null) return Number(apt) || 0;
  if (m.apartment_default_duration_snapshot != null) return Number(m.apartment_default_duration_snapshot) || 0;
  return 60;
}

/** Le prestataire, s'il peut recevoir des missions (actif et validé). Sinon le motif. */
export async function chargerPrestataireConfiable(
  db: SupabaseClient, prestataireId: string,
): Promise<{ pr: PrestataireConfiable } | { erreur: string; code: number }> {
  const { data: pr } = await db.from('prestataires')
    .select('id, user_id, name, hourly_rate, status, sap_declare').eq('id', prestataireId).maybeSingle();
  if (!pr) return { erreur: 'Prestataire introuvable.', code: 404 };
  if (pr.status !== 'active') return { erreur: 'Ce prestataire est suspendu.', code: 400 };
  const { data: compte } = await db.from('users').select('status').eq('id', pr.user_id).maybeSingle();
  if (compte?.status === 'pending') return { erreur: 'Ce prestataire n’est pas encore validé.', code: 400 };
  return {
    pr: {
      id: pr.id as string, user_id: pr.user_id as string, name: pr.name as string,
      hourly_rate: Number(pr.hourly_rate) || 0, sap_declare: pr.sap_declare === true,
    },
  };
}

/**
 * Confie UNE mission (lue avec `airbnbs(estimated_cleaning_minutes, credit_impot)`).
 * La mission repart « à attribuer » chez le prestataire, qui choisira son agent.
 * Ne notifie PAS le prestataire : l'appelant regroupe (cf. notifierConfiees).
 */
export async function confierUneMission(
  db: SupabaseClient, m: Record<string, unknown>, pr: PrestataireConfiable,
): Promise<'confiee' | 'credit_impot' | 'ignoree' | 'erreur'> {
  if (!attribuable(m.status as string)) return 'ignoree';
  const creditImpot = (m.airbnbs as { credit_impot?: boolean } | null)?.credit_impot === true;
  if (!peutConfier({ creditImpot, sapDeclare: pr.sap_declare })) return 'credit_impot';
  const minutes = minutesDe(m);
  const id = m.id as string;
  const ancienCleaner = m.cleaner_id as string | null;
  const ancienPresta = m.prestataire_id as string | null;
  const { data: maj, error } = await db.from('missions').update({
    prestataire_id: pr.id, prestataire_name: pr.name,
    prestataire_rate_snapshot: pr.hourly_rate, prestataire_gain: gainPrestataire(pr.hourly_rate, minutes),
    mission_duration_minutes: minutes, hours_worked: Math.round((minutes / 60) * 100) / 100,
    // C'est le prestataire qui choisira l'agent : la mission repart « à attribuer ».
    status: 'pending', cleaner_id: null, cleaner_name: null,
    cleaner_gain: 0, cleaner_hourly_rate_snapshot: null,
    pending_cleaner_id: null, pending_cleaner_name: null, pending_requested_at: null,
  }).eq('id', id).in('status', ['pending', 'assigned']).select('id');
  if (error) { console.error('confierUneMission:', error.message); return 'erreur'; }
  if (!maj?.length) return 'ignoree';
  // Ceux qui la perdent l'apprennent de nous.
  if (ancienCleaner) await notifyCleanerMissionUnassigned(id, ancienCleaner);
  if (ancienPresta && ancienPresta !== pr.id) {
    const { data: av } = await db.from('prestataires').select('user_id').eq('id', ancienPresta).maybeSingle();
    if (av?.user_id) await notifyPrestataireMissionReprise(id, av.user_id as string);
  }
  return ancienPresta === pr.id ? 'ignoree' : 'confiee';
}

/** Le prestataire travaille-t-il SEUL (aucun agent actif, hors sa fiche « moi-même ») ? */
export async function travailleSeul(db: SupabaseClient, prestataireId: string): Promise<boolean> {
  const { data } = await db.from('cleaners').select('email').eq('prestataire_id', prestataireId).eq('status', 'active');
  const perso = emailAgentPerso(prestataireId);
  return !(data ?? []).some(a => a.email !== perso);
}

/**
 * Prestataire SEUL : ses missions à attribuer sont à son nom d'office (sa fiche
 * « moi-même », cf. lib/agentPerso.ts) — elles apparaissent directement dans
 * son mode terrain, sans qu'il ait à se les attribuer une à une. Avec des
 * agents, c'est lui qui choisit : on ne touche à rien. Renvoie le nombre de
 * missions mises à son nom.
 */
export async function attribuerAuPrestataireSeul(db: SupabaseClient, prestataireId: string, missionIds: string[]): Promise<number> {
  if (!missionIds.length || !(await travailleSeul(db, prestataireId))) return 0;
  const { data: pr } = await db.from('prestataires').select('id, name, contact_name, phone').eq('id', prestataireId).maybeSingle();
  if (!pr) return 0;
  const perso = await assurerAgentPerso(db, pr as { id: string; name: string; contact_name?: string | null; phone?: string | null });
  if ('erreur' in perso) return 0;
  const { data: maj } = await db.from('missions').update({
    cleaner_id: perso.cleanerId, cleaner_name: perso.name, status: 'assigned', cleaner_gain: 0, cleaner_hourly_rate_snapshot: 0,
  }).in('id', missionIds).eq('prestataire_id', prestataireId).eq('status', 'pending').is('cleaner_id', null).select('id');
  return maj?.length ?? 0;
}

/**
 * Après avoir confié un lot : à son nom s'il travaille seul, puis UNE
 * notification pour le lot (« 12 nouvelles missions »), pas une par mission.
 */
export async function notifierConfiees(db: SupabaseClient, pr: PrestataireConfiable, missionIds: string[]): Promise<void> {
  if (!missionIds.length) return;
  await attribuerAuPrestataireSeul(db, pr.id, missionIds);
  await notifyPrestataireMissionsConfiees(pr.user_id, missionIds);
}

/**
 * Prestataire attitré : confie d'office les ménages de ces missions dont le
 * logement a un prestataire attitré, s'ils ne sont attribués à personne.
 * Silencieux sur les refus (suspendu, crédit d'impôt…) : la mission reste
 * simplement « à assigner », comme sans prestataire attitré. Renvoie le nombre
 * de missions confiées. Ne lève jamais : la création de la mission prime.
 */
export async function confierAuPrestataireAttitre(db: SupabaseClient, missionIds: string[]): Promise<number> {
  if (!missionIds.length) return 0;
  try {
    const { data: lignes, error } = await db.from('missions')
      .select('*, airbnbs(estimated_cleaning_minutes, credit_impot, prestataire_id)')
      .in('id', missionIds);
    if (error) return 0;   // base pas encore migrée (airbnbs.prestataire_id)
    const parPrestataire = new Map<string, Record<string, unknown>[]>();
    for (const m of lignes ?? []) {
      const pid = (m.airbnbs as { prestataire_id?: string | null } | null)?.prestataire_id;
      // Seulement un MÉNAGE, encore attribué à personne.
      if (!pid || m.status !== 'pending' || m.cleaner_id || m.prestataire_id || m.pending_cleaner_id) continue;
      if (!serviceParts(m.service as MissionService | null).cleaning) continue;
      parPrestataire.set(pid, [...(parPrestataire.get(pid) ?? []), m]);
    }
    let total = 0;
    for (const [pid, ms] of parPrestataire) {
      const r = await chargerPrestataireConfiable(db, pid);
      if (!('pr' in r)) continue;
      const confiees: string[] = [];
      for (const m of ms) if (await confierUneMission(db, m, r.pr) === 'confiee') confiees.push(m.id as string);
      await notifierConfiees(db, r.pr, confiees);
      total += confiees.length;
    }
    return total;
  } catch (e) {
    console.error('confierAuPrestataireAttitre:', e);
    return 0;
  }
}
