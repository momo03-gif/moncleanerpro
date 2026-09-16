import { describe, it, expect } from 'vitest';
import { pickDate, pickTime, pickGuests, pickGuestName, pickGuestPhone, isCancelled, isBlocked, toEvent, toEvents, type FieldNames } from './normalize';

const FIELDS: FieldNames = {
  id: ['id', 'bookId'],
  arrival: ['arrival', 'arrivalDate', 'checkIn'],
  departure: ['departure', 'departureDate', 'checkOut'],
  arrivalTime: ['arrivalTime', 'checkInTime'],
  departureTime: ['departureTime', 'checkOutTime'],
  status: ['status'],
};

describe('pickDate — accepte les variantes d’écriture', () => {
  it('lit une date simple', () => {
    expect(pickDate({ arrival: '2026-08-14' }, ['arrival'])).toBe('2026-08-14');
  });

  it('tronque un horodatage ISO complet', () => {
    expect(pickDate({ arrival: '2026-08-14T15:00:00Z' }, ['arrival'])).toBe('2026-08-14');
  });

  it('essaie les noms de champ dans l’ordre', () => {
    expect(pickDate({ checkIn: '2026-08-14' }, ['arrival', 'checkIn'])).toBe('2026-08-14');
  });

  it('refuse ce qui n’est pas une date', () => {
    expect(pickDate({ arrival: 'demain' }, ['arrival'])).toBeUndefined();
    expect(pickDate({}, ['arrival'])).toBeUndefined();
  });
});

describe('pickTime — nombre ou texte', () => {
  it('accepte un nombre d’heure', () => expect(pickTime({ t: 15 }, ['t'])).toBe('15:00'));
  it('accepte « 15:30 »', () => expect(pickTime({ t: '15:30' }, ['t'])).toBe('15:30'));
  it('accepte « 9 »', () => expect(pickTime({ t: '9' }, ['t'])).toBe('09:00'));
  it('coupe les secondes', () => expect(pickTime({ t: '15:30:00' }, ['t'])).toBe('15:30'));
  it('refuse une heure impossible', () => expect(pickTime({ t: 27 }, ['t'])).toBeUndefined());
  it('refuse l’absence', () => expect(pickTime({}, ['t'])).toBeUndefined());
});

describe('pickGuests — quel que soit le découpage', () => {
  it('lit un total direct', () => expect(pickGuests({ numberOfGuests: 4 })).toBe(4));
  it('additionne adultes et enfants', () => expect(pickGuests({ numAdult: 2, numChild: 3 })).toBe(5));
  it('accepte les adultes seuls', () => expect(pickGuests({ adults: 2 })).toBe(2));
  it('ne renvoie rien quand l’info manque', () => expect(pickGuests({})).toBeUndefined());
});

describe('pickGuestName', () => {
  it('prend le nom complet s’il existe', () => expect(pickGuestName({ guestName: 'Marie Dupont' })).toBe('Marie Dupont'));
  it('recompose prénom + nom', () => expect(pickGuestName({ firstName: 'Marie', lastName: 'Dupont' })).toBe('Marie Dupont'));
  it('se contente du prénom', () => expect(pickGuestName({ firstName: 'Marie' })).toBe('Marie'));
  it('ne renvoie rien sans nom', () => expect(pickGuestName({})).toBeUndefined());
});

describe('statuts', () => {
  it('reconnaît une annulation quelle que soit l’orthographe', () => {
    expect(isCancelled('cancelled')).toBe(true);
    expect(isCancelled('Canceled')).toBe(true);
    expect(isCancelled('CANCELLATION')).toBe(true);
  });

  it('ne prend pas un séjour propriétaire pour une annulation', () => {
    expect(isCancelled('ownerStay')).toBe(false);
    expect(isCancelled('confirmed')).toBe(false);
  });

  it('reconnaît un blocage de calendrier', () => {
    expect(isBlocked('black')).toBe(true);
    expect(isBlocked('blocked')).toBe(true);
    expect(isBlocked('confirmed')).toBe(false);
  });
});

