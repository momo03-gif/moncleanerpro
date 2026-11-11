import { describe, it, expect } from 'vitest';
import { montantsDepuisLignesHT, montantsFactureEnregistree, estFactureHT } from './factureTva';

describe('facture à émettre — les prix du site sont HT', () => {
  it('ajoute la TVA au lieu de l’extraire', () => {
    const m = montantsDepuisLignesHT([{ amount: 50 }, { amount: 50 }], true);
    expect(m).toEqual({ ht: 100, tva: 20, debours: 0, ttc: 120, tvaApplicable: true, lignesHT: true });
  });
  it('sans n° de TVA : pas de TVA, le total est la somme', () => {
    const m = montantsDepuisLignesHT([{ amount: 100 }], false);
    expect(m.ttc).toBe(100);
    expect(m.tva).toBe(0);
  });
  it('les achats d’une course (débours) passent au réel, sans TVA ajoutée', () => {
    const m = montantsDepuisLignesHT([{ amount: 40 }, { amount: 23.5, horsTva: true }], true);
    expect(m).toMatchObject({ ht: 40, tva: 8, debours: 23.5, ttc: 71.5 });
  });
  it('arrondit au centime', () => {
    const m = montantsDepuisLignesHT([{ amount: 33.33 }], true);
    expect(m.tva).toBe(6.67);
    expect(m.ttc).toBe(40);
  });
});

describe('facture enregistrée', () => {
  it('nouvelle facture (lignes marquées HT) relue à l’identique', () => {
    const lignes = [{ amount: 50, prixHT: true }, { amount: 50, prixHT: true }];
    expect(estFactureHT(lignes)).toBe(true);
    expect(montantsFactureEnregistree(lignes, 120, true)).toEqual({ ht: 100, tva: 20, debours: 0, ttc: 120, tvaApplicable: true, lignesHT: true });
  });
  it('ANCIENNE facture (sans marque) : affichée exactement comme avant', () => {
    const lignes = [{ amount: 60 }, { amount: 60 }];
    expect(estFactureHT(lignes)).toBe(false);
    expect(montantsFactureEnregistree(lignes, 120, true)).toEqual({ ht: 100, tva: 20, debours: 0, ttc: 120, tvaApplicable: true, lignesHT: false });
  });
  it('ancienne facture dont la somme vaut ×1,2 : reste une ancienne (pas de devinette)', () => {
    expect(montantsFactureEnregistree([{ amount: 100 }], 120, true).lignesHT).toBe(false);
  });
  it('nouvelle facture avec débours', () => {
    const lignes = [{ amount: 40, prixHT: true }, { amount: 23.5, horsTva: true, prixHT: true }];
    expect(montantsFactureEnregistree(lignes, 71.5, true)).toMatchObject({ ht: 40, tva: 8, debours: 23.5, ttc: 71.5 });
  });
  it('total ≠ somme des lignes (devis du site) : le total réclamé fait foi', () => {
    const m = montantsFactureEnregistree([{ amount: 30, prixHT: true }], 42, true);
    expect(m.ttc).toBe(42);
    expect(m.ht).toBe(35);
    expect(m.tva).toBe(7);
  });
  it('sans TVA', () => {
    expect(montantsFactureEnregistree([{ amount: 80 }], 80, false)).toMatchObject({ ht: 80, tva: 0, ttc: 80 });
    expect(montantsFactureEnregistree([{ amount: 80, prixHT: true }], 80, false)).toMatchObject({ ht: 80, tva: 0, ttc: 80 });
  });
  it('facture vide', () => {
    expect(montantsFactureEnregistree([], 0, true).ttc).toBe(0);
  });
});
