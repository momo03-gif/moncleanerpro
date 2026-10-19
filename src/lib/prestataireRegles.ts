// ── Prestataires (sous-traitants) : les règles, partagées serveur / écran ───
//
// Un prestataire est une entreprise extérieure. On lui CONFIE une mission ; il
// la donne à l'un de ses agents, qui la réalise avec l'application cleaner.
//
// CE QU'ON LUI DOIT = son taux horaire × durée de la mission / 60, FIGÉ au
// moment où on la lui confie (comme la paie d'un cleaner) : changer son taux
// plus tard ne réécrit pas le passé. On ne paie pas ses agents — c'est son
// affaire : leur cleaner_gain reste à 0.

import { computeCleanerGain } from './pay';

/** Montant dû au prestataire pour une mission. */
export function gainPrestataire(tauxHoraire: number, minutes: number): number {
  return computeCleanerGain(tauxHoraire, minutes);
}

/**
 * Statuts (vocabulaire de la BASE) où le prestataire peut encore choisir ou
 * changer d'agent : ni démarrée, ni terminée, ni annulée.
 */
export const STATUTS_ATTRIBUABLES = ['pending', 'assigned'] as const;

export function attribuable(statutBase: string | null | undefined): boolean {
  return (STATUTS_ATTRIBUABLES as readonly string[]).includes(statutBase ?? '');
}

export interface LigneReleve {
  status?: string | null;
  date_from?: string | null;
  prestataire_gain?: number | string | null;
  mission_duration_minutes?: number | string | null;
}

/**
 * Relevé d'un mois ('YYYY-MM') : ce qu'on doit au prestataire pour les missions
 * TERMINÉES ce mois-là. Une mission annulée ou pas encore faite ne compte pas.
 */
export function releveDuMois(lignes: LigneReleve[], periode: string): { missions: number; minutes: number; montant: number } {
  let missions = 0, minutes = 0, montant = 0;
  for (const l of lignes) {
    if (l.status !== 'done') continue;
    if (!(l.date_from ?? '').startsWith(periode + '-')) continue;
    missions += 1;
    minutes += Number(l.mission_duration_minutes) || 0;
    montant += Number(l.prestataire_gain) || 0;
  }
  return { missions, minutes, montant: Math.round(montant * 100) / 100 };
}
