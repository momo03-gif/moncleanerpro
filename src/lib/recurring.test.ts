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

// ── Fréquences d'un abonnement « sans engagement » ──────────────────────────
// Une offre grand public ne se vend pas en « tous les mardis » mais en
// hebdomadaire / une semaine sur deux / une fois par mois.
describe('occurrenceDates — fréquence d’abonnement', () => {
  it('chaque semaine, comme avant', () => {
    // 2026-10-05 est un lundi.
    expect(occurrenceDates('2026-10-05', '2026-11-02', [1], 1))
      .toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']);
  });

  it('une semaine sur deux, en partant de la semaine de souscription', () => {
    expect(occurrenceDates('2026-10-05', '2026-11-02', [1], 2))
      .toEqual(['2026-10-05', '2026-10-19', '2026-11-02']);
  });

  it('une fois par mois (toutes les quatre semaines)', () => {
    expect(occurrenceDates('2026-10-05', '2026-12-07', [1], 4))
      .toEqual(['2026-10-05', '2026-11-02', '2026-11-30']);
  });

  it('garde la parité même si le planning démarre un dimanche', () => {
    // Le calage se fait sur le lundi de la semaine : sans lui, un départ le
    // dimanche ferait basculer la parité dès le lendemain.
    const d = occurrenceDates('2026-10-04', '2026-10-31', [2], 2);
    expect(d).toEqual(['2026-10-06', '2026-10-20']);
  });

  it('sans intervalle précisé, se comporte comme avant', () => {
    expect(occurrenceDates('2026-10-05', '2026-10-19', [1]))
      .toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
  });
});
