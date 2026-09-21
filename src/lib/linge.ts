// ── Fourniture de linge et consommables (logique PURE) ───────────────────────
//
// POURQUOI UNE LIGNE À PART, ET JAMAIS DANS LE PRIX DU MÉNAGE
//
// Le linge et les consommables sont des BIENS. Ils n'ouvrent aucun droit au
// crédit d'impôt « services à la personne » — seul le service y ouvre droit.
// Noyés dans le prix du ménage chez un particulier, ils gonfleraient la base
// éligible, et c'est sur cette base que passe l'avance immédiate URSSAF : on
// déclarerait une avance sur une dépense qui n'y donne pas droit.
//
// Trois raisons de plus, valables même chez un client Airbnb ou professionnel
// qui n'a de toute façon aucun crédit d'impôt :
//   · le prix du linge bouge — on veut pouvoir le relever sans rouvrir la
//     négociation sur le ménage ;
//   · le client qui décide de fournir son linge fait retirer UNE ligne, au lieu
//     de demander une baisse du prix du ménage ;
//   · la marge du ménage reste lisible : quelques euros de linge par passage
//     mangeraient la marge sans qu'on le voie.
//
// DEUX FAÇONS DE FACTURER, selon le logement :
//   · AU KIT — le cas courant : un prix de kit, valable partout, multiplié par
//     le nombre de kits que demande le logement ;
//   · AU FORFAIT — un montant négocié pour ce logement, qui remplace le calcul.
// Et bien sûr : AUCUNE, quand le client fournit son propre linge.

export type ModeLinge = 'aucun' | 'kit' | 'forfait';

export interface FournitureLogement {
  mode: ModeLinge;
  /** Nombre de kits par passage (mode « kit »). */
  kits?: number | null;
  /** Montant négocié par ménage (mode « forfait »). */
  forfait?: number | null;
  /** Libellé libre, affiché sur la facture (« linge + consommables »). */
  libelle?: string | null;
}

export interface LigneFourniture {
  /** Ce qui est facturé au client, en euros. */
  montant: number;
  /** Libellé de la ligne de facture. */
  libelle: string;
  /** Nombre de kits, quand le calcul en dépend (pour la traçabilité). */
  kits: number;
}

/** Arrondi au centime — jamais de 8.700000000000001 sur une facture. */
function centimes(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Ce qu'on facture au client pour la fourniture, sur UN ménage.
 *
 * Renvoie `null` quand il n'y a rien à facturer : pas de ligne vide sur la
 * facture, pas de « 0,00 € » qui oblige le client à se demander ce que c'est.
 */
export function ligneFourniture(
  f: FournitureLogement | null | undefined,
  prixKit: number,
): LigneFourniture | null {
  if (!f || f.mode === 'aucun') return null;

  if (f.mode === 'forfait') {
    const montant = centimes(Number(f.forfait) || 0);
    if (montant <= 0) return null;
    return { montant, libelle: f.libelle?.trim() || 'Linge et consommables', kits: 0 };
  }

  // Mode « kit ».
  const kits = Math.max(0, Math.round(Number(f.kits) || 0));
  const prix = Math.max(0, Number(prixKit) || 0);
  const montant = centimes(kits * prix);
  if (kits === 0 || montant <= 0) return null;

  const base = f.libelle?.trim() || 'Linge';
  return {
    montant,
    libelle: kits > 1 ? `${base} — ${kits} kits` : `${base} — 1 kit`,
    kits,
  };
}

/**
 * Base éligible au crédit d'impôt : le ménage SEUL.
 *
 * C'est la règle qui justifie toute cette séparation. Le total facturé est
 * ménage + fourniture ; l'avantage fiscal ne porte que sur le premier.
 */
export function baseEligible(prixMenage: number): number {
  return centimes(Math.max(0, Number(prixMenage) || 0));
}

/** Total réellement facturé au client pour ce ménage. */
export function totalFacture(prixMenage: number, fourniture: LigneFourniture | null): number {
  return centimes((Number(prixMenage) || 0) + (fourniture?.montant ?? 0));
}

/**
 * Ce que la fourniture COÛTE à l'entreprise sur ce ménage — pour que la marge
 * affichée reste vraie. Un kit facturé 4,50 € qui en coûte 3,20 ne rapporte pas
 * 4,50 : c'est la différence qui compte.
 */
export function coutFourniture(
  f: FournitureLogement | null | undefined,
  coutKit: number,
  kitsForfait = 0,
): number {
  if (!f || f.mode === 'aucun') return 0;
  const unite = Math.max(0, Number(coutKit) || 0);
  // Au forfait, le nombre de kits réellement posés n'est pas dans le prix : on
  // s'appuie sur le nombre indiqué pour le logement, à défaut sur celui passé.
  const kits = f.mode === 'forfait'
    ? Math.max(0, Math.round(Number(f.kits) || kitsForfait || 0))
    : Math.max(0, Math.round(Number(f.kits) || 0));
  return centimes(kits * unite);
}
