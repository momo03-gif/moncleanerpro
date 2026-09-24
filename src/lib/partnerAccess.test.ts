import { describe, it, expect } from 'vitest';
import { generatePassword, buildAccessMessage, APP_LOGIN_URL } from './partnerAccess';

describe('generatePassword — transmissible sans erreur de recopie', () => {
  it('respecte le minimum de 6 caractères exigé par le formulaire', () => {
    expect(generatePassword().replace('-', '').length).toBeGreaterThanOrEqual(6);
  });

  it('ne contient aucun caractère ambigu (0/O, 1/l/I)', () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePassword()).not.toMatch(/[0O1lI]/);
    }
  });

  it('est coupé en deux groupes par un tiret', () => {
    expect(generatePassword()).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]+$/);
  });

  it('ne retombe pas deux fois sur le même', () => {
    const seen = new Set(Array.from({ length: 50 }, () => generatePassword()));
    expect(seen.size).toBe(50);
  });

  it('ne descend jamais sous 8 caractères, même si on le demande', () => {
    expect(generatePassword(2).replace('-', '').length).toBe(8);
  });
});

describe('buildAccessMessage — le message qu’on colle au partenaire', () => {
  const base = { name: 'Hosting Services Lyon', email: 'contact@hsl.fr' };

  it('contient le lien, l’identifiant et le mot de passe', () => {
    const txt = buildAccessMessage({ ...base, password: 'mK7q-t4Rn2p' });
    expect(txt).toContain(APP_LOGIN_URL);
    expect(txt).toContain('contact@hsl.fr');
    expect(txt).toContain('mK7q-t4Rn2p');
  });

  it('salue le partenaire par son nom', () => {
    expect(buildAccessMessage(base)).toContain('Bonjour Hosting Services Lyon,');
  });

  it('reste correct sans nom', () => {
    expect(buildAccessMessage({ email: 'a@b.fr' })).toContain('Bonjour,');
  });

  it('signe au nom de l’équipe, jamais d’une personne', () => {
    expect(buildAccessMessage(base)).toContain('L’équipe MonCleanerPro');
  });

  it('sans mot de passe, ne parle pas de mot de passe', () => {
    const txt = buildAccessMessage(base);
    expect(txt).not.toContain('Mot de passe');
    expect(txt).toContain('Identifiant : a@b.fr'.replace('a@b.fr', 'contact@hsl.fr'));
  });

  it('accepte un autre lien (domaine de test)', () => {
    expect(buildAccessMessage({ ...base, url: 'http://localhost:3000/login' }))
      .toContain('http://localhost:3000/login');
  });
});
