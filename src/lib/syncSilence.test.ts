import { describe, it, expect } from 'vitest';
import { connexionsMuettes, silenceAnormalDes, type FluxSilence, type ReservationSilence } from './syncSilence';

const flux = (partnerId: string, platform: string, createdAt = '2026-10-01T10:00:00Z', n = 1): FluxSilence[] =>
  Array.from({ length: n }, () => ({ partnerId, platform, createdAt }));
const resa = (partnerId: string, platform: string, jours: string[]): ReservationSilence[] =>
  jours.map(j => ({ feedPartnerId: partnerId, feedPlatform: platform, createdAt: `${j}T12:00:00Z` }));

/** Historique réel de Charles&charles (SuperHote) : import le 01/10, actif jusqu'au 07/10. */
const superhote = [
  ...resa('cc', 'superhote', Array(71).fill('2026-10-01')),
  ...resa('cc', 'superhote', ['2026-10-02', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06', '2026-10-07']),
];
const fluxSuperhote = flux('cc', 'superhote', '2026-10-01T09:00:00Z', 13);

describe('silenceAnormalDes — le seuil suit le rythme', () => {
  it('rythme quotidien : alerte vite', () => expect(silenceAnormalDes(0.85)).toBe(3));
  it('rythme d’un jour sur deux : un peu plus tard', () => expect(silenceAnormalDes(0.5)).toBe(6));
  it('une fois par semaine : il faut un très long silence', () => expect(silenceAnormalDes(1 / 7)).toBeGreaterThanOrEqual(25));
  it('aucun rythme : jamais', () => expect(silenceAnormalDes(0)).toBe(Infinity));
});

describe('connexionsMuettes — un silence qui se voit, sans fausse alerte', () => {
  it('signale le cas SuperHote réel', () => {
    const res = connexionsMuettes(fluxSuperhote, superhote, '2026-10-14');
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({ partnerId: 'cc', platform: 'superhote', flux: 13, derniereNouvelle: '2026-10-07', joursSilence: 7 });
  });

  it('l’aurait signalé dès le 10/10, trois jours après la dernière réservation', () => {
    expect(connexionsMuettes(fluxSuperhote, superhote, '2026-10-09')).toEqual([]);
    expect(connexionsMuettes(fluxSuperhote, superhote, '2026-10-10')).toHaveLength(1);
  });

  it('ne signale pas une connexion qui reçoit encore des réservations (Hostify réel)', () => {
    const jours = ['2026-09-28', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-05', '2026-10-06',
      '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'];
    expect(connexionsMuettes(flux('h', 'hostify', '2026-09-01T00:00:00Z'), resa('h', 'hostify', jours), '2026-10-14')).toEqual([]);
  });

  it('ne compte pas le jour du premier import comme de l’activité', () => {
    const r = resa('p', 'ical', Array(30).fill('2026-10-01'));
    expect(connexionsMuettes(flux('p', 'ical', '2026-10-01T08:00:00Z'), r, '2026-10-14')).toEqual([]);
  });

  it('laisse tranquille une petite conciergerie au rythme hebdomadaire', () => {
    const r = resa('petit', 'airbnb', ['2026-09-10', '2026-09-17', '2026-09-24', '2026-10-01']);
    // 13 jours de silence : long, mais normal pour ce rythme.
    expect(connexionsMuettes(flux('petit', 'airbnb', '2026-08-01T00:00:00Z'), r, '2026-10-14')).toEqual([]);
  });

  it('distingue deux logiciels d’une même conciergerie', () => {
    const quotidien = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06'];
    const r = [
      ...resa('c', 'hostify', [...quotidien, '2026-10-12', '2026-10-13', '2026-10-14']),
      ...resa('c', 'lodgify', quotidien),
    ];
    // Branchés la veille du premier jour d'activité.
    const f = [...flux('c', 'hostify', '2026-09-30T00:00:00Z'), ...flux('c', 'lodgify', '2026-09-30T00:00:00Z')];
    expect(connexionsMuettes(f, r, '2026-10-14').map(x => x.platform)).toEqual(['lodgify']);
  });

  it('se tait dès que les réservations reviennent', () => {
    const repris = [...superhote, ...resa('cc', 'superhote', ['2026-10-15'])];
    expect(connexionsMuettes(fluxSuperhote, repris, '2026-10-15')).toEqual([]);
  });
});
