import { describe, it, expect } from 'vitest';
import { canManageFeed, FEED_PUBLIC_COLUMNS, FEED_SECRET_COLUMNS } from './feedAccess';

const admin = { id: 'u-admin', role: 'admin' };
const gaia = { id: 'u-gaia', role: 'airbnb' };
const cocons = { id: 'u-cocons', role: 'airbnb' };
const cleaner = { id: 'u-cleaner', role: 'cleaner' };

describe('canManageFeed — brancher un calendrier', () => {
  it('laisse le partenaire gérer SES logements', () => {
    expect(canManageFeed(gaia, { partnerId: 'u-gaia' })).toBe(true);
  });

  it('refuse le logement d’un autre partenaire', () => {
    // Le cas qui compte : connecter un flux sur le logement du voisin
    // reviendrait à lire ses réservations.
    expect(canManageFeed(gaia, { partnerId: 'u-cocons' })).toBe(false);
    expect(canManageFeed(cocons, { partnerId: 'u-gaia' })).toBe(false);
  });

  it('refuse un logement géré en direct à un partenaire', () => {
    expect(canManageFeed(gaia, { partnerId: null })).toBe(false);
  });

  it('laisse l’admin passer partout', () => {
    expect(canManageFeed(admin, { partnerId: 'u-gaia' })).toBe(true);
    expect(canManageFeed(admin, { partnerId: null })).toBe(true);
  });

  it('refuse un cleaner, et refuse sans session', () => {
    expect(canManageFeed(cleaner, { partnerId: 'u-gaia' })).toBe(false);
    expect(canManageFeed(null, { partnerId: 'u-gaia' })).toBe(false);
    expect(canManageFeed(gaia, null)).toBe(false);
  });
});

describe('Colonnes exposées au navigateur', () => {
  it('n’expose aucun identifiant', () => {
    for (const secret of FEED_SECRET_COLUMNS) {
      expect(FEED_PUBLIC_COLUMNS).not.toContain(secret);
    }
  });

  it('expose ce dont l’écran a besoin', () => {
    // Si une de ces colonnes disparaissait des droits, l'écran partenaire
    // cesserait d'afficher l'état des calendriers.
    for (const needed of ['id', 'airbnb_id', 'platform', 'active', 'last_sync_status', 'connection_kind']) {
      expect(FEED_PUBLIC_COLUMNS).toContain(needed);
    }
  });

  it('couvre exactement ce que lit le client', async () => {
    // FEED_SELECT (db/reservations.ts) ne doit demander que des colonnes
    // autorisées, sinon la requête entière est refusée par la base.
    const src = await import('node:fs').then(fs =>
      fs.readFileSync('src/lib/db/reservations.ts', 'utf8'));
    const bloc = src.slice(src.indexOf('const FEED_SELECT'), src.indexOf('const RESERVATION_SELECT'));
    const demandees = bloc.match(/[a-z_]+(?=,|')/g) ?? [];
    for (const secret of FEED_SECRET_COLUMNS) {
      expect(demandees).not.toContain(secret);
    }
  });
});
