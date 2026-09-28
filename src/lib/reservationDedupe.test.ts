import { describe, it, expect } from 'vitest';
import {
  chevauchements, dedupeStays, departCredible, doublonsSejours,
  estOccupation, estRefletDUnSejour, nuitsAFermerAilleurs,
  type OccupationSituee, type SejourVendu,
} from './reservationDedupe';
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

describe('chevauchements — deux voyageurs ne peuvent pas être là en même temps', () => {
  const s = (id: string, o: Partial<Reservation> = {}): Reservation => ({
    id, airbnbId: 'apt-1', apartmentName: 'Casa Sol', status: 'confirmed',
    checkIn: '2026-09-27', checkOut: '2026-09-29', platform: 'booking', ...o,
  } as Reservation);

  it('signale deux séjours qui se recouvrent', () => {
    // Le cas réel : 27→29 et 28→02 partagent la nuit du 28.
    const c = chevauchements([s('a'), s('b', { checkIn: '2026-09-28', checkOut: '2026-10-02' })]);
    expect(c).toHaveLength(1);
    expect(c[0].apartmentName).toBe('Casa Sol');
  });

  it('un départ et une arrivée le même jour ne sont PAS un chevauchement', () => {
    // C'est la rotation normale en courte durée — et ce qui déclenche un ménage.
    expect(chevauchements([s('a'), s('b', { checkIn: '2026-09-29', checkOut: '2026-10-02' })])).toEqual([]);
  });

  it('deux séjours identiques se signalent aussi', () => {
    expect(chevauchements([s('a'), s('b')])).toHaveLength(1);
  });

  it('deux logements différents ne se comparent jamais', () => {
    expect(chevauchements([s('a'), s('b', { airbnbId: 'apt-2' })])).toEqual([]);
  });

  it('une réservation annulée ne crée pas de faux conflit', () => {
    expect(chevauchements([s('a'), s('b', { checkIn: '2026-09-28', status: 'cancelled' })])).toEqual([]);
  });

  it('rien à signaler sur un planning sain', () => {
    expect(chevauchements([s('a'), s('b', { checkIn: '2026-10-05', checkOut: '2026-10-09' })])).toEqual([]);
  });
});

describe('departCredible — ne jamais nettoyer un logement encore occupé', () => {
  it('un départ au milieu de l’occupation d’un autre calendrier est refusé', () => {
    // Le cas réel : Airbnb ferme 27→28 pour un séjour Booking qui va au 29.
    expect(departCredible(
      { feedId: 'airbnb', date: '2026-09-28' },
      [{ feedId: 'booking', checkIn: '2026-09-27', checkOut: '2026-09-29' }],
    )).toBe(false);
  });

  it('le départ à la FIN de l’occupation la plus longue est retenu', () => {
    expect(departCredible(
      { feedId: 'booking', date: '2026-09-29' },
      [{ feedId: 'airbnb', checkIn: '2026-09-27', checkOut: '2026-09-28' }],
    )).toBe(true);
  });

  it('deux lignes du MÊME calendrier ne s’arbitrent pas entre elles', () => {
    // Sinon un flux qui exporte des périodes larges effacerait les rotations
    // qu'il contient lui-même.
    expect(departCredible(
      { feedId: 'booking', date: '2026-09-29' },
      [{ feedId: 'booking', checkIn: '2026-09-28', checkOut: '2026-10-02' }],
    )).toBe(true);
  });

  it('une rotation le même jour reste un départ', () => {
    expect(departCredible(
      { feedId: 'a', date: '2026-09-29' },
      [{ feedId: 'b', checkIn: '2026-09-29', checkOut: '2026-10-02' }],
    )).toBe(true);
  });

  it('sans autre calendrier, le départ est toujours crédible', () => {
    expect(departCredible({ feedId: 'a', date: '2026-09-29' }, [])).toBe(true);
  });
});

