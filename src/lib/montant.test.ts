import { describe, it, expect } from 'vitest';
import {
  lireMontant, lireEntier, erreurFourchette, prixReferenceParDefaut,
  referenceHorsFourchette, montantServeurValide,
} from './montant';

describe('lireMontant', () => {
  it('lit les écritures françaises courantes', () => {
    expect(lireMontant('45')).toEqual({ ok: true, valeur: 45 });
    expect(lireMontant('45,50')).toEqual({ ok: true, valeur: 45.5 });
    expect(lireMontant('1 200')).toEqual({ ok: true, valeur: 1200 });
    expect(lireMontant('35 €')).toEqual({ ok: true, valeur: 35 });
    expect(lireMontant(' 12.5 ')).toEqual({ ok: true, valeur: 12.5 });
  });
  it('vide → null (sens décidé par le champ)', () => {
    expect(lireMontant('')).toEqual({ ok: true, valeur: null });
    expect(lireMontant('   ')).toEqual({ ok: true, valeur: null });
    expect(lireMontant(null)).toEqual({ ok: true, valeur: null });
  });
  it('refuse ce qui n’est pas un montant au lieu d’en faire 0 €', () => {
    expect(lireMontant('abc').ok).toBe(false);
    expect(lireMontant('40-70').ok).toBe(false);
    expect(lireMontant('-5').ok).toBe(false);
    expect(lireMontant('12,345').ok).toBe(false);
    expect(lireMontant('1.200,50').ok).toBe(false);
  });
  it('accepte un nombre déjà lu, sauf négatif ou non fini', () => {
    expect(lireMontant(30)).toEqual({ ok: true, valeur: 30 });
    expect(lireMontant(-1).ok).toBe(false);
    expect(lireMontant(NaN).ok).toBe(false);
  });
});

describe('lireEntier', () => {
  it('entiers seulement', () => {
    expect(lireEntier('35')).toEqual({ ok: true, valeur: 35 });
    expect(lireEntier('')).toEqual({ ok: true, valeur: null });
    expect(lireEntier('3,5').ok).toBe(false);
    expect(lireEntier('dix').ok).toBe(false);
  });
});

describe('fourchette et prix de référence', () => {
  it('signale une borne basse au-dessus de la haute', () => {
    expect(erreurFourchette(70, 40)).not.toBeNull();
    expect(erreurFourchette(40, 70)).toBeNull();
    expect(erreurFourchette(40, null)).toBeNull();
    expect(erreurFourchette(40, 40)).toBeNull();
  });
  it('référence par défaut = milieu, comme l’import CSV', () => {
    expect(prixReferenceParDefaut(40, 70)).toBe(55);
    expect(prixReferenceParDefaut(2.5, 5)).toBe(3.75);
    expect(prixReferenceParDefaut(40, null)).toBe(40);
    expect(prixReferenceParDefaut(null, null)).toBeNull();
  });
  it('repère une référence sortie de sa fourchette', () => {
    expect(referenceHorsFourchette(19, 8, 12)).toBe(true);
    expect(referenceHorsFourchette(10, 8, 12)).toBe(false);
    expect(referenceHorsFourchette(0, 8, 12)).toBe(false);
    expect(referenceHorsFourchette(19, null, 12)).toBe(false);
  });
  it('validation serveur', () => {
    expect(montantServeurValide(null)).toBe(true);
    expect(montantServeurValide(12)).toBe(true);
    expect(montantServeurValide(-1)).toBe(false);
    expect(montantServeurValide('12')).toBe(false);
    expect(montantServeurValide(Infinity)).toBe(false);
  });
});
