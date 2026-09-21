import { describe, it, expect } from 'vitest';
import { ligneFourniture, baseEligible, totalFacture, coutFourniture } from './linge';

describe('ligneFourniture — ce qu’on facture pour le linge', () => {
  it('multiplie le nombre de kits par le prix du kit', () => {
    const l = ligneFourniture({ mode: 'kit', kits: 2 }, 4.5);
    expect(l).toEqual({ montant: 9, libelle: 'Linge — 2 kits', kits: 2 });
  });

  it('accorde le libellé au singulier', () => {
    expect(ligneFourniture({ mode: 'kit', kits: 1 }, 4.5)?.libelle).toBe('Linge — 1 kit');
  });

  it('applique le forfait négocié tel quel, sans calcul', () => {
    const l = ligneFourniture({ mode: 'forfait', forfait: 12, kits: 3 }, 4.5);
    expect(l?.montant).toBe(12);
    expect(l?.libelle).toBe('Linge et consommables');
  });

  it('accepte un libellé propre au logement', () => {
    expect(ligneFourniture({ mode: 'forfait', forfait: 15, libelle: 'Linge + produits' }, 4.5)?.libelle)
      .toBe('Linge + produits');
  });

  it('ne met RIEN quand le client fournit son linge', () => {
    // Pas de ligne à 0,00 € sur la facture : le client se demanderait ce que c'est.
    expect(ligneFourniture({ mode: 'aucun' }, 4.5)).toBeNull();
    expect(ligneFourniture(null, 4.5)).toBeNull();
    expect(ligneFourniture({ mode: 'kit', kits: 0 }, 4.5)).toBeNull();
    expect(ligneFourniture({ mode: 'forfait', forfait: 0 }, 4.5)).toBeNull();
  });

  it('arrondit au centime', () => {
    expect(ligneFourniture({ mode: 'kit', kits: 3 }, 2.9)?.montant).toBe(8.7);
  });
});

describe('Crédit d’impôt — le linge n’y ouvre aucun droit', () => {
  it('ne compte que le ménage dans la base éligible', () => {
    // La règle qui justifie toute la séparation : le linge est un BIEN.
    // L'inclure gonflerait l'avance immédiate URSSAF sur une dépense qui n'y
    // donne pas droit.
    const linge = ligneFourniture({ mode: 'kit', kits: 2 }, 4.5);
    expect(totalFacture(45, linge)).toBe(54);
    expect(baseEligible(45)).toBe(45);
  });

  it('facture le total, ménage + fourniture', () => {
    expect(totalFacture(45, ligneFourniture({ mode: 'forfait', forfait: 12 }, 4.5))).toBe(57);
    expect(totalFacture(45, null)).toBe(45);
  });
});

describe('coutFourniture — pour que la marge reste vraie', () => {
  it('compte ce que les kits coûtent réellement', () => {
    // Un kit facturé 4,50 € qui en coûte 3,20 ne rapporte pas 4,50.
    expect(coutFourniture({ mode: 'kit', kits: 2 }, 3.2)).toBe(6.4);
  });

  it('compte aussi le coût sous un forfait', () => {
    // Au forfait, le prix ne dit pas combien de kits sont posés : on s'appuie
    // sur le nombre indiqué pour le logement.
    expect(coutFourniture({ mode: 'forfait', forfait: 12, kits: 3 }, 3.2)).toBe(9.6);
  });

  it('ne compte rien quand le client fournit', () => {
    expect(coutFourniture({ mode: 'aucun' }, 3.2)).toBe(0);
    expect(coutFourniture(null, 3.2)).toBe(0);
  });
});
