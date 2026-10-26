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

// ── Métier et spécialités ───────────────────────────────────────────────────
// Deux profils de prestataire : les pros du nettoyage et les artisans (petits
// travaux, réparations dans les logements). Chacun déclare ses spécialités à
// l'inscription : ça aide l'admin à savoir à qui confier quoi.
// Clés stockées en base (prestataires.metier, prestataires.specialites).
export const METIERS = [
  { key: 'nettoyage', label: 'Professionnel du nettoyage' },
  { key: 'artisan', label: 'Artisan / petits travaux' },
] as const;

export type Metier = (typeof METIERS)[number]['key'];

export const SPECIALITES = [
  { key: 'location_courte', metier: 'nettoyage', label: 'Ménage location courte durée' },
  { key: 'hotellerie', metier: 'nettoyage', label: 'Hôtellerie' },
  { key: 'bureaux', metier: 'nettoyage', label: 'Bureaux et locaux pro' },
  { key: 'fin_chantier', metier: 'nettoyage', label: 'Fin de chantier / remise en état' },
  { key: 'vitrerie', metier: 'nettoyage', label: 'Vitrerie' },
  { key: 'domicile', metier: 'nettoyage', label: 'Ménage chez les particuliers' },
  { key: 'copropriete', metier: 'nettoyage', label: 'Parties communes / copropriété' },
  { key: 'textile', metier: 'nettoyage', label: 'Moquettes, tapis, canapés' },
  { key: 'linge', metier: 'nettoyage', label: 'Linge / blanchisserie' },
  { key: 'livraison', metier: 'nettoyage', label: 'Livraison' },
  { key: 'rebouchage', metier: 'artisan', label: 'Rebouchage de trous, enduits' },
  { key: 'peinture', metier: 'artisan', label: 'Peinture' },
  { key: 'serrurerie', metier: 'artisan', label: 'Serrurerie (changement de serrure)' },
  { key: 'literie', metier: 'artisan', label: 'Matelas et literie (réparation, remplacement)' },
  { key: 'plomberie', metier: 'artisan', label: 'Plomberie (fuite, robinet, WC)' },
  { key: 'electricite', metier: 'artisan', label: 'Électricité (prise, luminaire)' },
  { key: 'meubles', metier: 'artisan', label: 'Montage et réparation de meubles' },
  { key: 'menuiserie', metier: 'artisan', label: 'Menuiserie (portes, placards)' },
  { key: 'joints', metier: 'artisan', label: 'Joints, silicone, carrelage' },
  { key: 'electromenager', metier: 'artisan', label: 'Électroménager (installation, remplacement)' },
  { key: 'multiservice', metier: 'artisan', label: 'Petits travaux divers' },
] as const satisfies readonly { key: string; metier: Metier; label: string }[];

export type Specialite = (typeof SPECIALITES)[number]['key'];

export function metierValide(v: unknown): Metier {
  return v === 'artisan' ? 'artisan' : 'nettoyage';
}

export function libelleMetier(key: string | null | undefined): string {
  return METIERS.find(m => m.key === key)?.label ?? METIERS[0].label;
}

/** Spécialités proposées pour un métier, dans l'ordre d'affichage. */
export function specialitesDuMetier(metier: Metier) {
  return SPECIALITES.filter(s => s.metier === metier);
}

/**
 * Garde uniquement les clés connues (et du métier donné, s'il l'est), sans
 * doublon, dans l'ordre de la liste.
 */
export function specialitesValides(v: unknown, metier?: Metier): Specialite[] {
  const recu = new Set(Array.isArray(v) ? v.map(String) : []);
  return SPECIALITES.filter(s => !metier || s.metier === metier).map(s => s.key).filter(k => recu.has(k));
}

export function libelleSpecialite(key: string): string {
  return SPECIALITES.find(s => s.key === key)?.label ?? key;
}

/**
 * Spécialités qui correspondent à une mission, d'après ce qu'on en sait
 * (origine, type de site, prestation). Sert à proposer d'abord les bons
 * prestataires quand on confie la mission ; ne bloque rien.
 */
export function specialitesPourMission(m: {
  source?: string | null; siteType?: string | null; service?: string | null; repairSpecialite?: string | null;
}): Specialite[] {
  // Intervention : la spécialité visée, ou à défaut n'importe quel artisan.
  if (m.service === 'repair') {
    const visee = specialitesValides([m.repairSpecialite], 'artisan');
    return visee.length ? visee : specialitesDuMetier('artisan').map(s => s.key);
  }
  const out = new Set<Specialite>();
  if (m.service === 'delivery' || m.service === 'cleaning_delivery') { out.add('livraison'); out.add('linge'); }
  if (m.service !== 'delivery') {
    if (m.source === 'hotel') out.add('hotellerie');
    else if (m.siteType === 'office' || m.siteType === 'gym') out.add('bureaux');
    else if (m.source === 'airbnb') out.add('location_courte');
  }
  return [...out];
}

/** Le prestataire a-t-il au moins une des spécialités attendues ? */
export function correspondSpecialite(specialites: readonly string[] | null | undefined, attendues: readonly string[]): boolean {
  return attendues.length > 0 && (specialites ?? []).some(s => attendues.includes(s));
}

// ── Véhicules ───────────────────────────────────────────────────────────────
// Le prestataire dit s'il est véhiculé, et avec quoi (plusieurs choix
// possibles), du plus léger au plus gros. En base (prestataires.vehicules) :
// NULL = non renseigné, [] = pas véhiculé, sinon les clés ci-dessous.
export const VEHICULES = [
  { key: 'velo', label: 'Vélo' },
  { key: 'trottinette', label: 'Trottinette' },
  { key: 'scooter', label: 'Scooter' },
  { key: 'voiture', label: 'Voiture' },
  { key: 'camionnette', label: 'Camionnette' },
] as const;

export type Vehicule = (typeof VEHICULES)[number]['key'];

/** Clés connues, sans doublon, dans l'ordre de la liste. */
export function vehiculesValides(v: unknown): Vehicule[] {
  const recu = new Set(Array.isArray(v) ? v.map(String) : []);
  return VEHICULES.map(x => x.key).filter(k => recu.has(k));
}

/** « Voiture, Camionnette », « Non véhiculé », ou « Non renseigné » (NULL). */
export function libelleVehicules(v: readonly string[] | null | undefined): string {
  if (v == null) return 'Non renseigné';
  const cles = vehiculesValides(v);
  if (!cles.length) return 'Non véhiculé';
  return cles.map(k => VEHICULES.find(x => x.key === k)!.label).join(', ');
}
