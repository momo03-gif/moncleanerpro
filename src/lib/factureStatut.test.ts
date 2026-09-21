import { describe, it, expect } from 'vitest';
import { vueFacture, echeance, joursEntre, resteADevoir } from './factureStatut';

const LE_10 = new Date('2026-10-10T12:00:00Z');

describe('vueFacture — ce que le partenaire voit', () => {
  it('payée : vert, et rien d’autre à dire', () => {
    const v = vueFacture({ status: 'paid' });
    expect(v).toMatchObject({ etat: 'payee', couleur: 'vert', libelle: 'Payée' });
  });

  it('reconnaît un paiement même si le statut n’a pas suivi', () => {
    expect(vueFacture({ status: 'sent', paidAt: '2026-10-01' }).couleur).toBe('vert');
  });

  it('non payée avant l’échéance : rouge, mais sans reproche', () => {
    const v = vueFacture({ status: 'sent', dueDate: '2026-10-31' }, LE_10);
    expect(v).toMatchObject({ etat: 'a_payer', couleur: 'rouge', libelle: 'À payer' });
    expect(v.joursDeRetard).toBe(0);
  });

  it('en retard : on dit depuis combien de jours', () => {
    // Une facture en retard ne doit pas se confondre avec une facture émise ce
    // matin : c'est là que la relance se joue.
    const v = vueFacture({ status: 'sent', dueDate: '2026-10-03' }, LE_10);
    expect(v.etat).toBe('en_retard');
    expect(v.libelle).toBe('En retard depuis 7 jours');
    expect(v.joursDeRetard).toBe(7);
  });

  it('accorde le singulier au premier jour', () => {
    expect(vueFacture({ status: 'sent', dueDate: '2026-10-09' }, LE_10).libelle)
      .toBe('En retard depuis 1 jour');
  });

  it('le jour de l’échéance, on n’est pas encore en retard', () => {
    expect(vueFacture({ status: 'sent', dueDate: '2026-10-10' }, LE_10).etat).toBe('a_payer');
  });

  it('sans échéance, une facture impayée est simplement à payer', () => {
    expect(vueFacture({ status: 'issued' }, LE_10).etat).toBe('a_payer');
  });
});

describe('echeance — trente jours, comme le contrat', () => {
  it('ajoute trente jours à la date de facture', () => {
    expect(echeance('2026-10-01')).toBe('2026-10-31');
  });
  it('passe un changement de mois sans se tromper', () => {
    expect(echeance('2026-12-15')).toBe('2027-01-14');
  });
  it('accepte un autre délai', () => {
    expect(echeance('2026-10-01', 15)).toBe('2026-10-16');
  });
});

describe('resteADevoir', () => {
  it('additionne ce qui n’est pas payé', () => {
    expect(resteADevoir([
      { status: 'paid', total: 100 },
      { status: 'sent', total: 250.5 },
      { status: 'issued', total: 49.5 },
    ])).toBe(300);
  });
  it('ne compte pas une facture réglée hors statut', () => {
    expect(resteADevoir([{ status: 'sent', paidAt: '2026-10-02', total: 80 }])).toBe(0);
  });
});

describe('joursEntre', () => {
  it('compte des jours entiers, pas des heures', () => {
    expect(joursEntre('2026-10-01', new Date('2026-10-04T23:00:00Z'))).toBe(3);
  });
});
