import { describe, it, expect } from 'vitest';
import { formatDuration, formatHour, money } from './format';

describe('formatDuration — affichage des durées (valeur stockée en minutes)', () => {
  it('moins d’une heure → "X min"', () => {
    expect(formatDuration(45)).toBe('45 min');
    expect(formatDuration(5)).toBe('5 min');
  });
  it('heure pleine → "X h"', () => {
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(120)).toBe('2 h');
  });
  it('heure + minutes → "X h Y"', () => {
    expect(formatDuration(90)).toBe('1 h 30');
    expect(formatDuration(135)).toBe('2 h 15');
  });
  it('0 / null / undefined → "0 min" (jamais NaN)', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(null)).toBe('0 min');
    expect(formatDuration(undefined)).toBe('0 min');
  });
  it('valeur négative ramenée à 0', () => {
    expect(formatDuration(-30)).toBe('0 min');
  });
  it('arrondit au plus proche', () => {
    expect(formatDuration(59.6)).toBe('1 h');
  });
});

describe('formatHour — affichage des heures "HH:MM"', () => {
  it('heure pleine → "Xh"', () => {
    expect(formatHour('10:00')).toBe('10h');
    expect(formatHour('08:00')).toBe('8h');
  });
  it('heure + minutes → "XhYY" (minutes sur 2 chiffres)', () => {
    expect(formatHour('14:30')).toBe('14h30');
    expect(formatHour('09:05')).toBe('9h05');
  });
  it('vide / null → chaîne vide', () => {
    expect(formatHour('')).toBe('');
    expect(formatHour(null)).toBe('');
    expect(formatHour(undefined)).toBe('');
  });
});

describe('money — plus jamais de décimales parasites', () => {
  // Espaces insécables et fines : on compare sur un texte normalisé, sinon le
  // test casse au gré des versions d'ICU sans qu'aucun bug n'ait été introduit.
  const norm = (s: string) => s.replace(/[\s  ]+/g, ' ');

  it('absorbe le bruit d’une soustraction de flottants', () => {
    // Le cas réel observé en production sur « Bénéfice net ».
    expect(norm(money(15999.03 - 9696.81))).toBe('6 302,22 €');
  });
  it('garde les centimes quand il y en a', () => {
    expect(norm(money(15999.03))).toBe('15 999,03 €');
  });
  it('n’affiche pas de décimales sur un montant rond', () => {
    expect(norm(money(80))).toBe('80 €');
    expect(norm(money(1065))).toBe('1 065 €');
  });
  it('groupe les milliers', () => {
    expect(norm(money(1234567.5))).toBe('1 234 567,50 €');
  });
  it('gère le zéro et les valeurs absentes', () => {
    expect(norm(money(0))).toBe('0 €');
    expect(norm(money(null))).toBe('0 €');
    expect(norm(money(undefined))).toBe('0 €');
    expect(norm(money(NaN))).toBe('0 €');
  });
  it('gère un montant négatif', () => {
    expect(norm(money(-12.5))).toBe('-12,50 €');
  });
  it('arrondit au centime', () => {
    expect(norm(money(10.005))).toBe('10,01 €');
    expect(norm(money(0.004))).toBe('0 €');
  });
});

describe('money — valeurs venues d’un formulaire', () => {
  const norm = (s: string) => s.replace(/[\s  ]+/g, ' ');
  it('accepte une chaîne numérique', () => {
    expect(norm(money('120.5'))).toBe('120,50 €');
  });
  it('un champ vide vaut zéro, pas « NaN »', () => {
    expect(norm(money(''))).toBe('0 €');
  });
  it('une saisie non numérique ne casse pas l’affichage', () => {
    expect(norm(money('abc'))).toBe('0 €');
  });
});
