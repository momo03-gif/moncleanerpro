import { describe, it, expect } from 'vitest';
import { lireReservationRecue } from './webhookReservation';

describe('lireReservationRecue — une forme inconnue, lue sans deviner', () => {
  it('lit une réservation enveloppée, en snake_case anglais', () => {
    const r = lireReservationRecue({
      event: 'booking.created',
      data: { id: 8821, property_key: 'PK-3', start_date: '2026-10-02', end_date: '2026-10-06' },
    })!;
    expect(r.externalUid).toBe('8821');
    expect(r.checkIn).toBe('2026-10-02');
    expect(r.checkOut).toBe('2026-10-06');
    expect(r.propertyRef).toBe('PK-3');
    expect(r.status).toBe('confirmed');
  });

  it('lit aussi les noms français et le format JJ/MM/AAAA', () => {
    const r = lireReservationRecue({
      reservation: { reference: 'R-9', date_arrivee: '02/10/2026', date_depart: '06/10/2026' },
    })!;
    expect(r.checkIn).toBe('2026-10-02');
    expect(r.checkOut).toBe('2026-10-06');
  });

  it('comprend l’annulation même quand elle est dans le NOM de l’évènement', () => {
    const r = lireReservationRecue({
      event: 'booking.cancelled',
      booking: { id: 5, checkin: '2026-10-02', checkout: '2026-10-06' },
    })!;
    expect(r.status).toBe('cancelled');
  });

  it('une demande non confirmée ne vaut pas réservation', () => {
    const r = lireReservationRecue({ id: 6, status: 'pending', checkin: '2026-10-02', checkout: '2026-10-06' })!;
    expect(r.status).toBe('tentative');
  });

  it('accepte un horodatage numérique', () => {
    const r = lireReservationRecue({ id: 7, start_date: 1790000000, end_date: 1790259200 })!;
    expect(r.checkIn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('REFUSE plutôt que de deviner quand les dates sont illisibles', () => {
    // C'est la règle : un séjour inventé envoie un intervenant chez personne.
    expect(lireReservationRecue({ id: 9, du: 'mardi', au: 'vendredi' })).toBeNull();
    expect(lireReservationRecue({})).toBeNull();
    expect(lireReservationRecue(null)).toBeNull();
  });

  it('refuse un départ antérieur à l’arrivée', () => {
    expect(lireReservationRecue({ id: 10, checkin: '2026-10-06', checkout: '2026-10-02' })).toBeNull();
  });

  it('fabrique une clé stable quand l’éditeur n’envoie pas d’identifiant', () => {
    // Le même séjour renvoyé deux fois ne doit pas créer deux réservations.
    const a = lireReservationRecue({ property_key: 'PK-3', checkin: '2026-10-02', checkout: '2026-10-06' })!;
    const b = lireReservationRecue({ property_key: 'PK-3', checkin: '2026-10-02', checkout: '2026-10-06' })!;
    expect(a.externalUid).toBe(b.externalUid);
  });
});