describe('toEvent — la règle de sûreté', () => {
  it('convertit une réservation complète', () => {
    const e = toEvent({
      id: 42, arrival: '2026-08-14', departure: '2026-08-17',
      arrivalTime: '16:00', departureTime: '11:00',
      firstName: 'Marie', lastName: 'Dupont', numAdult: 2, numChild: 1, status: 'confirmed',
    }, 'beds24', FIELDS);

    expect(e).toEqual({
      uid: 'beds24-42',
      status: 'CONFIRMED',
      summary: 'Marie Dupont · 3 pers.',
      start: '2026-08-14',
      end: '2026-08-17',
      startTime: '16:00',
      endTime: '11:00',
    });
  });

  it('REFUSE une réservation sans dates lisibles plutôt que d’en inventer', () => {
    expect(toEvent({ id: 1, arrival: 'bientôt' }, 'x', FIELDS)).toBeNull();
    expect(toEvent({ id: 1, arrival: '2026-08-14' }, 'x', FIELDS)).toBeNull();  // départ manquant
  });

  it('marque les annulations', () => {
    const e = toEvent({ id: 7, arrival: '2026-08-14', departure: '2026-08-16', status: 'cancelled' }, 'x', FIELDS);
    expect(e?.status).toBe('CANCELLED');
  });

  it('reste lisible sans nom ni occupants', () => {
    const e = toEvent({ id: 8, arrival: '2026-08-14', departure: '2026-08-16' }, 'x', FIELDS);
    expect(e?.summary).toBe('Réservation');
    expect(e?.startTime).toBeUndefined();
  });
});

describe('toEvents — échouer franchement plutôt que rendre une liste vide', () => {
  it('convertit ce qui est lisible', () => {
    const list = toEvents([
      { id: 1, arrival: '2026-08-14', departure: '2026-08-16' },
      { id: 2, arrival: '2026-08-20', departure: '2026-08-22' },
    ], 'x', FIELDS, 'Test');
    expect(list).toHaveLength(2);
  });

  it('lève une erreur si RIEN n’est lisible — le contrat de l’API a changé', () => {
    expect(() => toEvents([{ id: 1, foo: 'bar' }], 'x', FIELDS, 'Test'))
      .toThrow(/non comprise/);
  });

  it('accepte une réponse réellement vide', () => {
    expect(toEvents([], 'x', FIELDS, 'Test')).toEqual([]);
  });
});

// ── Ce qu'un vrai compte Hostify a appris (09/2026) ─────────────────────────
describe('Statuts réels d’un PMS — ne jamais nettoyer pour un séjour fantôme', () => {
  const FIELDS = {
    id: ['id'], arrival: ['checkIn'], departure: ['checkOut'],
    arrivalTime: ['planned_arrival'], departureTime: ['planned_departure'], status: ['status'],
  };
  const row = (status: string) => toEvent(
    { id: 1, status, checkIn: '2026-09-18', checkOut: '2026-09-20' }, 'hostify', FIELDS,
  );

  it('confirme ce qui est accepté', () => {
    expect(row('accepted')?.status).toBe('CONFIRMED');
  });

  it('écarte les séjours qui n’auront pas lieu', () => {
    // Vus tels quels sur le compte : sans ça, un ménage était planifié pour une
    // réservation expirée ou annulée par le voyageur.
    for (const s of ['cancelled', 'expired', 'voided', 'timedout', 'declined']) {
      expect(row(s)?.status).toBe('CANCELLED');
    }
  });

  it('range les demandes en « à confirmer », sans créer de ménage', () => {
    // Une demande n'est pas une réservation : on la garde pour le jour où elle
    // le devient, mais materializeMissions ne lit que les « confirmed ».
    for (const s of ['inquiry', 'pending', 'unconfirmed']) {
      expect(row(s)?.status).toBe('TENTATIVE');
    }
  });

  it('lit un téléphone même quand l’éditeur l’envoie en nombre', () => {
    // Hostify renvoie 33780747060 sans guillemets : le cleaner perdait le contact.
    expect(pickGuestPhone({ guest_phone: 33780747060 })).toBe('33780747060');
    expect(pickGuestPhone({ phone: '+33 6 12 34 56 78' })).toBe('+33 6 12 34 56 78');
    expect(pickGuestPhone({ guest: { phone: '0612345678' } })).toBe('0612345678');
    expect(pickGuestPhone({})).toBeUndefined();
  });
});
