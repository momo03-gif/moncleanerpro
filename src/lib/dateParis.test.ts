import { describe, it, expect, vi, afterEach } from 'vitest';
import { jourParis, aujourdhuiParis, moisParis, debutMoisParis, ajouterJours, dansJoursParis } from './dateParis';

afterEach(() => { vi.useRealTimers(); });

describe('dates à Paris — le serveur tourne en UTC', () => {
  it('à 00h30 à Paris, c’est déjà le lendemain (alors qu’en UTC on est encore la veille)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-02T23:30:00Z'));   // 00h30 à Paris, le 3
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-11-02');   // le piège
    expect(aujourdhuiParis()).toBe('2026-11-03');
    expect(dansJoursParis(90)).toBe('2027-02-01');
  });

  it('change de mois au bon moment (heure d’été comprise)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-30T22:30:00Z'));   // 00h30 à Paris le 1er juillet
    expect(moisParis()).toBe('2026-07');
    expect(debutMoisParis()).toBe('2026-07-01');
  });

  it('lit le jour parisien d’un horodatage', () => {
    expect(jourParis('2026-11-01T23:05:00Z')).toBe('2026-11-02');
    expect(jourParis('2026-11-02T12:00:00Z')).toBe('2026-11-02');
  });

  it('décale une date au calendrier, fins de mois et années comprises', () => {
    expect(ajouterJours('2026-01-31', 1)).toBe('2026-02-01');
    expect(ajouterJours('2026-12-31', 1)).toBe('2027-01-01');
    expect(ajouterJours('2026-03-01', -1)).toBe('2026-02-28');
  });
});
