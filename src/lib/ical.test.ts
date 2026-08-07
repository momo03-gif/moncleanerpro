import { describe, it, expect } from 'vitest';
import { parseICal } from './ical';

// Robustesse du parseur iCal sur les variantes réelles des plateformes de
// réservation. Chaque cas reflète un export concret (Airbnb, Booking, PMS…).
describe('parseICal — robustesse multi-plateformes', () => {
  it('Airbnb : évènement tout-en-un-jour (VALUE=DATE), DTEND = jour de départ', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:abc-airbnb-1',
      'SUMMARY:Reserved',
      'DTSTART;VALUE=DATE:20260110',
      'DTEND;VALUE=DATE:20260112',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const [e] = parseICal(ics);
    expect(e.uid).toBe('abc-airbnb-1');
    expect(e.start).toBe('2026-01-10');
    expect(e.end).toBe('2026-01-12'); // départ = DTEND (pas d'exclusivité pour Airbnb)
    expect(e.startTime).toBeUndefined();
  });

  it('Booking/PMS : DATE-TIME avec heures locales', () => {
    const ics = [
      'BEGIN:VEVENT',
      'UID:booking-2',
      'SUMMARY:CONFIRMED - John Doe',
      'DTSTART:20260201T150000',
      'DTEND:20260205T100000',
      'STATUS:CONFIRMED',
      'END:VEVENT',
    ].join('\r\n');
    const [e] = parseICal(ics);
    expect(e.start).toBe('2026-02-01');
    expect(e.startTime).toBe('15:00');
    expect(e.end).toBe('2026-02-05');
    expect(e.endTime).toBe('10:00');
    expect(e.status).toBe('CONFIRMED');
  });

  it('Lignes pliées (line folding RFC 5545)', () => {
    const ics = [
      'BEGIN:VEVENT',
      'UID:fold-3',
      'DTSTART;VALUE=DATE:20260310',
      'DTEND;VALUE=DATE:20260312',
      'DESCRIPTION:Réservation avec une très longue description qui est',
      ' \treplié sur plusieurs lignes selon la norme iCal',
      'END:VEVENT',
    ].join('\r\n');
    const [e] = parseICal(ics);
    expect(e.description).toContain('longue description');
    expect(e.description).toContain('plusieurs lignes');
  });

  it('DURATION sans DTEND → fin reconstruite', () => {
    const ics = [
      'BEGIN:VEVENT',
      'UID:dur-4',
      'DTSTART;VALUE=DATE:20260401',
      'DURATION:P3D',
      'END:VEVENT',
    ].join('\r\n');
    const [e] = parseICal(ics);
    expect(e.start).toBe('2026-04-01');
    expect(e.end).toBe('2026-04-04');
  });

  it('DTEND manquant et pas de DURATION → une nuit supposée (réservation conservée)', () => {
    const ics = [
      'BEGIN:VEVENT',
      'UID:noend-5',
      'DTSTART;VALUE=DATE:20260501',
      'END:VEVENT',
    ].join('\r\n');
    const events = parseICal(ics);
    expect(events).toHaveLength(1);
    // Une réservation occupe au moins une nuit : le départ est le lendemain.
    expect(events[0].end).toBe('2026-05-02');
  });

  // Cas réel Hostaway : marqueur « reserved » d'une réservation croisée entre deux
  // annonces d'un même logement. Une nuit occupée sort en DTSTART == DTEND ; lu au
  // pied de la lettre, le ménage était programmé la veille du vrai départ.
  it('Hostaway : séjour de « zéro nuit » (DTSTART == DTEND) → départ le lendemain', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:hostaway-cross-1',
      'SUMMARY:reserved',
      'DESCRIPTION:reserved by hostaway cross reservations: 64245633',
      'DTSTART;VALUE=DATE:20260807',
      'DTEND;VALUE=DATE:20260807',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const [e] = parseICal(ics);
    expect(e.start).toBe('2026-08-07');
    expect(e.end).toBe('2026-08-08');
  });

  it('DTEND antérieur au DTSTART (flux incohérent) → départ le lendemain', () => {
    const ics = [
      'BEGIN:VEVENT',
      'UID:inverse-1',
      'DTSTART;VALUE=DATE:20260910',
      'DTEND;VALUE=DATE:20260909',
      'END:VEVENT',
    ].join('\r\n');
    const [e] = parseICal(ics);
    expect(e.end).toBe('2026-09-11');
  });

  // Garde-fou : un évènement HORAIRE qui commence et finit le même jour est
  // légitime (créneau de quelques heures) — il ne doit pas être décalé.
  it('Évènement horaire sur une même journée → dates inchangées', () => {
    const ics = [
      'BEGIN:VEVENT',
      'UID:meme-jour-horaire',
      'DTSTART:20260415T090000',
      'DTEND:20260415T113000',
      'END:VEVENT',
    ].join('\r\n');
    const [e] = parseICal(ics);
    expect(e.start).toBe('2026-04-15');
    expect(e.end).toBe('2026-04-15');
    expect(e.endTime).toBe('11:30');
  });

  it('Réservation normale (DTEND > DTSTART) → inchangée', () => {
    const ics = [
      'BEGIN:VEVENT',
      'UID:normale-1',
      'DTSTART;VALUE=DATE:20260808',
      'DTEND;VALUE=DATE:20260809',
      'END:VEVENT',
    ].join('\r\n');
    const [e] = parseICal(ics);
    expect(e.end).toBe('2026-08-09');
  });

  it('Évènement annulé et évènement multiple dans un même flux', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:cancel-6',
      'DTSTART;VALUE=DATE:20260610',
      'DTEND;VALUE=DATE:20260612',
      'STATUS:CANCELLED',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:ok-7',
      'DTSTART;VALUE=DATE:20260615',
      'DTEND;VALUE=DATE:20260617',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const events = parseICal(ics);
    expect(events).toHaveLength(2);
    expect(events[0].status).toBe('CANCELLED');
    expect(events[1].uid).toBe('ok-7');
  });

  it('Ignore un évènement sans UID', () => {
    const ics = [
      'BEGIN:VEVENT',
      'DTSTART;VALUE=DATE:20260701',
      'DTEND;VALUE=DATE:20260702',
      'END:VEVENT',
    ].join('\r\n');
    expect(parseICal(ics)).toHaveLength(0);
  });
});
