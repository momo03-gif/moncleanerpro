import { describe, it, expect } from 'vitest';
import { conflitCalendrier } from './conflits';

describe('Un PMS centralise déjà les plateformes qu’il redistribue', () => {
  it('avertit quand on ajoute Airbnb sur un logement déjà relié à Hostify', () => {
    // Le cas réel : Heritage Spa, relié à Hostify, avait gardé son lien Airbnb.
    const msg = conflitCalendrier([{ platform: 'hostify', active: true }], 'airbnb');
    expect(msg).toContain('Hostify');
    expect(msg).toContain('deux fois');
  });

  it('avertit aussi pour Booking — Hostify le redistribue tout autant', () => {
    const msg = conflitCalendrier([{ platform: 'hostify', active: true }], 'booking');
    expect(msg).toContain('Booking');
  });

  it('nomme les calendriers à retirer quand on branche le PMS en second', () => {
    const msg = conflitCalendrier(
      [{ platform: 'airbnb', active: true }, { platform: 'booking', active: true }], 'hostify');
    expect(msg).toContain('Airbnb');
    expect(msg).toContain('Booking');
    expect(msg).toContain('retirez');
  });

  it('refuse de laisser passer deux logiciels de gestion sans un mot', () => {
    const msg = conflitCalendrier([{ platform: 'hostify', active: true }], 'guesty');
    expect(msg).toContain('Hostify');
  });

  it('ne dit rien pour Airbnb + Booking en direct — c’est le cas normal', () => {
    // Le propriétaire sans PMS qui loue sur plusieurs plateformes : deux
    // annonces distinctes, jamais le même séjour.
    expect(conflitCalendrier([{ platform: 'airbnb', active: true }], 'booking')).toBeNull();
  });

  it('ne dit rien sur un logement vierge', () => {
    expect(conflitCalendrier([], 'airbnb')).toBeNull();
    expect(conflitCalendrier([], 'hostify')).toBeNull();
  });

  it('ignore un calendrier désactivé — il n’importe plus rien', () => {
    expect(conflitCalendrier([{ platform: 'hostify', active: false }], 'airbnb')).toBeNull();
  });

  it('ne dit rien pour un même PMS reconnecté sur un autre logement du compte', () => {
    expect(conflitCalendrier([{ platform: 'hostify', active: true }], 'hostify')).toBeNull();
  });
});
