import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Garde-fou : la base retire à la clé publique les colonnes sensibles de
// `reservations` et `reservation_feeds`. Si une requête client venait à les
// redemander, PostgREST refuserait la requête ENTIÈRE — les tableaux de
// réservations et l'écran des calendriers cesseraient de s'afficher, sans que
// rien n'indique pourquoi. Ce test échoue avant que ça n'arrive.
const SOURCE = readFileSync('src/lib/db/reservations.ts', 'utf8');

const INTERDITES_RESERVATIONS = [
  'guest_name', 'guest_phone', 'guest_phone_last4', 'reservation_url', 'raw', 'external_uid',
];
const INTERDITES_FLUX = ['api_key', 'api_secret', 'api_token', 'api_token_expires_at'];

function selectDe(nom: string): string {
  const i = SOURCE.indexOf(`const ${nom}`);
  expect(i, `${nom} introuvable`).toBeGreaterThan(-1);
  return SOURCE.slice(i, SOURCE.indexOf(';', i));
}

describe('Colonnes demandées par le navigateur', () => {
  it('RESERVATION_SELECT ne réclame aucune donnée de voyageur', () => {
    const bloc = selectDe('RESERVATION_SELECT');
    for (const col of INTERDITES_RESERVATIONS) expect(bloc).not.toContain(col);
  });

  it('FEED_SELECT ne réclame aucun identifiant', () => {
    const bloc = selectDe('FEED_SELECT');
    for (const col of INTERDITES_FLUX) expect(bloc).not.toContain(col);
  });

  it('aucune étoile : une étoile redemanderait tout, y compris l’interdit', () => {
    for (const nom of ['RESERVATION_SELECT', 'FEED_SELECT']) {
      expect(selectDe(nom)).not.toMatch(/'\s*\*/);
    }
  });

  it('demande quand même ce que les écrans affichent', () => {
    const bloc = selectDe('RESERVATION_SELECT');
    for (const col of ['check_in', 'check_out', 'status', 'mission_id', 'airbnbs(name)']) {
      expect(bloc).toContain(col);
    }
  });
});
