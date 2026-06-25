import { describe, it, expect } from 'vitest';
import { occurrenceDates, weekdayOf } from './recurringDates';

describe('weekdayOf — jour de semaine déterministe (UTC)', () => {
  it('2026-06-10 est un mercredi (3)', () => expect(weekdayOf('2026-06-10')).toBe(3));
  it('2026-06-14 est un dimanche (0)', () => expect(weekdayOf('2026-06-14')).toBe(0));
});

describe('occurrenceDates — dates d’un planning récurrent', () => {
  it('Lun/Mer/Ven sur une semaine', () => {
    // Semaine du lundi 2026-06-08 au dimanche 2026-06-14.
    const out = occurrenceDates('2026-06-08', '2026-06-14', [1, 3, 5]);
    expect(out).toEqual(['2026-06-08', '2026-06-10', '2026-06-12']);
  });
  it('respecte la date de fin', () => {
    const out = occurrenceDates('2026-06-08', '2026-06-10', [1, 3, 5]);
    expect(out).toEqual(['2026-06-08', '2026-06-10']);
  });
  it('aucun jour coché → vide', () => {
    expect(occurrenceDates('2026-06-08', '2026-06-30', [])).toEqual([]);
  });
  it('fin avant début → vide', () => {
    expect(occurrenceDates('2026-06-10', '2026-06-08', [1])).toEqual([]);
  });
});
