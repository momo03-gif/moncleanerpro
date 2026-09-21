// ── Abonnement ménage régulier, sans engagement (logique PURE) ───────────────
//
// L'OFFRE, telle qu'arrêtée le 22/09/2026 :
//   · le client choisit une fréquence, un jour, une heure ;
//   · il arrête son abonnement quand il veut, sans frais ni préavis ;
//   · une intervention déjà planifiée s'annule librement jusqu'à 24 h avant.
//     Passé ce délai, elle est due : le créneau ne se revend pas et le cleaner
//     est payé. C'est la règle du marché — Wecasa applique la même.
//
// La différence avec le contrat B2B (cf. contrat.ts) est assumée : un client
// professionnel dont le calendrier est connecté annule rarement, et un
// déplacement perdu se règle par les frais de déplacement. Un abonnement
// particulier, lui, occupe un créneau fixe dans la tournée d'un cleaner.

/** Heure limite d'annulation sans frais, en heures avant l'intervention. */
export const DELAI_ANNULATION_HEURES = 24;

export type Frequence = 'hebdomadaire' | 'quinzaine' | 'mensuel';

export interface OptionFrequence {
  cle: Frequence;
  libelle: string;
  /** Intervalle en semaines, pour le moteur de récurrence. */
  semaines: number;
  /** Nombre d'interventions par mois, pour annoncer un montant mensuel. */
  parMois: number;
}

export const FREQUENCES: OptionFrequence[] = [
  { cle: 'hebdomadaire', libelle: 'Chaque semaine', semaines: 1, parMois: 4.33 },
  { cle: 'quinzaine', libelle: 'Une semaine sur deux', semaines: 2, parMois: 2.17 },
  { cle: 'mensuel', libelle: 'Une fois par mois', semaines: 4, parMois: 1.08 },
];

export function frequence(cle: Frequence): OptionFrequence {
  return FREQUENCES.find(f => f.cle === cle) ?? FREQUENCES[0];
}

/**
 * Une intervention peut-elle encore être annulée sans frais ?
 *
 * `quand` est la date et l'heure de l'intervention, `maintenant` le moment de
 * la demande. On compare des instants, pas des jours : annuler « la veille »
 * à 23 h n'est pas la même chose qu'annuler la veille à 9 h.
 */
export function annulationSansFrais(
  quand: Date | string, maintenant: Date = new Date(),
): boolean {
  const t = quand instanceof Date ? quand : new Date(quand);
  if (Number.isNaN(t.getTime())) return true;   // date illisible → on ne facture pas
  const heures = (t.getTime() - maintenant.getTime()) / 3_600_000;
  return heures >= DELAI_ANNULATION_HEURES;
}

/** Le moment après lequel l'intervention devient due. */
export function limiteAnnulation(quand: Date | string): Date {
  const t = quand instanceof Date ? quand : new Date(quand);
  return new Date(t.getTime() - DELAI_ANNULATION_HEURES * 3_600_000);
}

/**
 * Montant mensuel indicatif — celui qu'on affiche au client avant de souscrire.
 * Un abonnement se compare en « par mois », pas « par passage ».
 *
 * `partCredit` est la part prise en charge par l'avance immédiate (0,5 pour un
 * particulier éligible, 0 sinon) : c'est le reste à charge qui décide.
 */
export function mensualite(prixParPassage: number, cle: Frequence, partCredit = 0): {
  parPassage: number; parMois: number; resteAChargeMois: number;
} {
  const prix = Math.max(0, Number(prixParPassage) || 0);
  const parMois = Math.round(prix * frequence(cle).parMois * 100) / 100;
  const part = Math.min(1, Math.max(0, Number(partCredit) || 0));
  return {
    parPassage: Math.round(prix * 100) / 100,
    parMois,
    resteAChargeMois: Math.round(parMois * (1 - part) * 100) / 100,
  };
}
