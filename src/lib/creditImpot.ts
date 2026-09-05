// ════════════════════════════════════════════════════════════════════════════
//  Crédit d'impôt « services à la personne » (art. 199 sexdecies du CGI)
//  Module PUR — aucune dépendance React/Supabase, testé unitairement.
//
//  Le client particulier qui fait entretenir SON domicile récupère 50 % de la
//  dépense. Nous passons par un service mandataire inscrit à l'avance immédiate
//  URSSAF : le client ne règle que la moitié au moment de la prestation, l'autre
//  moitié est versée directement par l'URSSAF. Ce n'est donc pas un
//  remboursement différé, et le site a le droit de l'annoncer comme tel.
//
//  ATTENTION — ce n'est PAS un rabais commercial :
//   • il ne s'applique qu'aux prestations réalisées au DOMICILE d'un particulier
//     (résidence principale ou secondaire, en France) ;
//   • un meublé touristique (Airbnb) et un local professionnel n'y ouvrent
//     AUCUN droit : c'est l'activité du client, pas son domicile ;
//   • il est plafonné à l'année et par foyer fiscal, pas par prestation.
//  D'où `isEligibleSelection` ci-dessous, volontairement prudente.
// ════════════════════════════════════════════════════════════════════════════

/** Taux légal du crédit d'impôt : 50 % de la dépense supportée. */
export const CREDIT_RATE = 0.5;

/** Plafond annuel de dépenses par foyer fiscal (cas général). */
export const CREDIT_CEILING = 12_000;

/** Avantage maximal correspondant : 50 % de 12 000 €. */
export const CREDIT_MAX = CREDIT_CEILING * CREDIT_RATE;

/** Plafond majoré (enfant à charge, membre du foyer de plus de 65 ans). */
export const CREDIT_CEILING_MAX = 15_000;

/**
 * Numéro de déclaration « organisme de services à la personne » à afficher.
 *
 * ATTENTION : l'agrément n'est PAS celui de MonCleanerPro. Nous intervenons dans
 * le cadre de la coopérative SAP par laquelle passent la facturation client et
 * l'avance immédiate — c'est son agrément qui ouvre le droit au crédit d'impôt.
 * Le numéro à mettre ici est donc le sien, et la mention doit dire au nom de qui
 * il est délivré. Tant que la constante est vide, l'interface n'affiche aucune
 * mention légale : mieux vaut pas de numéro qu'un numéro inventé ou mal attribué.
 */
export const SAP_NUMBER = '';

/**
 * Macro-catégories du catalogue (`devisCatalog.ts`) ouvrant droit au crédit.
 *
 * `residentiel` : entretien classique, grand ménage, coliving — le cœur du
 *   dispositif, sans sous-plafond.
 * `vst` : vitres, sols et textiles font partie de « l'entretien de la maison »
 *   dès lors qu'ils sont réalisés chez l'habitant.
 *
 * Volontairement EXCLUS : `airbnb` et `pro` (jamais un domicile), `remise`
 * (chantier, souvent un bien vacant), `ext` (façades et extérieurs, terrain
 * fiscal incertain — le jardinage relève d'un autre plafond). Sous-promettre
 * est ici la seule position tenable : annoncer un avantage que le client ne
 * touchera pas se retourne contre nous.
 *
 * Une seule ligne à changer si le comptable tranche autrement.
 */
export const ELIGIBLE_MACROS: readonly string[] = ['residentiel', 'vst'];

export function isEligibleMacro(macro: string): boolean {
  return ELIGIBLE_MACROS.includes(macro);
}

/**
 * Une sélection ouvre droit au crédit si elle n'est pas vide et si TOUTES ses
 * prestations sont éligibles. Un panier mixte (ménage du domicile + nettoyage
 * du local pro) n'affiche rien : impossible d'annoncer un net honnête sans
 * séparer les deux, et une moitié fausse vaut moins que pas de chiffre.
 */
export function isEligibleSelection(macros: string[]): boolean {
  return macros.length > 0 && macros.every(isEligibleMacro);
}

/** Reste à charge du client après crédit d'impôt, arrondi à l'euro. */
export function netAfterCredit(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return Math.round(amount * (1 - CREDIT_RATE));
}

/**
 * Montant du crédit pour une dépense annuelle donnée, plafond compris.
 * Sert aux pages qui expliquent le dispositif (SEO) plutôt qu'au devis :
 * une prestation isolée atteint rarement le plafond, mais un ménage
 * hebdomadaire sur l'année, si.
 */
export function creditForYear(annualSpend: number, ceiling: number = CREDIT_CEILING): number {
  if (!Number.isFinite(annualSpend) || annualSpend <= 0) return 0;
  return Math.round(Math.min(annualSpend, ceiling) * CREDIT_RATE);
}
