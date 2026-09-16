import { describe, it, expect } from 'vitest';
import { parseAirbnbDescription, displayableGuestName, dialablePhone } from './guestContact';

describe('parseAirbnbDescription — ce qu’un calendrier Airbnb laisse filtrer', () => {
  it('retrouve le lien de réservation et les 4 derniers chiffres', () => {
    const d = 'Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABC123\n'
      + 'Phone Number (Last 4 Digits): 1234';
    expect(parseAirbnbDescription(d)).toEqual({
      reservationUrl: 'https://www.airbnb.com/hosting/reservations/details/HMABC123',
      phoneLast4: '1234',
    });
  });

  it('marche aussi sur un export traduit en français', () => {
    const d = 'Réservation : https://www.airbnb.fr/hosting/reservations/details/HMZZZ\n'
      + 'Numéro de téléphone (4 derniers chiffres) : 9876';
    const r = parseAirbnbDescription(d);
    expect(r.phoneLast4).toBe('9876');
    expect(r.reservationUrl).toContain('airbnb.fr');
  });

  it('ne rend rien plutôt que de deviner', () => {
    expect(parseAirbnbDescription('')).toEqual({});
    expect(parseAirbnbDescription(null)).toEqual({});
    expect(parseAirbnbDescription('Nothing useful here')).toEqual({});
  });

  it('ne confond pas un numéro de réservation avec un téléphone', () => {
    // Un identifiant de résa traîne souvent dans la description : sans la mention
    // « 4 derniers chiffres », on ne le prend pas pour un numéro.
    expect(parseAirbnbDescription('Reservation code: HM4321').phoneLast4).toBeUndefined();
  });

  it('nettoie la ponctuation collée en fin de lien', () => {
    expect(parseAirbnbDescription('Voir https://www.airbnb.fr/z/abc.').reservationUrl)
      .toBe('https://www.airbnb.fr/z/abc');
  });
});

describe('displayableGuestName — « Reserved » n’est pas un nom', () => {
  it('écarte ce que les plateformes écrivent faute de voyageur', () => {
    for (const s of ['Reserved', 'reserved', 'Not available', 'CLOSED - Not available', 'Airbnb (Not available)']) {
      expect(displayableGuestName(s)).toBeUndefined();
    }
    expect(displayableGuestName('')).toBeUndefined();
    expect(displayableGuestName(null)).toBeUndefined();
  });

  it('garde un vrai nom, sans le nombre de personnes ajouté par les connecteurs', () => {
    expect(displayableGuestName('Marie Dupont')).toBe('Marie Dupont');
    expect(displayableGuestName('Marie Dupont · 3 pers.')).toBe('Marie Dupont');
  });
});

describe('dialablePhone — un numéro qu’on peut composer, ou rien', () => {
  it('nettoie les séparateurs d’un numéro français', () => {
    expect(dialablePhone('06 12 34 56 78')).toBe('0612345678');
    expect(dialablePhone('06.12.34.56.78')).toBe('0612345678');
  });

  it('garde le format international', () => {
    expect(dialablePhone('+33 6 12 34 56 78')).toBe('+33612345678');
  });

  it('refuse ce qui n’est pas un numéro — mieux vaut rien qu’un faux appel', () => {
    expect(dialablePhone('')).toBeUndefined();
    expect(dialablePhone(null)).toBeUndefined();
    expect(dialablePhone('demander à la conciergerie')).toBeUndefined();
    expect(dialablePhone('1234')).toBeUndefined();
  });
});
