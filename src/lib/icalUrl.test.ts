import { describe, it, expect } from 'vitest';
import { normalizeIcalUrl, detectPlatform, isLikelyIcalUrl } from './icalUrl';

describe('normalizeIcalUrl', () => {
  it('transforme webcal:// en https://', () => {
    expect(normalizeIcalUrl('webcal://www.airbnb.fr/calendar/ical/1.ics'))
      .toBe('https://www.airbnb.fr/calendar/ical/1.ics');
  });

  it('retire espaces et guillemets d’un copier-coller', () => {
    expect(normalizeIcalUrl('  "https://exemple.com/a.ics"  ')).toBe('https://exemple.com/a.ics');
  });
});

describe('detectPlatform — la plateforme se déduit du lien collé', () => {
  it('reconnaît Airbnb, quel que soit le domaine national', () => {
    expect(detectPlatform('https://www.airbnb.fr/calendar/ical/123.ics?s=abc')).toBe('airbnb');
    expect(detectPlatform('https://www.airbnb.com/calendar/ical/123.ics')).toBe('airbnb');
  });

  it('reconnaît les principales plateformes', () => {
    expect(detectPlatform('https://ical.booking.com/v1/export?t=xyz')).toBe('booking');
    expect(detectPlatform('https://app.smoobu.com/fr/cockpit/calendar/ical/1')).toBe('smoobu');
    expect(detectPlatform('https://api.hostaway.com/calendar/1.ics')).toBe('hostaway');
    expect(detectPlatform('https://www.beds24.com/api/ical.php?key=1')).toBe('beds24');
  });

  it('range Vrbo/Abritel dans le flux iCal générique', () => {
    expect(detectPlatform('https://www.vrbo.com/icalendar/abc.ics')).toBe('ical');
  });

  it('retombe sur le flux iCal générique pour un hôte inconnu', () => {
    expect(detectPlatform('https://mon-pms-maison.fr/export/calendar.ics')).toBe('ical');
  });

  it('refuse ce qui n’est pas une URL http(s)', () => {
    expect(detectPlatform('pas une url')).toBeUndefined();
    expect(detectPlatform('ftp://exemple.com/a.ics')).toBeUndefined();
  });
});

describe('isLikelyIcalUrl', () => {
  it('accepte un export .ics', () => {
    expect(isLikelyIcalUrl('https://www.airbnb.fr/calendar/ical/123.ics?s=abc')).toBe(true);
  });

  it('accepte un export sans extension mais annoncé comme calendrier', () => {
    expect(isLikelyIcalUrl('https://app.smoobu.com/fr/cockpit/calendar/ical/1')).toBe(true);
  });

  it('refuse une page web quelconque', () => {
    expect(isLikelyIcalUrl('https://www.airbnb.fr/rooms/12345')).toBe(false);
  });

  it('refuse une saisie vide ou incohérente', () => {
    expect(isLikelyIcalUrl('')).toBe(false);
    expect(isLikelyIcalUrl('mon calendrier')).toBe(false);
  });
});
