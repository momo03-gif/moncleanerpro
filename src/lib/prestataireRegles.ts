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

// ── Crédit d'impôt ──────────────────────────────────────────────────────────
// Le ménage au domicile d'un particulier ouvre droit au crédit d'impôt parce
// qu'il est réalisé dans le cadre services à la personne. Le confier à un
// prestataire qui n'est pas lui-même déclaré SAP peut faire perdre ce droit au
// client : on l'interdit, sauf prestataire déclaré.
export const CREDIT_IMPOT_REFUS =
  'Ce logement est le domicile d’un particulier (crédit d’impôt) : il ne peut être confié qu’à un prestataire déclaré services à la personne.';

export function peutConfier(o: { creditImpot?: boolean | null; sapDeclare?: boolean | null }): boolean {
  return !o.creditImpot || !!o.sapDeclare;
}

// ── Obligation de vigilance ─────────────────────────────────────────────────
// Attestation URSSAF : à renouveler tous les 6 mois. Kbis : à obtenir une fois
// (on le redemande au bout d'un an pour rester à jour).
export type TypeDocument = 'urssaf' | 'kbis' | 'assurance' | 'autre';

export const LIBELLE_DOCUMENT: Record<TypeDocument, string> = {
  urssaf: 'Attestation de vigilance URSSAF',
  kbis: 'Extrait Kbis (ou avis SIRENE)',
  assurance: 'Attestation d’assurance RC pro',
  autre: 'Autre document',
};

/** Durée de validité retenue, en mois, par type de document. */
const VALIDITE_MOIS: Partial<Record<TypeDocument, number>> = { urssaf: 6, kbis: 12, assurance: 12 };

export interface DocumentVigilance { kind: string; delivered_on?: string | null; uploaded_at?: string | null }

function ajouterMois(dateIso: string, mois: number): string {
  const [a, m, j] = dateIso.slice(0, 10).split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + mois, j));
  return d.toISOString().slice(0, 10);
}

/**
 * État de la vigilance pour un prestataire, à la date `aujourdhui` ('YYYY-MM-DD').
 * Pour chaque document exigé (URSSAF, Kbis), on garde le plus récent : manquant,
 * expiré, ou valable jusqu'à une date.
 */
export function etatVigilance(docs: DocumentVigilance[], aujourdhui: string): {
  aJour: boolean;
  details: { kind: 'urssaf' | 'kbis'; etat: 'manquant' | 'expire' | 'ok'; jusqu?: string }[];
} {
  const details = (['urssaf', 'kbis'] as const).map(kind => {
    const dates = docs.filter(d => d.kind === kind)
      .map(d => (d.delivered_on || d.uploaded_at || '').slice(0, 10)).filter(Boolean).sort();
    if (dates.length === 0) return { kind, etat: 'manquant' as const };
    const jusqu = ajouterMois(dates[dates.length - 1], VALIDITE_MOIS[kind] ?? 12);
    return { kind, etat: (jusqu < aujourdhui ? 'expire' : 'ok') as 'expire' | 'ok', jusqu };
  });
  return { aJour: details.every(d => d.etat === 'ok'), details };
}

// ── Spécialités ─────────────────────────────────────────────────────────────
// Ce que le prestataire sait faire, déclaré à l'inscription : aide l'admin à
// savoir à qui confier quelle mission. Clés stockées en base (prestataires.specialites).
export const SPECIALITES = [
  { key: 'location_courte', label: 'Ménage location courte durée' },
  { key: 'hotellerie', label: 'Hôtellerie' },
  { key: 'bureaux', label: 'Bureaux et locaux pro' },
  { key: 'fin_chantier', label: 'Fin de chantier / remise en état' },
  { key: 'vitrerie', label: 'Vitrerie' },
  { key: 'domicile', label: 'Ménage chez les particuliers' },
  { key: 'copropriete', label: 'Parties communes / copropriété' },
  { key: 'textile', label: 'Moquettes, tapis, canapés' },
  { key: 'linge', label: 'Linge / blanchisserie' },
  { key: 'livraison', label: 'Livraison' },
] as const;

export type Specialite = (typeof SPECIALITES)[number]['key'];

/** Garde uniquement les clés connues, sans doublon, dans l'ordre de la liste. */
export function specialitesValides(v: unknown): Specialite[] {
  const recu = new Set(Array.isArray(v) ? v.map(String) : []);
  return SPECIALITES.map(s => s.key).filter(k => recu.has(k));
}

export function libelleSpecialite(key: string): string {
  return SPECIALITES.find(s => s.key === key)?.label ?? key;
}
