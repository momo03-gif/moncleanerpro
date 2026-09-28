import { describe, it, expect } from 'vitest';
import { toEvents, isBlocked } from './normalize';

// Ces tests figent ce que l'API de Lodgify nous a RÉELLEMENT répondu sur le
// compte d'une conciergerie — champs relevés le 28/09/2026.
const LIGNE = {
  id: 4321, user_id: 9, arrival: '2026-10-01', departure: '2026-10-04',
  property_id: 777, rooms: [], guest: { name: 'Voyageur' }, status: 'Booked',
  is_unavailable: false, check_in: '16:00', check_out: '10:00',
};

const CHAMPS = {
  id: ['id', 'bookingId'],
  arrival: ['arrival', 'date_arrival', 'arrivalDate', 'checkIn'],
  departure: ['departure', 'date_departure', 'departureDate', 'checkOut'],
  arrivalTime: ['arrivalTime', 'checkInTime', 'time_arrival'],
  departureTime: ['departureTime', 'checkOutTime', 'time_departure'],
  status: ['status'],
};

describe('Lodgify — la forme réelle de ses réservations', () => {
  it('lit les dates dans `arrival` et `departure`', () => {
    const [e] = toEvents([LIGNE], 'lodgify', CHAMPS, 'Lodgify');
    expect(e.start).toBe('2026-10-01');
    expect(e.end).toBe('2026-10-04');
    expect(e.status).toBe('CONFIRMED');
  });

  it('`is_unavailable` traduit en statut fait un BLOCAGE, pas un séjour', () => {
    // C'est ce que l'iCal de Booking ne dit jamais. Passer par le logiciel de
    // la conciergerie évite de planifier un ménage pour une date fermée.
    expect(isBlocked('blocked')).toBe(true);
    const [e] = toEvents([{ ...LIGNE, status: 'blocked' }], 'lodgify', CHAMPS, 'Lodgify');
    expect(e.summary).toBe('Blocked');
    expect(e.guestPhone).toBeUndefined();
  });

  it('un séjour refusé ne crée pas de ménage', () => {
    const [e] = toEvents([{ ...LIGNE, status: 'Declined' }], 'lodgify', CHAMPS, 'Lodgify');
    expect(e.status).toBe('CANCELLED');
  });

  it('une demande non confirmée non plus', () => {
    const [e] = toEvents([{ ...LIGNE, status: 'Tentative' }], 'lodgify', CHAMPS, 'Lodgify');
    expect(e.status).toBe('TENTATIVE');
  });
});