describe('estRefletDUnSejour — faire cohabiter deux plateformes', () => {
  const vendu = (o: Partial<SejourVendu> = {}): SejourVendu =>
    ({ platform: 'airbnb', checkIn: '2026-10-10', checkOut: '2026-10-15', ...o });

  it('un blocage Booking qui recouvre un séjour vendu sur Airbnb est un reflet', () => {
    expect(estRefletDUnSejour(
      { platform: 'booking', checkIn: '2026-10-10', checkOut: '2026-10-15' },
      [vendu()],
    )).toBe(true);
  });

  it('même décalé d’une nuit, le reflet est reconnu', () => {
    expect(estRefletDUnSejour(
      { platform: 'booking', checkIn: '2026-10-10', checkOut: '2026-10-14' },
      [vendu()],
    )).toBe(true);
  });

  it('deux périodes de la MÊME plateforme sont deux séjours, pas un reflet', () => {
    // Sinon la rotation entre les deux disparaît, et le ménage avec.
    expect(estRefletDUnSejour(
      { platform: 'booking', checkIn: '2026-09-27', checkOut: '2026-09-29' },
      [vendu({ platform: 'booking', checkIn: '2026-09-28', checkOut: '2026-10-02' })],
    )).toBe(false);
  });

  it('un blocage qui ne recouvre aucun séjour vendu n’est pas un reflet', () => {
    expect(estRefletDUnSejour(
      { platform: 'booking', checkIn: '2026-11-01', checkOut: '2026-11-05' },
      [vendu()],
    )).toBe(false);
  });

  it('une rotation le même jour n’est pas un recouvrement', () => {
    expect(estRefletDUnSejour(
      { platform: 'booking', checkIn: '2026-10-15', checkOut: '2026-10-18' },
      [vendu()],
    )).toBe(false);
  });

  it('sans aucun séjour vendu, rien n’est un reflet', () => {
    expect(estRefletDUnSejour({ platform: 'booking', checkIn: '2026-10-10', checkOut: '2026-10-15' }, []))
      .toBe(false);
  });
});

describe('estOccupation — une seule définition pour tout le produit', () => {
  it('un séjour confirmé occupe le logement', () => {
    expect(estOccupation({ status: 'confirmed', platform: 'airbnb' })).toBe(true);
  });

  it('une période fermée chez Booking occupe aussi', () => {
    // Booking emploie le même intitulé pour un séjour vendu et une date fermée.
    expect(estOccupation({ status: 'blocked', platform: 'booking' })).toBe(true);
  });

  it('un blocage Airbnb n’occupe pas : le propriétaire garde son logement', () => {
    expect(estOccupation({ status: 'blocked', platform: 'airbnb' })).toBe(false);
  });

  it('une réservation annulée n’occupe jamais', () => {
    expect(estOccupation({ status: 'cancelled', platform: 'booking' })).toBe(false);
  });

  it('une option non confirmée n’occupe pas', () => {
    expect(estOccupation({ status: 'tentative', platform: 'booking' })).toBe(false);
  });
});

describe('nuitsAFermerAilleurs — voir venir la double réservation', () => {
  const plateformes = new Map([['apt-1', ['airbnb', 'booking']]]);
  const occ = (o: Partial<OccupationSituee> = {}): OccupationSituee => ({
    airbnbId: 'apt-1', apartmentName: 'Casa Sol', platform: 'booking',
    checkIn: '2026-09-27', checkOut: '2026-09-29', ...o,
  });

  it('réclame de fermer l’autre plateforme quand elle ne couvre pas les nuits vendues', () => {
    const a = nuitsAFermerAilleurs([occ()], plateformes);
    expect(a).toHaveLength(1);
    expect(a[0].plateformeAFermer).toBe('airbnb');
    expect(a[0].vendueSur).toBe('booking');
    expect(a[0].du).toBe('2026-09-27');
    expect(a[0].au).toBe('2026-09-29');   // libre le matin du 29
  });

  it('ne réclame rien quand l’autre plateforme a bien fermé', () => {
    expect(nuitsAFermerAilleurs(
      [occ(), occ({ platform: 'airbnb' })],
      plateformes,
    )).toEqual([]);
  });

  it('ne réclame que les nuits réellement découvertes', () => {
    // Airbnb ferme 27→28 : il reste la nuit du 28 à fermer.
    const a = nuitsAFermerAilleurs(
      [occ(), occ({ platform: 'airbnb', checkOut: '2026-09-28' })],
      plateformes,
    );
    expect(a).toHaveLength(1);
    expect(a[0].du).toBe('2026-09-28');
    expect(a[0].au).toBe('2026-09-29');
  });

  it('regroupe les nuits consécutives en une seule alerte', () => {
    const a = nuitsAFermerAilleurs([occ({ checkOut: '2026-10-02' })], plateformes);
    expect(a).toHaveLength(1);
    expect(a[0].du).toBe('2026-09-27');
    expect(a[0].au).toBe('2026-10-02');
  });

  it('se tait quand une seule plateforme est connectée', () => {
    // Rien à fermer ailleurs : il n'y a pas d'ailleurs.
    expect(nuitsAFermerAilleurs([occ()], new Map([['apt-1', ['booking']]]))).toEqual([]);
  });

  it('ne mélange pas deux logements', () => {
    expect(nuitsAFermerAilleurs(
      [occ({ airbnbId: 'apt-2' })],
      plateformes,
    )).toEqual([]);
  });
});
