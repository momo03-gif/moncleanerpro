// ── TVA d'une facture (logique PURE) ─────────────────────────────────────────
//
//  LES PRIX DU SITE SONT HORS TAXE.
//  Le prix d'un ménage (logement, grille tarifaire, devis) est un prix HT. Une
//  facture part donc des lignes HT et AJOUTE la TVA. Jusqu'au 11/11/2026, la
//  facture faisait l'inverse : elle prenait la somme des lignes pour un TTC et
//  en EXTRAYAIT la TVA (total ÷ 1,2). Le client payait 100 € TTC un ménage
//  annoncé 100 € HT — 20 % de chiffre d'affaires perdus, et un devis (qui, lui,
//  ajoutait bien la TVA) qui ne correspondait plus à sa facture.
//
//  CE QUI NE CHANGE PAS : `invoices.total` reste le montant DÛ, TTC. Paiements,
//  relances, espace partenaire et TVA collectée (comptabilité) le lisent comme
//  tel ; ils restent justes sans modification.
//
//  LES FACTURES DÉJÀ ÉMISES NE BOUGENT PAS. Une facture émise ne se réécrit
//  pas. Les nouvelles portent `prixHT: true` sur leurs lignes (dans le JSON
//  `lines`, aucune colonne à ajouter) ; une facture sans cette marque est une
//  ancienne, au total TTC, et s'affiche exactement comme avant. On ne devine
//  pas le format d'après les montants : un devis du site peut avoir un total
//  (milieu de fourchette) différent de la somme de ses lignes.
//
//  DÉBOURS : les achats d'une course sont refacturés AU RÉEL, au montant du
//  ticket (qui contient déjà sa TVA). Ils ne reçoivent pas de TVA en plus —
//  sinon le client paierait 20 % de plus que ce qu'il a coûté. Ils s'ajoutent
//  au TTC tels quels, hors base HT.

export const TAUX_TVA = 0.2;

const c = (v: number) => Math.round(v * 100) / 100;

export interface MontantsFacture {
  /** Base hors taxe (débours exclus). */
  ht: number;
  /** TVA due sur la base HT. */
  tva: number;
  /** Débours refacturés au réel, hors TVA. */
  debours: number;
  /** Ce que le client doit. */
  ttc: number;
  /** La société facture-t-elle la TVA ? (n° de TVA renseigné) */
  tvaApplicable: boolean;
  /** Les montants des lignes sont-ils HT ? (faux pour les anciennes factures) */
  lignesHT: boolean;
}

export interface LigneMontant { amount: number; horsTva?: boolean; prixHT?: boolean }

function sommes(lignes: LigneMontant[]) {
  let base = 0, debours = 0;
  for (const l of lignes) {
    const v = Number(l.amount) || 0;
    if (l.horsTva) debours += v; else base += v;
  }
  return { base: c(base), debours: c(debours) };
}

/** Montants d'une facture À ÉMETTRE : les lignes sont des prix HT. */
export function montantsDepuisLignesHT(lignes: LigneMontant[], tvaApplicable: boolean): MontantsFacture {
  const { base, debours } = sommes(lignes);
  const tva = tvaApplicable ? c(base * TAUX_TVA) : 0;
  return { ht: base, tva, debours, ttc: c(base + tva + debours), tvaApplicable, lignesHT: true };
}

/** Une facture enregistrée est-elle au format « lignes HT » ? */
export function estFactureHT(lignes: LigneMontant[]): boolean {
  return lignes.some(l => l.prixHT === true);
}

/**
 * Montants d'une facture ENREGISTRÉE, quel que soit son format. Le total
 * enregistré (TTC, ce qui a été réclamé au client) fait toujours foi.
 */
export function montantsFactureEnregistree(lignes: LigneMontant[], total: number, tvaApplicable: boolean): MontantsFacture {
  const t = c(Number(total) || 0);

  if (estFactureHT(lignes)) {
    const { debours } = sommes(lignes);
    const calcule = montantsDepuisLignesHT(lignes, tvaApplicable);
    if (Math.abs(calcule.ttc - t) <= 0.011) return { ...calcule, ttc: t };
    // Total différent de la somme des lignes (devis du site au milieu de sa
    // fourchette, par exemple) : on repart du total réclamé.
    const ht = tvaApplicable ? c((t - debours) / (1 + TAUX_TVA)) : c(t - debours);
    return { ht, tva: c(t - debours - ht), debours, ttc: t, tvaApplicable, lignesHT: true };
  }

  // Ancienne facture : le total contenait déjà la TVA (logique d'avant, inchangée).
  if (!tvaApplicable) return { ht: t, tva: 0, debours: 0, ttc: t, tvaApplicable, lignesHT: false };
  const ht = c(t / (1 + TAUX_TVA));
  return { ht, tva: c(t - ht), debours: 0, ttc: t, tvaApplicable, lignesHT: false };
}
