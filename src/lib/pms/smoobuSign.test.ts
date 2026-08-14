import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { canonicalQuery, canonicalString, EMPTY_BODY_SHA256 } from './smoobuSign';

describe('canonicalQuery — Smoobu recompose la requête de son côté', () => {
  it('trie les paramètres par nom', () => {
    expect(canonicalQuery({ to: '2026-09-01', from: '2026-08-01', apartmentId: 42 }))
      .toBe('apartmentId=42&from=2026-08-01&to=2026-09-01');
  });

  it('ignore les paramètres vides ou absents', () => {
    expect(canonicalQuery({ from: '2026-08-01', to: undefined, page: '' })).toBe('from=2026-08-01');
  });

  it('encode les valeurs', () => {
    expect(canonicalQuery({ q: 'a b&c' })).toBe('q=a%20b%26c');
  });

  it('rend une chaîne vide sans paramètre', () => {
    expect(canonicalQuery({})).toBe('');
  });
});

describe('canonicalString — la chaîne exactement signée', () => {
  it('assemble les sept éléments séparés par des sauts de ligne', () => {
    const s = canonicalString({
      method: 'get', path: '/api/reservations', query: 'from=2026-08-01',
      timestamp: '2026-08-14T12:00:00Z', nonce: 'abc-123', apiKey: 'usr_live_x',
    });
    expect(s.split('\n')).toEqual([
      'GET',
      '/api/reservations',
      'from=2026-08-01',
      '2026-08-14T12:00:00Z',
      'abc-123',
      EMPTY_BODY_SHA256,
      'usr_live_x',
    ]);
  });

  it('laisse la ligne de query vide quand il n’y en a pas', () => {
    const s = canonicalString({
      method: 'GET', path: '/api/apartments',
      timestamp: '2026-08-14T12:00:00Z', nonce: 'n', apiKey: 'k',
    });
    expect(s.split('\n')[2]).toBe('');
  });

  it('accepte un corps et son empreinte', () => {
    const bodyHash = createHash('sha256').update('{"apartmentId":123}').digest('hex');
    const s = canonicalString({
      method: 'POST', path: '/api/reservations', timestamp: 't', nonce: 'n', bodyHash, apiKey: 'k',
    });
    expect(s.split('\n')[5]).toBe(bodyHash);
  });
});

describe('EMPTY_BODY_SHA256', () => {
  it('correspond bien au sha256 d’une chaîne vide', () => {
    expect(createHash('sha256').update('').digest('hex')).toBe(EMPTY_BODY_SHA256);
  });
});
