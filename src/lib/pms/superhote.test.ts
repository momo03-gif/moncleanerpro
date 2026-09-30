import { describe, it, expect } from 'vitest';
import { toEvents } from './normalize';

// Forme SUPPOSÉE — la documentation de SuperHote est derrière un espace client.
// Ces tests figent la lecture des champs telle qu'on l'a décrite d'après
// `get-availabilities`, seul endpoint publié : snake_case, et un logement
// désigné par `property_key`. À reprendre dès qu'un vrai compte aura répondu.
const CHAMPS = {
  id: ['id', 'reservation_id', 'booking_id', 'key', 'reservation_key'],
  arrival: ['start_date', 'checkin', 'check_in', 'arrival', 'date_arrivee', 'arrival_date'],
  departure: ['end_date', 'checkout', 'check_out', 'departure', 'date_depart', 'departure_date'],
  arrivalTime: ['checkin_time', 'check_in_time', 'arrival_time', 'heure_arrivee'],
  departureTime: ['checkout_time', 'check_out_time', 'departure_time', 'heure_depart'],
  status: ['status', 'statut', 'state'],
};

describe('SuperHote — lecture tolérante des noms de champs', () => {
  it('lit les dates en snake_case anglais', () => {
    const [e] = toEvents(
      [{ id: 12, start_date: '2026-10-02', end_date: '2026-10-05', status: 'confirmed' }],
      'superhote', CHAMPS, 'SuperHote',
    );
    expect(e.start).toBe('2026-10-02');
    expect(e.end).toBe('2026-10-05');
    expect(e.status).toBe('CONFIRMED');
  });

  it('lit aussi les noms français, que SuperHote mélange selon les endpoints', () => {
    const [e] = toEvents(
      [{ id: 13, date_arrivee: '2026-10-02', date_depart: '2026-10-05' }],
      'superhote', CHAMPS, 'SuperHote',
    );
    expect(e.start).toBe('2026-10-02');
    expect(e.end).toBe('2026-10-05');
  });

  it('un séjour annulé ne crée pas de ménage', () => {
    const [e] = toEvents(
      [{ id: 14, start_date: '2026-10-02', end_date: '2026-10-05', statut: 'cancelled' }],
      'superhote', CHAMPS, 'SuperHote',
    );
    expect(e.status).toBe('CANCELLED');
  });

  it('refuse le lot entier si aucune date n’est lisible', () => {
    // Mieux vaut une erreur visible qu'une synchro silencieusement vide : c'est
    // exactement ce qui a fait perdre des semaines sur Lodgify.
    expect(() => toEvents([{ id: 15, du: '2026-10-02', au: '2026-10-05' }], 'superhote', CHAMPS, 'SuperHote'))
      .toThrow(/SuperHote/);
  });
});
