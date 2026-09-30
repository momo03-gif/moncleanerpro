import { describe, it, expect } from 'vitest';

// Forme RÉELLE relevée sur le compte d'une conciergerie le 01/10/2026, via
// `get-not-available-dates` — endpoint public, aucune clé.
const REPONSE = {
  dates: [
    { startDate: '2026-05-07', endDate: '2026-05-10' },
    { startDate: '2026-05-10', endDate: '2026-05-13' },
    { startDate: '2026-05-29', endDate: '2026-06-01' },
  ],
};

// Reproduction de la conversion faite par `fetchSuperhoteReservations`, isolée
// pour être testable sans appel réseau.
const enSejours = (dates: { startDate: string; endDate: string }[], rentalId: number,
  range: { from: string; to: string }) => dates
  .filter(p => p.endDate > p.startDate)
  .filter(p => p.endDate >= range.from && p.startDate <= range.to)
  .map(p => ({
    uid: `superhote-${rentalId}-${p.startDate}-${p.endDate}`,
    status: 'CONFIRMED' as const,
    summary: 'Séjour SuperHote',
    start: p.startDate,
    end: p.endDate,
  }));

describe('SuperHote — périodes occupées converties en séjours', () => {
  const plage = { from: '2026-05-01', to: '2026-06-30' };

  it('garde SÉPARÉS deux séjours qui se touchent', () => {
    // C'est tout l'enjeu : la frontière commune (le 10) porte le changement de
    // voyageur, donc le ménage. Les fusionner effacerait ce départ.
    const s = enSejours(REPONSE.dates, 4639, plage);
    expect(s).toHaveLength(3);
    expect(s[0].end).toBe('2026-05-10');
    expect(s[1].start).toBe('2026-05-10');
  });

  it('donne un identifiant stable d’une synchro à l’autre', () => {
    // Sinon le même séjour serait réimporté comme neuf à chaque passage, et
    // chaque passage créerait un ménage de plus.
    const a = enSejours(REPONSE.dates, 4639, plage)[0].uid;
    const b = enSejours(REPONSE.dates, 4639, plage)[0].uid;
    expect(a).toBe(b);
    expect(a).toContain('4639');
  });

  it('ne confond pas deux logements', () => {
    expect(enSejours(REPONSE.dates, 4639, plage)[0].uid)
      .not.toBe(enSejours(REPONSE.dates, 7702, plage)[0].uid);
  });

  it('écarte ce qui tombe hors de l’horizon', () => {
    expect(enSejours(REPONSE.dates, 4639, { from: '2026-06-15', to: '2026-07-31' })).toHaveLength(0);
  });

  it('ignore une période sans durée', () => {
    expect(enSejours([{ startDate: '2026-05-07', endDate: '2026-05-07' }], 1, plage)).toHaveLength(0);
  });
});
