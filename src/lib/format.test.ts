import { describe, it, expect } from 'vitest';
import { formatDuration, formatHour } from './format';

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
