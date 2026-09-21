// ── État de paiement d'une facture, vu par le client (logique PURE) ──────────
//
// Le partenaire doit savoir en un coup d'œil ce qu'il doit. Trois états, et le
// choix des couleurs suit ce que l'œil comprend sans légende :
//
//   · PAYÉE      → vert. Rien à faire.
//   · À PAYER    → rouge, mais avec sa date d'échéance affichée. Le client voit
//                  qu'il doit, sans se sentir en faute avant le terme.
//   · EN RETARD  → rouge, et on dit depuis combien de jours. C'est là que la
//                  relance se joue, et une facture en retard ne doit pas se
//                  confondre avec une facture émise ce matin.
//
// La nuance « à payer » / « en retard » n'existe que si la facture porte une
// échéance. Sans échéance, une facture non payée est simplement à payer.

export type EtatFacture = 'payee' | 'a_payer' | 'en_retard';

export interface FactureVue {
  etat: EtatFacture;
  /** Ce qu'on écrit à l'écran. */
  libelle: string;
  /** Vert pour payé, rouge sinon — la demande est là, et elle est juste. */
  couleur: 'vert' | 'rouge';
  /** Nombre de jours de retard, quand il y en a. */
  joursDeRetard: number;
}

function jourSeul(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Nombre de jours entiers entre deux dates, sans se soucier des heures. */
export function joursEntre(depuis: string | Date, jusqua: string | Date): number {
  const a = depuis instanceof Date ? depuis : new Date(depuis + 'T00:00:00Z');
  const b = jusqua instanceof Date ? jusqua : new Date(jusqua + 'T00:00:00Z');
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.round((jourSeul(b) - jourSeul(a)) / 86400000);
}

export function vueFacture(
  facture: { status?: string | null; dueDate?: string | null; paidAt?: string | null },
  aujourdhui: Date = new Date(),
): FactureVue {
  if (facture.status === 'paid' || facture.paidAt) {
    return { etat: 'payee', libelle: 'Payée', couleur: 'vert', joursDeRetard: 0 };
  }

  if (facture.dueDate) {
    const retard = joursEntre(facture.dueDate, aujourdhui);
    if (retard > 0) {
      return {
        etat: 'en_retard',
        libelle: retard === 1 ? 'En retard depuis 1 jour' : `En retard depuis ${retard} jours`,
        couleur: 'rouge',
        joursDeRetard: retard,
      };
    }
  }

  return { etat: 'a_payer', libelle: 'À payer', couleur: 'rouge', joursDeRetard: 0 };
}

/**
 * Échéance d'une facture : trente jours date de facture, comme le prévoit le
 * contrat. Calculée ici pour qu'elle ne dépende pas de ce qu'on a saisi.
 */
export function echeance(dateFacture: string, joursDePaiement = 30): string {
  const d = new Date(dateFacture + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return dateFacture;
  d.setUTCDate(d.getUTCDate() + joursDePaiement);
  return d.toISOString().slice(0, 10);
}

/** Total encore dû, pour l'afficher en tête de la liste. */
export function resteADevoir(
  factures: { status?: string | null; paidAt?: string | null; total?: number | null }[],
): number {
  const somme = factures
    .filter(f => f.status !== 'paid' && !f.paidAt)
    .reduce((s, f) => s + (Number(f.total) || 0), 0);
  return Math.round(somme * 100) / 100;
}
