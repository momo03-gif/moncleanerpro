import { describe, it, expect } from 'vitest';
import { apartmentStats, totalStats } from './partnerStats';
import type { Apartment, Mission, Repair } from './types';

const apt = (id: string, name: string): Apartment =>
  ({ id, name, address: '', entryDirectives: '' } as Apartment);

const done = (airbnbId: string, date: string, extra: Partial<Mission> = {}): Mission =>
  ({ id: `m-${airbnbId}-${date}`, airbnbId, date, status: 'completed', price: 60,
     property: '', address: '', time: '11:00', duration: 60, type: 'checkout', ...extra } as Mission);

const repair = (airbnbId: string, status: 'open' | 'done'): Repair =>
  ({ id: `r-${airbnbId}-${status}`, airbnbId, description: 'x', status } as Repair);

describe('apartmentStats — les chiffres du mois par logement', () => {
  const apartments = [apt('a1', 'T2'), apt('a2', 'Studio')];

  it('compte les ménages terminés et leur coût', () => {
    const rows = apartmentStats(apartments,
      [done('a1', '2026-08-03'), done('a1', '2026-08-10', { price: 75 })], [], '2026-08');
    expect(rows[0]).toMatchObject({ cleanings: 2, cost: 135 });
    expect(rows[1].cleanings).toBe(0);
  });

  it('ignore les ménages d’un autre mois', () => {
    const rows = apartmentStats(apartments, [done('a1', '2026-07-28')], [], '2026-08');
    expect(rows[0].cleanings).toBe(0);
  });

  it('ignore les ménages non terminés', () => {
    const rows = apartmentStats(apartments,
      [done('a1', '2026-08-03', { status: 'cancelled' }), done('a1', '2026-08-04', { status: 'pending' })],
      [], '2026-08');
    expect(rows[0].cleanings).toBe(0);
  });

  it('compte les turnovers — les ménages faits un jour d’arrivée', () => {
    const rows = apartmentStats(apartments, [
      done('a1', '2026-08-03', { nextArrival: '2026-08-03', nextArrivalTime: '15:00' }),
      done('a1', '2026-08-05', { nextArrival: '2026-08-07' }),
      done('a1', '2026-08-07'),
    ], [], '2026-08');
    expect(rows[0].turnovers).toBe(1);
  });

  it('n’expose aucune donnée de durée de ménage', () => {
    const rows = apartmentStats(apartments,
      [done('a1', '2026-08-03', { endedAt: new Date('2026-08-03T12:35:00').toISOString() })], [], '2026-08');
    // Le temps de travail reste interne : aucune clé du résultat ne doit en parler.
    expect(Object.keys(rows[0]).join(' ')).not.toMatch(/time|duration|ended|started/i);
  });

  it('moyenne les notes données, et reste vide sans note', () => {
    const rows = apartmentStats(apartments, [
      done('a1', '2026-08-03', { partnerRating: 5 }),
      done('a1', '2026-08-05', { partnerRating: 4 }),
      done('a1', '2026-08-07'),
    ], [], '2026-08');
    expect(rows[0]).toMatchObject({ avgRating: 4.5, ratedCount: 2 });
    expect(rows[1].avgRating).toBeNull();
  });

  it('compte les réparations encore ouvertes', () => {
    const rows = apartmentStats(apartments, [], [repair('a1', 'open'), repair('a1', 'done'), repair('a2', 'open')], '2026-08');
    expect(rows[0].openRepairs).toBe(1);
    expect(rows[1].openRepairs).toBe(1);
  });
});

describe('totalStats — le cumul tous logements', () => {
  it('additionne et pondère la note par le nombre de ménages notés', () => {
    const rows = [
      { apartmentId: 'a1', apartmentName: 'A', cleanings: 10, cost: 600, turnovers: 4, avgRating: 5, ratedCount: 8, openRepairs: 0 },
      { apartmentId: 'a2', apartmentName: 'B', cleanings: 2, cost: 120, turnovers: 1, avgRating: 3, ratedCount: 2, openRepairs: 1 },
    ];
    expect(totalStats(rows)).toMatchObject({ cleanings: 12, cost: 720, turnovers: 5, openRepairs: 1, avgRating: 4.6 });
  });

  it('reste vide quand aucun ménage n’a été noté', () => {
    const total = totalStats([
      { apartmentId: 'a1', apartmentName: 'A', cleanings: 0, cost: 0, turnovers: 0, avgRating: null, ratedCount: 0, openRepairs: 0 },
    ]);
    expect(total.avgRating).toBeNull();
  });
});
