import { describe, it, expect } from 'vitest';
import { mouvementsParJour, libelleVoyageurs } from './mouvements';
import type { Reservation } from './types';

let n = 0;
const resa = (airbnbId: string, checkIn: string, checkOut: string, extra: Partial<Reservation> = {}): Reservation => ({
  id: `r${++n}`, airbnbId, apartmentName: airbnbId, platform: 'hostify', externalUid: `u${n}`,
  status: 'confirmed', checkIn, checkOut, ...extra,
} as Reservation);

const AUJ = '2026-11-10';

describe('mouvementsParJour — qui part, qui arrive', () => {
  it('un départ et une arrivée le même jour sur le même logement = un seul enchaînement', () => {
    const jours = mouvementsParJour([
      resa('baraban', '2026-11-07', '2026-11-11'),
      resa('baraban', '2026-11-11', '2026-11-14'),
    ], AUJ);
    const j11 = jours.find(j => j.jour === '2026-11-11')!;
    expect(j11.mouvements).toHaveLength(1);
    expect(j11.mouvements[0].type).toBe('enchainement');
    expect(j11.departs).toBe(1);
    expect(j11.arrivees).toBe(1);
  });

  it('l’enchaînement passe avant les départs, eux-mêmes avant les arrivées', () => {
    const jours = mouvementsParJour([
      resa('a-arrivee', '2026-11-11', '2026-11-13'),
      resa('b-depart', '2026-11-08', '2026-11-11'),
      resa('c-ench', '2026-11-08', '2026-11-11'),
      resa('c-ench', '2026-11-11', '2026-11-12'),
    ], AUJ);
    expect(jours.find(j => j.jour === '2026-11-11')!.mouvements.map(m => m.type))
      .toEqual(['enchainement', 'depart', 'arrivee']);
  });

  it('ignore le passé et les annulations', () => {
    const jours = mouvementsParJour([
      resa('x', '2026-11-01', '2026-11-05'),
      resa('y', '2026-11-12', '2026-11-15', { status: 'cancelled' }),
    ], AUJ);
    expect(jours).toHaveLength(0);
  });

  it('une date fermée sur Booking est un départ possible, jamais une arrivée', () => {
    const jours = mouvementsParJour([resa('z', '2026-11-12', '2026-11-15', { status: 'blocked', platform: 'booking' })], AUJ);
    expect(jours.map(j => j.jour)).toEqual(['2026-11-15']);
    expect(jours[0].mouvements[0].type).toBe('depart');
  });

  it('une date fermée sur Airbnb ou un logiciel n’est NI un départ NI une arrivée (Casa Sol)', () => {
    expect(mouvementsParJour([
      resa('casa', '2026-11-12', '2026-11-13', { status: 'blocked', platform: 'airbnb' }),
      resa('casa', '2026-11-13', '2026-11-14', { status: 'blocked', platform: 'lodgify' }),
    ], AUJ)).toHaveLength(0);
  });

  it('une fermeture Booking qui recopie un séjour Airbnb ne double pas le départ', () => {
    const jours = mouvementsParJour([
      resa('casa', '2026-11-16', '2026-11-20', { platform: 'airbnb' }),
      resa('casa', '2026-11-16', '2026-11-20', { status: 'blocked', platform: 'booking' }),
    ], AUJ);
    const j20 = jours.find(j => j.jour === '2026-11-20')!;
    expect(j20.mouvements).toHaveLength(1);
    expect(j20.mouvements[0].depart?.platform).toBe('airbnb');
  });

  it('un séjour à confirmer reste visible', () => {
    const jours = mouvementsParJour([resa('t', '2026-11-12', '2026-11-14', { status: 'tentative' })], AUJ);
    expect(jours.map(j => j.jour)).toEqual(['2026-11-12', '2026-11-14']);
  });

  it('compte les départs confirmés sans ménage', () => {
    const jours = mouvementsParJour([
      resa('a', '2026-11-08', '2026-11-11'),
      resa('b', '2026-11-08', '2026-11-11', { missionId: 'm1' }),
    ], AUJ);
    expect(jours[0].sansMenage).toBe(1);
  });

  it('les jours sont dans l’ordre', () => {
    const jours = mouvementsParJour([resa('a', '2026-11-20', '2026-11-22'), resa('b', '2026-11-08', '2026-11-12')], AUJ);
    expect(jours.map(j => j.jour)).toEqual(['2026-11-12', '2026-11-20', '2026-11-22']);
  });
});

describe('libelleVoyageurs', () => {
  it('accorde et se tait quand on ne sait pas', () => {
    expect(libelleVoyageurs(1)).toBe('1 voyageur');
    expect(libelleVoyageurs(4)).toBe('4 voyageurs');
    expect(libelleVoyageurs(undefined)).toBeNull();
  });
});
