import { describe, it, expect } from 'vitest';
import type { Tarif } from './devis';
import type { SimulatorConfig } from './devisSimulator';
import { catalogueSansPrix, estimerSelection, lignesSelection, configPublique, etatSimulationValide } from './devisEstimation';

const T = (o: Partial<Tarif>): Tarif => ({ id: o.nom ?? 'x', nom: 'x', unite: 'forfait', prix: 0, actif: true, ...o });
const grille: Tarif[] = [
  T({ nom: 'Ménage studio', unite: 'forfait', prix: 60, prixMin: 55, prixMax: 70, categorie: 'Résidentiel', motsCles: 'studio' }),
  T({ nom: 'Vitres', unite: 'm2', prix: 4, prixMin: 3.5, prixMax: 5 }),
  T({ nom: 'Remise en état', unite: 'forfait', prix: 0 }),               // sur devis
  T({ nom: 'Ancienne', unite: 'forfait', prix: 99, actif: false }),
];

describe('Devis — la grille ne quitte pas le serveur', () => {
  it('le catalogue envoyé au navigateur ne porte AUCUN prix', () => {
    const c = catalogueSansPrix(grille);
    expect(c.map(t => t.nom)).toEqual(['Ménage studio', 'Vitres', 'Remise en état']);   // actives seulement
    for (const t of c) {
      expect(t.prixMin).toBeNull();
      expect(t.prixMax).toBeNull();
      expect(t.prix === 0 || t.prix === 1).toBe(true);   // simple marqueur « chiffré / sur devis »
      expect(t.motsCles).toBeUndefined();
    }
    expect(c.find(t => t.nom === 'Remise en état')!.prix).toBe(0);
  });

  it('chiffre la sélection comme avant : fourchette, sur devis, surface manquante', () => {
    const e = estimerSelection(grille, { 'Ménage studio': { qty: 2 }, Vitres: { qty: 10 }, 'Remise en état': { qty: 1 } });
    expect(e.min).toBe(145);   // 55×2 + 3,5×10
    expect(e.max).toBe(190);   // 70×2 + 5×10
    expect(e.quote).toEqual(['Remise en état']);
    expect(e.parNom.Vitres).toEqual({ min: 35, max: 50 });
    expect(estimerSelection(grille, { Vitres: { qty: 0 } }).incomplete).toEqual(['Vitres']);
  });

  it('ignore une prestation inconnue ou désactivée', () => {
    const e = estimerSelection(grille, { Ancienne: { qty: 1 }, Inventee: { qty: 3 } });
    expect(e).toMatchObject({ min: 0, max: 0, count: 0 });
  });

  it('les lignes du devis enregistré viennent de la grille, pas du navigateur', () => {
    const l = lignesSelection(grille, { 'Ménage studio': { qty: 2 }, Vitres: { qty: 12 } });
    expect(l).toEqual([
      { nom: 'Ménage studio', quantite: 2, prix_unitaire: 60, total: 120 },
      { nom: 'Vitres (12 m²)', quantite: 12, prix_unitaire: 4, total: 48 },
    ]);
  });
});

const cfg: SimulatorConfig = {
  tiers: [{ id: 't1', maxM2: 40, label: 'Studio', basePrice: 50, priceMax: 60, capacityIncluded: 2 }],
  zones: [{ id: 'z1', name: 'Lyon', fee: 0, communes: ['Lyon'] }, { id: 'z2', name: 'Est', fee: 10, communes: ['Bron'] }],
  options: [{ id: 'o1', key: 'linge', label: 'Linge', fee: 15, perCapacity: false, tiers: null, defaultOn: true }],
  extraGuestFee: 12, bathroomSurcharge: [{ from: 2, fee: 8 }], urgency: [{ id: 'u1', label: 'Urgent', fee: 20 }],
  minM2: 12, maxM2: 230,
};

describe('Simulateur — la config publique n’a que de quoi afficher', () => {
  it('retire paliers, suppléments et prix des options', () => {
    const p = configPublique(cfg);
    expect(p.tiers).toEqual([]);
    expect(p.extraGuestFee).toBe(0);
    expect(p.bathroomSurcharge).toEqual([]);
    expect(p.options[0]).toMatchObject({ key: 'linge', label: 'Linge', fee: 0, defaultOn: true });
    expect(p.urgency[0].fee).toBe(0);
    expect(p.zones[1].fee).toBe(10);   // affiché au visiteur (« +10 € »)
  });

  it('ramène un état reçu du navigateur dans les bornes', () => {
    const s = etatSimulationValide(cfg, { surface: 9999, travelers: -3, zoneId: 'pirate', options: ['linge', 'cadeau'], urgencyId: 'u1' });
    expect(s).toEqual({ surface: 230, travelers: 1, bathrooms: 1, zoneId: null, options: ['linge'], urgencyId: 'u1' });
  });
});
