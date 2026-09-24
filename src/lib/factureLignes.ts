// ── Les lignes d'une facture client (logique PURE) ──────────────────────────
//
//  POURQUOI CE MODULE EXISTE
//  Jusqu'ici une facture était une ligne par ménage : date, logement, montant.
//  Dès qu'on fournit le linge et les consommables, ce n'est plus vrai — et ce
//  n'est pas un détail de présentation, c'est une règle fiscale.
//
//  LE MÉNAGE EST UN SERVICE À LA PERSONNE, LE LINGE EST UNE MARCHANDISE.
//  Le crédit d'impôt (et l'avance immédiate URSSAF) ne porte QUE sur le service.
//  Mélanger les deux sur une ligne, c'est déclarer une base éligible fausse.
//  D'où la règle : une ligne « ménage », une ligne « fourniture », jamais un
//  total fusionné. Voir lib/creditImpot.ts et lib/linge.ts.
//
//  CE MODULE NE LIT RIEN : on lui donne les ménages et la fourniture de chacun,
//  il rend les lignes. Les montants viennent du serveur (le prix d'un kit vit
//  dans profit_config, fermée au navigateur).
//
//  AUCUNE DURÉE NE SORT D'ICI. Le temps passé par l'intervenant est une donnée
//  interne (elle pilote la paie) : la facture est un document CLIENT, et un
//  client qui lit « 47 min » discute le prix au lieu de la prestation. Ce qu'on
//  facture, c'est un ménage, pas des minutes. La colonne annonce donc une
//  QUANTITÉ — mention obligatoire sur une facture (art. L.441-9 du code de
//  commerce) — et jamais un chrono.

/** Ce qu'on sait d'un ménage au moment de le facturer. */
export interface MenageAFacturer {
  id: string;
  date: string;
  /** Nom du logement ou de la chambre — ce que le client reconnaît. */
  logement: string;
  /** Type de mission, pour la colonne « Prestation ». */
  type: string;
  cleaner?: string;
  /** Prix du ménage seul, hors fourniture. */
  prix: number;
  /** La fourniture de ce passage, si le logement en a une. */
  fourniture?: { montant: number; libelle: string; kits: number } | null;
}

export interface LigneFacture {
  /** L'identifiant du ménage d'origine — deux lignes peuvent le partager. */
  missionId: string;
  date: string;
  label: string;
  /** 'fourniture' pour le linge et les consommables ; sinon le type du ménage. */
  type: string;
  apartment: string;
  cleaner: string;
  /** Quantité facturée : 1 ménage, ou le nombre de kits d'une fourniture. */
  quantite: number;
  unitPrice: number;
  amount: number;
  /** Vrai pour une ligne de marchandise : hors crédit d'impôt. */
  fourniture?: boolean;
}

const centimes = (v: number) => Math.round(v * 100) / 100;

/**
 * Développe les ménages en lignes de facture.
 *
 * La fourniture suit immédiatement son ménage : le client lit « Le Cocon — 50 €,
 * Linge 2 kits — 9 € », pas deux blocs séparés qu'il faudrait rapprocher.
 */
export function lignesFacture(menages: MenageAFacturer[]): LigneFacture[] {
  const lignes: LigneFacture[] = [];

  for (const m of menages) {
    const logement = m.logement || 'Logement';
    lignes.push({
      missionId: m.id,
      date: m.date,
      label: logement,
      type: m.type,
      apartment: logement,
      cleaner: m.cleaner || '—',
      quantite: 1,
      unitPrice: centimes(m.prix),
      amount: centimes(m.prix),
    });

    // `ligneFourniture` a déjà écarté les logements sans fourniture : ici, un
    // montant nul ne mérite pas de ligne — elle ferait douter le client.
    const f = m.fourniture;
    if (f && f.montant > 0) {
      lignes.push({
        missionId: m.id,
        date: m.date,
        label: f.libelle,
        type: 'fourniture',
        apartment: logement,
        cleaner: '—',
        quantite: f.kits > 0 ? f.kits : 1,
        unitPrice: centimes(f.montant),
        amount: centimes(f.montant),
        fourniture: true,
      });
    }
  }

  return lignes;
}

export interface TotauxFacture {
  /** Prestations de ménage — la base du crédit d'impôt. */
  prestations: number;
  /** Linge et consommables — marchandises, hors crédit d'impôt. */
  fournitures: number;
  /** Ce que le client doit. */
  total: number;
}

/** Les trois montants qu'une facture doit pouvoir annoncer séparément. */
export function totauxFacture(lignes: LigneFacture[]): TotauxFacture {
  let prestations = 0;
  let fournitures = 0;
  for (const l of lignes) {
    if (l.fourniture) fournitures += l.amount;
    else prestations += l.amount;
  }
  return {
    prestations: centimes(prestations),
    fournitures: centimes(fournitures),
    total: centimes(prestations + fournitures),
  };
}

/**
 * Applique les montants corrigés à la main par l'administration.
 *
 * L'écran de facturation laisse retoucher le prix d'un ménage (un supplément
 * convenu, un geste commercial). La correction porte sur LA PRESTATION, jamais
 * sur la fourniture : le linge est facturé ce qu'il coûte, il ne se négocie pas
 * à la ligne. Sans cette distinction, un rabais sur le ménage gonflerait
 * silencieusement la base du crédit d'impôt.
 */
export function appliquerCorrections(
  menages: MenageAFacturer[],
  corrections: Record<string, string | number | undefined>,
): MenageAFacturer[] {
  return menages.map(m => {
    const brut = corrections[m.id];
    if (brut === undefined || brut === '') return m;
    const v = Number(brut);
    return Number.isFinite(v) ? { ...m, prix: v } : m;
  });
}
