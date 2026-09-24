import { describe, it, expect } from 'vitest';
import {
  lignesFacture, totauxFacture, appliquerCorrections, type MenageAFacturer,
} from './factureLignes';
import { baseEligible } from './linge';

const MENAGES: MenageAFacturer[] = [
  { id: 'a', date: '2026-09-03', logement: 'Le Heritage 1', type: 'regular', cleaner: 'Awa', prix: 20 },
  {
    id: 'b', date: '2026-09-05', logement: 'Le Cocon Savoir', type: 'regular', cleaner: 'Awa', prix: 50,
    fourniture: { montant: 9, libelle: 'Linge — 2 kits', kits: 2 },
  },
];

describe('Lignes de facture — ménage et fourniture séparés', () => {
  it('ajoute une ligne de fourniture seulement quand il y en a une', () => {
    const l = lignesFacture(MENAGES);
    expect(l).toHaveLength(3);
    expect(l[0].missionId).toBe('a');
    expect(l[1].label).toBe('Le Cocon Savoir');
    expect(l[2].label).toBe('Linge — 2 kits');
  });

  it('place la fourniture juste après son ménage, pas en fin de facture', () => {
    // Le client doit lire « le ménage, puis son linge » sur deux lignes voisines.
    const l = lignesFacture(MENAGES);
    expect(l[1].missionId).toBe(l[2].missionId);
    expect(l[2].fourniture).toBe(true);
  });

  it('ne crée pas de ligne pour une fourniture à zéro', () => {
    const l = lignesFacture([{ ...MENAGES[0], fourniture: { montant: 0, libelle: 'Linge', kits: 0 } }]);
    expect(l).toHaveLength(1);
  });

  it('sépare les totaux : prestations, fournitures, total dû', () => {
    const t = totauxFacture(lignesFacture(MENAGES));
    expect(t.prestations).toBe(70);
    expect(t.fournitures).toBe(9);
    expect(t.total).toBe(79);
  });

  it('la base du crédit d’impôt ignore la fourniture', () => {
    // C'est toute la raison d'être de la séparation : la marchandise n'ouvre
    // aucun droit, seul le service à la personne en ouvre un.
    const t = totauxFacture(lignesFacture(MENAGES));
    expect(t.prestations).toBe(baseEligible(20) + baseEligible(50));
    expect(t.prestations).not.toBe(t.total);
  });

  it('une correction manuelle porte sur le ménage, jamais sur le linge', () => {
    const corrigés = appliquerCorrections(MENAGES, { b: '45' });
    const t = totauxFacture(lignesFacture(corrigés));
    expect(t.prestations).toBe(65);
    expect(t.fournitures).toBe(9);
  });

  it('ignore une correction vide ou illisible plutôt que de facturer zéro', () => {
    const corrigés = appliquerCorrections(MENAGES, { a: '', b: 'abc' });
    expect(corrigés[0].prix).toBe(20);
    expect(corrigés[1].prix).toBe(50);
  });

  it('arrondit au centime — jamais 8,700000000000001 sur une facture', () => {
    const l = lignesFacture([{ ...MENAGES[0], prix: 2.9 * 3 }]);
    expect(l[0].amount).toBe(8.7);
  });

  it('facture des quantités, jamais des minutes', () => {
    // Règle produit : le client ne doit pas pouvoir savoir combien de temps a
    // duré son ménage. Un ménage = 1, une fourniture = son nombre de kits.
    const l = lignesFacture(MENAGES);
    expect(l[0].quantite).toBe(1);
    expect(l[1].quantite).toBe(1);
    expect(l[2].quantite).toBe(2);
    expect(Object.keys(l[0])).not.toContain('duration');
  });

  it('une fourniture sans nombre de kits reste à 1, jamais à 0', () => {
    const l = lignesFacture([{ ...MENAGES[0], fourniture: { montant: 4, libelle: 'Consommables', kits: 0 } }]);
    expect(l[1].quantite).toBe(1);
  });

  it('rend une facture vide sans planter', () => {
    expect(lignesFacture([])).toEqual([]);
    expect(totauxFacture([])).toEqual({ prestations: 0, fournitures: 0, total: 0 });
  });
});
