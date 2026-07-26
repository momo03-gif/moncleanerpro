import { describe, it, expect } from 'vitest';
import { estimateFromDescription } from './devisEstimate';
import type { Tarif } from './devis';

const tarifs: Tarif[] = [
  { id: '1', nom: 'Nettoyage vitres', unite: 'piece', prix: 8, actif: true },
  { id: '2', nom: 'Baie vitrée', unite: 'piece', prix: 15, actif: true },
  { id: '3', nom: 'Ménage complet', unite: 'forfait', prix: 90, actif: true },
];

describe('estimateFromDescription — agent local (sans IA externe)', () => {
  it('repère une prestation et la quantité (« 6 fenêtres » → vitres × 6)', () => {
    const lines = estimateFromDescription('nettoyage des vitres de 6 fenêtres', tarifs);
    const vitres = lines.find(l => l.nom === 'Nettoyage vitres');
    expect(vitres).toBeTruthy();
    // « vitres » matché ; quantité détectée via « 6 » proche du mot-clé.
    expect(vitres!.quantite).toBe(6);
    expect(vitres!.total).toBe(48);
  });

  it('gère les accents et plusieurs prestations', () => {
    const lines = estimateFromDescription('2 baies vitrées et un ménage complet', tarifs);
    expect(lines.some(l => l.nom === 'Baie vitrée')).toBe(true);
    expect(lines.some(l => l.nom === 'Ménage complet')).toBe(true);
  });

  it('quantité par défaut = 1 si aucun nombre', () => {
    const lines = estimateFromDescription('un peu de ménage complet svp', tarifs);
    const m = lines.find(l => l.nom === 'Ménage complet');
    expect(m?.quantite).toBe(1);
  });

  it('renvoie vide si rien ne correspond à la grille', () => {
    expect(estimateFromDescription('bonjour je voudrais un renseignement', tarifs)).toEqual([]);
  });
});
