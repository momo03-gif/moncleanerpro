import { describe, it, expect } from 'vitest';
import { fraisServiceCourse, depasseBudget, aRembourser, montantTicket, payeurValide, libellePayeur, primeCourse, avancesParCleaner, depensesSocieteParMois } from './course';

describe('Course / achat — l’argent', () => {
  it('propose des frais de service au % du budget, avec un minimum', () => {
    expect(fraisServiceCourse(300, 15, 20)).toBe(45);    // machine à café
    expect(fraisServiceCourse(8, 15, 20)).toBe(20);      // double de clé : le minimum
    expect(fraisServiceCourse(0, 15, 20)).toBe(20);
    expect(fraisServiceCourse(99.99, 15, 0)).toBe(15);
  });

  it('signale un ticket au-dessus du budget accepté', () => {
    expect(depasseBudget(260, 250)).toBe(true);
    expect(depasseBudget(250, 250)).toBe(false);
    expect(depasseBudget(260, null)).toBe(false);
    expect(depasseBudget(null, 250)).toBe(false);
  });

  it('ne doit une note de frais que si l’intervenant a avancé et pas encore été remboursé', () => {
    expect(aRembourser({ errandPaidBy: 'cleaner', errandSpent: 32.5 })).toBe(true);
    expect(aRembourser({ errandPaidBy: 'cleaner', errandSpent: 32.5, errandReimbursedAt: '2026-10-31' })).toBe(false);
    expect(aRembourser({ errandPaidBy: 'company', errandSpent: 32.5 })).toBe(false);
    expect(aRembourser({ errandPaidBy: 'cleaner', errandSpent: 0 })).toBe(false);
  });

  it('lit le montant du ticket tel qu’on le tape', () => {
    expect(montantTicket('32,50')).toBe(32.5);
    expect(montantTicket(12.345)).toBe(12.35);
    expect(montantTicket('0')).toBeNull();
    expect(montantTicket('abc')).toBeNull();
  });

  it('ne connaît que deux payeurs', () => {
    expect(payeurValide('cleaner')).toBe('cleaner');
    expect(payeurValide('company')).toBe('company');
    expect(payeurValide('client')).toBeNull();
    expect(libellePayeur('company')).toBe('Carte de la société');
    expect(libellePayeur(null)).toBe('Non renseigné');
  });

  it('ne compte la prime que sur une course', () => {
    expect(primeCourse({ service: 'errand', errand_bonus: 5 })).toBe(5);
    expect(primeCourse({ service: 'cleaning', errand_bonus: 5 })).toBe(0);
    expect(primeCourse(null)).toBe(0);
  });
});

describe('Course / achat — récapitulatifs', () => {
  const C = (o: Partial<{ id: string; date: string; status: string; cleanerId: string; cleanerName: string; errandSpent: number; errandPaidBy: string; errandReimbursedAt: string }>) =>
    ({ id: 'x', date: '2026-10-10', status: 'completed', ...o });
  const missions = [
    C({ id: 'a', cleanerId: 'c1', cleanerName: 'Awa', errandSpent: 30, errandPaidBy: 'cleaner' }),
    C({ id: 'b', cleanerId: 'c1', cleanerName: 'Awa', errandSpent: 12.5, errandPaidBy: 'cleaner', date: '2026-10-20' }),
    C({ id: 'c', cleanerId: 'c1', cleanerName: 'Awa', errandSpent: 8, errandPaidBy: 'cleaner', errandReimbursedAt: '2026-10-25' }),
    C({ id: 'd', cleanerId: 'c2', cleanerName: 'Bilal', errandSpent: 100, errandPaidBy: 'cleaner' }),
    C({ id: 'e', cleanerId: 'c2', errandSpent: 250, errandPaidBy: 'company', date: '2026-09-03' }),
    C({ id: 'f', cleanerId: 'c2', errandSpent: 40, errandPaidBy: 'company', date: '2026-10-02' }),
    C({ id: 'g', cleanerId: 'c2', errandSpent: 99, errandPaidBy: 'cleaner', status: 'cancelled' }),
  ];

  it('regroupe les avances par intervenant, sépare dû et déjà remboursé', () => {
    const r = avancesParCleaner(missions);
    expect(r.map(g => [g.cleanerName, g.aRembourser, g.rembourse])).toEqual([['Bilal', 100, 0], ['Awa', 42.5, 8]]);
    expect(r[1].courses.map(m => m.id)).toEqual(['b', 'a', 'c']);   // le plus récent d'abord
  });

  it('totalise la carte de la société par mois, sans jamais la compter comme une avance', () => {
    const r = depensesSocieteParMois(missions);
    expect(r.map(g => [g.mois, g.total])).toEqual([['2026-10', 40], ['2026-09', 250]]);
    expect(avancesParCleaner(missions).flatMap(g => g.courses).some(m => m.errandPaidBy === 'company')).toBe(false);
  });
});
