import { describe, it, expect } from 'vitest';
import { dedupeStays, doublonsSejours } from './reservationDedupe';
import type { Reservation } from './types';

const sejour = (id: string, extra: Partial<Reservation> = {}): Reservation =>
  ({
    id, airbnbId: 'a1', apartmentName: 'Heritage Spa', platform: 'airbnb',
    externalUid: id, status: 'confirmed',
    checkIn: '2026-09-20', checkOut: '2026-09-24', createdAt: '2026-09-01T10:00:00Z',
    ...extra,
  } as Reservation);

describe('Un séjour vu par deux calendriers ne compte qu’une fois', () => {
  it('fusionne deux lignes identiques venues de flux différents', () => {
    // Le cas réel : un logement connecté au PMS qui a gardé son ancien lien iCal.
    const r = dedupeStays([
      sejour('ical', { feedId: 'f-ical', platform: 'airbnb' }),
      sejour('pms', { feedId: 'f-pms', platform: 'hostify' }),
    ]);
    expect(r).toHaveLength(1);
  });

  it('garde celle qui porte déjà le ménage', () => {
    const r = dedupeStays([
      sejour('sans'),
      sejour('avec', { missionId: 'm1' }),
    ]);
    expect(r[0].id).toBe('avec');
  });

  it('à défaut, garde celle qui connaît les heures', () => {
    const r = dedupeStays([
      sejour('nue'),
      sejour('riche', { checkOutTime: '10:00', checkInTime: '16:00' }),
    ]);
    expect(r[0].id).toBe('riche');
  });

  it('à richesse égale, garde la plus ancienne — les liens ouverts restent valides', () => {
    const r = dedupeStays([
      sejour('recente', { createdAt: '2026-09-05T10:00:00Z' }),
      sejour('ancienne', { createdAt: '2026-09-01T10:00:00Z' }),
    ]);
    expect(r[0].id).toBe('ancienne');
  });

  it('ne confond pas deux séjours différents du même logement', () => {
    const r = dedupeStays([
      sejour('s1', { checkIn: '2026-09-20', checkOut: '2026-09-24' }),
      sejour('s2', { checkIn: '2026-09-24', checkOut: '2026-09-28' }),
    ]);
    expect(r).toHaveLength(2);
  });

  it('ne confond pas le même séjour dans deux logements', () => {
    const r = dedupeStays([sejour('a'), sejour('b', { airbnbId: 'a2' })]);
    expect(r).toHaveLength(2);
  });

  it('une annulée ne masque pas la confirmée', () => {
    const r = dedupeStays([
      sejour('annulee', { status: 'cancelled' }),
      sejour('vivante'),
    ]);
    expect(r).toHaveLength(2);
    expect(r.filter(x => x.status === 'confirmed')).toHaveLength(1);
  });

  it('conserve l’ordre reçu — les écrans trient eux-mêmes', () => {
    const r = dedupeStays([
      sejour('x', { checkOut: '2026-09-30' }),
      sejour('y', { checkOut: '2026-09-24' }),
    ]);
    expect(r.map(s => s.id)).toEqual(['x', 'y']);
  });

  it('laisse passer une ligne sans dates plutôt que de la perdre', () => {
    const r = dedupeStays([sejour('vide', { checkIn: '', checkOut: '' })]);
    expect(r).toHaveLength(1);
  });

  it('ne casse pas sur une liste vide', () => {
    expect(dedupeStays([])).toEqual([]);
  });
});

describe('doublonsSejours — dire d’où vient le doublon', () => {
  it('nomme le logement, les dates et les plateformes en cause', () => {
    const d = doublonsSejours([
      sejour('ical', { platform: 'airbnb' }),
      sejour('pms', { platform: 'hostify' }),
    ]);
    expect(d).toEqual([{
      airbnbId: 'a1', apartmentName: 'Heritage Spa',
      checkIn: '2026-09-20', checkOut: '2026-09-24',
      fois: 2, plateformes: ['airbnb', 'hostify'],
    }]);
  });

  it('ne signale rien quand tout est propre', () => {
    expect(doublonsSejours([sejour('s1'), sejour('s2', { checkIn: '2026-09-24', checkOut: '2026-09-28' })]))
      .toEqual([]);
  });

  it('ignore les annulées — elles ne comptent nulle part', () => {
    expect(doublonsSejours([sejour('a', { status: 'cancelled' }), sejour('b', { status: 'cancelled' })]))
      .toEqual([]);
  });
});
