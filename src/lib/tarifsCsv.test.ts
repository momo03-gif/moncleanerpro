import { describe, it, expect } from 'vitest';
import { parseTarifsCsv, parsePrix, parseUnite } from './tarifsCsv';

describe('parsePrix — fourchette / prix simple', () => {
  it('fourchette « 40-70 » → min 40, max 70, prix milieu 55', () => {
    expect(parsePrix('40-70')).toEqual({ prix: 55, prixMin: 40, prixMax: 70 });
  });
  it('fourchette FR « 2,5 à 5 €/m² » → 2.5 / 5', () => {
    expect(parsePrix('2,5 à 5 €/m²')).toEqual({ prix: 3.75, prixMin: 2.5, prixMax: 5 });
  });
  it('séparateur milliers « 80 à 1 500 € » → 80 / 1500', () => {
    expect(parsePrix('80 à 1 500 €')).toEqual({ prix: 790, prixMin: 80, prixMax: 1500 });
  });
  it('prix simple « 45 » → prix fixe sans fourchette', () => {
    expect(parsePrix('45')).toEqual({ prix: 45, prixMin: null, prixMax: null });
  });
  it('« Sur devis » → 0, pas de fourchette', () => {
    expect(parsePrix('Sur devis')).toEqual({ prix: 0, prixMin: null, prixMax: null });
  });
});

describe('parseUnite — mappage vers l\'enum autorisé', () => {
  it('€/m² → m2', () => expect(parseUnite('€/m²')).toBe('m2'));
  it('heure → heure', () => expect(parseUnite('heure')).toBe('heure'));
  it('passage / store / volet → piece', () => {
    expect(parseUnite('passage')).toBe('piece');
    expect(parseUnite('par unité de store')).toBe('piece');
  });
  it('vide → forfait', () => expect(parseUnite('')).toBe('forfait'));
});

describe('parseTarifsCsv — import complet', () => {
  const csv = `Prestation;Unité;Prix;Mots-clés;Actif
Entretien classique - T2;forfait;70-120;t2, deux pièces;oui
Nettoyage vitres;piece;6-12;vitres, fenêtres, baies;oui
Hôtels;forfait;;chambres, communs;oui`;

  it('lit les lignes avec délimiteur ; et fourchettes', () => {
    const { rows, errors } = parseTarifsCsv(csv);
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ nom: 'Entretien classique - T2', unite: 'forfait', prixMin: 70, prixMax: 120, motsCles: 't2, deux pièces' });
    expect(rows[2]).toMatchObject({ nom: 'Hôtels', prix: 0, prixMin: null }); // « Sur devis »
  });

  it('gère le BOM UTF-8 et le délimiteur virgule', () => {
    const { rows } = parseTarifsCsv('﻿Prestation,Prix\nMénage,40-60');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ nom: 'Ménage', prixMin: 40, prixMax: 60 });
  });

  it('lit la colonne Catégorie quand elle est présente', () => {
    const withCat = `Catégorie;Prestation;Unité;Prix;Mots-clés;Actif
Vitrerie;Fenêtre;piece;6-12;vitres, fenêtres;oui`;
    const { rows } = parseTarifsCsv(withCat);
    expect(rows[0]).toMatchObject({ nom: 'Fenêtre', categorie: 'Vitrerie', prixMin: 6, prixMax: 12 });
  });

  it('rejette un fichier sans colonnes reconnues', () => {
    const { rows, errors } = parseTarifsCsv('a;b;c\n1;2;3');
    expect(rows).toHaveLength(0);
    expect(errors.length).toBeGreaterThan(0);
  });
});
