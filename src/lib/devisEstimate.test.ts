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

// Grille réaliste (catégories + mots-clés + fourchettes) pour valider la
// compréhension des descriptions humaines.
const grid: Tarif[] = [
  { id: 'a', nom: 'Entretien classique - T2', unite: 'forfait', prix: 95, actif: true, categorie: 'Nettoyage Résidentiel', motsCles: 't2, menage, entretien', prixMin: 70, prixMax: 120 },
  { id: 'b', nom: 'Entretien classique - T3', unite: 'forfait', prix: 125, actif: true, categorie: 'Nettoyage Résidentiel', motsCles: 't3, menage, entretien', prixMin: 90, prixMax: 160 },
  { id: 'c', nom: 'Entretien classique - T4', unite: 'forfait', prix: 170, actif: true, categorie: 'Nettoyage Résidentiel', motsCles: 't4, menage, entretien', prixMin: 120, prixMax: 220 },
  { id: 'd', nom: 'Nettoyage Hébergement', unite: 'forfait', prix: 112, actif: true, categorie: 'Nettoyage Airbnb / Conciergerie', motsCles: 'airbnb, voyageurs, studio, t1, t2, t3, t4, t5', prixMin: 45, prixMax: 180 },
  { id: 'e', nom: 'Nettoyage État des lieux', unite: 'm2', prix: 4.5, actif: true, categorie: 'Avant / Après État des Lieux', motsCles: 'etat des lieux, fin de bail, studio, t1, t2, t3, t4, t5', prixMin: 3, prixMax: 6 },
  { id: 'f', nom: 'Fenêtre', unite: 'piece', prix: 9, actif: true, categorie: 'Vitrerie', motsCles: 'vitres, vitre, fenetre, carreaux', prixMin: 6, prixMax: 12 },
  { id: 'g', nom: 'Baie vitrée', unite: 'piece', prix: 22, actif: true, categorie: 'Vitrerie', motsCles: 'baie vitree, vitres', prixMin: 15, prixMax: 30 },
  { id: 'h', nom: 'Cuisine (Détail)', unite: 'forfait', prix: 45, actif: true, categorie: 'Prestations Spécifiques', motsCles: 'cuisine, four, hotte, frigo', prixMin: 10, prixMax: 80 },
  { id: 'i', nom: 'Hôtels', unite: 'forfait', prix: 0, actif: true, categorie: 'Nettoyage Professionnel', motsCles: 'hotel, hotellerie' },
  { id: 'j', nom: 'Canapé', unite: 'forfait', prix: 130, actif: true, categorie: 'Nettoyage Textile', motsCles: 'canape, detachage' },
];

describe('estimateFromDescription — descriptions humaines', () => {
  it('déduit le type : « 3 chambres + salon » = T4 (sans Hôtels ni Canapé)', () => {
    const lines = estimateFromDescription('un appartement avec 3 chambres, un salon, une cuisine et des toilettes', grid);
    const names = lines.map(l => l.nom);
    expect(names).toContain('Entretien classique - T4');
    expect(names).not.toContain('Hôtels');
    expect(names).not.toContain('Canapé');
    expect(lines.length).toBeLessThanOrEqual(2);
  });

  it('ne propose QU\'UNE prestation principale (T2 + état des lieux → état des lieux)', () => {
    const lines = estimateFromDescription('nettoyage de T2 pour état des lieux', grid);
    const names = lines.map(l => l.nom);
    expect(names).toContain('Nettoyage État des lieux');
    // pas d\'empilement Entretien-T2 + Hébergement + État des lieux
    expect(names).not.toContain('Entretien classique - T2');
    expect(names).not.toContain('Nettoyage Hébergement');
  });

  it('estime la surface d\'une prestation au m² d\'après le type (T2 ≈ 45 m²)', () => {
    const lines = estimateFromDescription('état des lieux d\'un T2', grid);
    const edl = lines.find(l => l.nom === 'Nettoyage État des lieux');
    expect(edl?.quantite).toBe(45);
  });

  it('ne sur-liste pas la vitrerie : « les vitres » → une seule ligne vitrerie', () => {
    const lines = estimateFromDescription('il faut laver les vitres', grid);
    const vitrerie = lines.filter(l => l.nom === 'Fenêtre' || l.nom === 'Baie vitrée');
    expect(vitrerie.length).toBe(1);
  });

  it('détecte les quantités réelles : « 6 fenêtres » → ×6', () => {
    const lines = estimateFromDescription('nettoyage de 6 fenetres', grid);
    const f = lines.find(l => l.nom === 'Fenêtre');
    expect(f?.quantite).toBe(6);
  });
});
