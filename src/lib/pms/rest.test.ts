import { describe, it, expect } from 'vitest';
import { defineRestPms, basicAuth, type RestPmsDescriptor, type FetchLike, type TokenStore } from './rest';
import { REST_PMS, REST_CONNECTORS } from './catalog';

// Un faux serveur : on capture l'URL appelée et les en-têtes, et on rend ce
// qu'on veut. Aucun appel réseau dans les tests.
function fakeFetch(payload: unknown, status = 200) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const impl: FetchLike = async (url, init) => {
    calls.push({ url, headers: (init?.headers ?? {}) as Record<string, string> });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
    } as Response;
  };
  return { impl, calls };
}

const DESC: RestPmsDescriptor = {
  id: 'demo',
  label: 'Demo',
  base: 'https://api.demo.test',
  auth: creds => ({ 'x-api-key': creds.apiKey }),
  listings: { path: '/listings' },
  reservations: {
    path: '/reservations',
    propertyParam: 'listing_id',
    fromParam: 'start',
    toParam: 'end',
    fields: {
      id: ['id'], arrival: ['checkIn'], departure: ['checkOut'],
      arrivalTime: ['checkInTime'], departureTime: ['checkOutTime'], status: ['status'],
    },
    propertyIdFields: ['listing_id'],
  },
  verified: false,
};

const RANGE = { from: '2026-09-01', to: '2026-12-01' };

describe('defineRestPms — le socle commun des connecteurs', () => {
  it('présente la clé et lit la liste des logements, quelle que soit l’enveloppe', async () => {
    const { impl, calls } = fakeFetch({ data: [{ id: 7, name: 'T2 Croix-Rousse' }] });
    const pms = defineRestPms(DESC);
    const list = await pms.list({ apiKey: 'K' }, { fetchImpl: impl });

    expect(list).toEqual([{ id: '7', name: 'T2 Croix-Rousse' }]);
    expect(calls[0].url).toBe('https://api.demo.test/listings');
    expect(calls[0].headers['x-api-key']).toBe('K');
  });

  it('nomme un logement sans nom plutôt que de rendre une ligne vide', async () => {
    const { impl } = fakeFetch([{ id: 9 }]);
    const list = await defineRestPms(DESC).list({ apiKey: 'K' }, { fetchImpl: impl });
    expect(list).toEqual([{ id: '9', name: 'Logement 9' }]);
  });

  it('demande TOUJOURS le seul logement concerné, jamais tout le compte', async () => {
    const { impl, calls } = fakeFetch([]);
    await defineRestPms(DESC).fetchReservations({ apiKey: 'K' }, '42', RANGE, { fetchImpl: impl }).catch(() => {});
    const url = new URL(calls[0].url);
    expect(url.searchParams.get('listing_id')).toBe('42');
    expect(url.searchParams.get('start')).toBe('2026-09-01');
    expect(url.searchParams.get('end')).toBe('2026-12-01');
  });

  it('JETTE les réservations d’un autre logement si l’éditeur ignore le filtre', async () => {
    // Le cas qui compte : la conciergerie nous confie une clé qui ouvre tout son
    // compte. On ne doit rien lire d'autre que le logement qu'on entretient.
    const { impl } = fakeFetch([
      { id: 1, listing_id: '42', checkIn: '2026-09-10', checkOut: '2026-09-14' },
      { id: 2, listing_id: '99', checkIn: '2026-09-11', checkOut: '2026-09-15' },
    ]);
    const events = await defineRestPms(DESC).fetchReservations({ apiKey: 'K' }, '42', RANGE, { fetchImpl: impl });
    expect(events).toHaveLength(1);
    expect(events[0].uid).toBe('demo-1');
  });

  it('borne la période même si l’éditeur renvoie plus large', async () => {
    const { impl } = fakeFetch([
      { id: 1, listing_id: '42', checkIn: '2026-09-10', checkOut: '2026-09-14' },
      { id: 2, listing_id: '42', checkIn: '2025-01-02', checkOut: '2025-01-06' },
    ]);
    const events = await defineRestPms(DESC).fetchReservations({ apiKey: 'K' }, '42', RANGE, { fetchImpl: impl });
    expect(events.map(e => e.uid)).toEqual(['demo-1']);
  });

  it('traduit les échecs en phrases pour une conciergerie, pas pour un développeur', async () => {
    const refused = fakeFetch({}, 401);
    await expect(defineRestPms(DESC).list({ apiKey: 'K' }, { fetchImpl: refused.impl }))
      .rejects.toThrow('Clé Demo refusée.');

    const throttled = fakeFetch({}, 429);
    await expect(defineRestPms(DESC).list({ apiKey: 'K' }, { fetchImpl: throttled.impl }))
      .rejects.toThrow(/limite temporairement/);
  });

  it('refuse à la construction un descripteur qui ne filtre pas par logement', () => {
    // Un oubli de programmation ne doit pas pouvoir devenir une fuite de données.
    expect(() => defineRestPms({
      ...DESC, reservations: { ...DESC.reservations, propertyParam: null },
    })).toThrow(/aucun filtre par logement/);
  });

  it('refuse le lot entier quand rien n’est lisible — plutôt qu’une synchro vide', () => {
    // Garantie héritée de normalize.ts : une synchro silencieusement vide ferait
    // croire à la conciergerie qu'elle n'a aucune réservation.
    const { impl } = fakeFetch([{ id: 1, listing_id: '42', foo: 'bar' }]);
    return expect(defineRestPms(DESC).fetchReservations({ apiKey: 'K' }, '42', RANGE, { fetchImpl: impl }))
      .rejects.toThrow(/aucune date de séjour lisible/);
  });
});

// ── Pagination : le bug qui rendait la synchro silencieusement vide ─────────
describe('Pagination — sans elle, on ne voit que les vieilles réservations', () => {
  const PAGED: RestPmsDescriptor = {
    ...DESC,
    reservations: {
      ...DESC.reservations,
      fromParam: undefined,
      toParam: undefined,
      pagination: { pageParam: 'page', sizeParam: 'per_page', size: 2, maxPages: 10 },
    },
  };

  /** Faux Hostify : plafonne à `size` lignes, les plus anciennes d'abord. */
  function pagedFetch(rows: Record<string, unknown>[]) {
    const calls: (string | null)[] = [];
    const impl: FetchLike = async url => {
      const u = new URL(url);
      calls.push(u.searchParams.get('page'));
      const size = Number(u.searchParams.get('per_page') ?? 2);
      const page = Number(u.searchParams.get('page') ?? 1);
      return { ok: true, status: 200, json: async () => rows.slice((page - 1) * size, page * size) } as Response;
    };
    return { impl, calls };
  }

  it('va chercher les pages suivantes jusqu’à la dernière', async () => {
    // Cas réel : 327 réservations chez Hostify, la seule à venir en page 2.
    const rows = [
      { id: 1, listing_id: '42', checkIn: '2023-01-02', checkOut: '2023-01-06' },
      { id: 2, listing_id: '42', checkIn: '2023-02-02', checkOut: '2023-02-06' },
      { id: 3, listing_id: '42', checkIn: '2026-09-18', checkOut: '2026-09-20' },
    ];
    const { impl, calls } = pagedFetch(rows);
    const events = await defineRestPms(PAGED).fetchReservations({ apiKey: 'K' }, '42', RANGE, { fetchImpl: impl });

    expect(calls).toEqual(['1', '2']);
    // Seul le séjour dans la période ressort — mais il a fallu la page 2 pour le voir.
    expect(events.map(e => e.uid)).toEqual(['demo-3']);
  });

  it('s’arrête si l’éditeur ignore « page » et resert la même chose', async () => {
    // Sinon : boucle infinie sur l'API d'un client. Inacceptable.
    let calls = 0;
    const impl: FetchLike = async () => {
      calls++;
      return { ok: true, status: 200, json: async () => ([
        { id: 1, listing_id: '42', checkIn: '2026-09-18', checkOut: '2026-09-20' },
        { id: 2, listing_id: '42', checkIn: '2026-09-21', checkOut: '2026-09-23' },
      ]) } as Response;
    };
    await defineRestPms(PAGED).fetchReservations({ apiKey: 'K' }, '42', RANGE, { fetchImpl: impl });
    expect(calls).toBe(2);   // 1re page, 2e identique → arrêt
  });
});

// ── OAuth2 : le jeton, et surtout sa conservation ────────────────────────────
const OAUTH_DESC: RestPmsDescriptor = {
  ...DESC,
  id: 'demo-oauth',
  auth: () => ({}),
  oauth2: {
    tokenUrl: 'https://api.demo.test/oauth2/token',
    body: creds => ({ clientId: creds.apiKey, clientSecret: creds.apiSecret ?? '' }),
  },
};

/** Faux serveur qui distingue la demande de jeton des appels de données. */
function oauthFetch(rows: unknown[] = []) {
  const calls: string[] = [];
  let tokensIssued = 0;
  const impl: FetchLike = async (url, init) => {
    calls.push(url);
    if (url.includes('/oauth2/token')) {
      tokensIssued++;
      return {
        ok: true, status: 200,
        json: async () => ({ access_token: `jeton-${tokensIssued}`, expires_in: 86400 }),
      } as Response;
    }
    const headers = (init?.headers ?? {}) as Record<string, string>;
    return { ok: true, status: 200, json: async () => ({ auth: headers.Authorization, data: rows }) } as Response;
  };
  return { impl, calls, issued: () => tokensIssued };
}

function fakeStore(): TokenStore & { value: { token: string; expiresAt: number } | null } {
  return {
    value: null,
    async get() { return this.value; },
    async set(_k, token, expiresAt) { this.value = { token, expiresAt }; },
  };
}

describe('OAuth2 — le jeton se réutilise, sinon on coupe l’accès du client', () => {
  it('échange les identifiants contre un jeton et le présente en Bearer', async () => {
    const { impl, calls } = oauthFetch([{ id: 1, listing_id: '42', checkIn: '2026-09-10', checkOut: '2026-09-14' }]);
    const store = fakeStore();
    const pms = defineRestPms(OAUTH_DESC);

    await pms.fetchReservations({ apiKey: 'ID', apiSecret: 'SECRET' }, '42', RANGE,
      { fetchImpl: impl, tokens: store, tokenKey: 'flux-1' });

    expect(calls[0]).toContain('/oauth2/token');
    expect(store.value?.token).toBe('jeton-1');
  });

  it('ne redemande PAS de jeton au deuxième appel — le quota de l’éditeur est limité', async () => {
    // Guesty n'accorde que quelques jetons par 24 h et par application : en
    // redemander à chaque synchro épuiserait le compte du client.
    const { impl, issued } = oauthFetch([]);
    const store = fakeStore();
    const pms = defineRestPms(OAUTH_DESC);
    const opts = { fetchImpl: impl, tokens: store, tokenKey: 'flux-1' };

    await pms.list({ apiKey: 'ID', apiSecret: 'S' }, opts);
    await pms.list({ apiKey: 'ID', apiSecret: 'S' }, opts);
    await pms.list({ apiKey: 'ID', apiSecret: 'S' }, opts);

    expect(issued()).toBe(1);
  });

  it('en redemande un quand celui qu’on a est périmé', async () => {
    const { impl, issued } = oauthFetch([]);
    const store = fakeStore();
    store.value = { token: 'vieux', expiresAt: Date.now() - 1000 };

    await defineRestPms(OAUTH_DESC).list({ apiKey: 'ID', apiSecret: 'S' },
      { fetchImpl: impl, tokens: store, tokenKey: 'flux-1' });

    expect(issued()).toBe(1);
    expect(store.value?.token).toBe('jeton-1');
  });

  it('renouvelle AVANT l’échéance, jamais au moment pile', async () => {
    const { impl } = oauthFetch([]);
    const store = fakeStore();
    await defineRestPms({ ...OAUTH_DESC, oauth2: { ...OAUTH_DESC.oauth2!, earlyRefreshSec: 600 } })
      .list({ apiKey: 'ID', apiSecret: 'S' }, { fetchImpl: impl, tokens: store, tokenKey: 'f' });

    // 86400 s annoncés, 600 s de marge → on garde le jeton un peu moins longtemps.
    const remaining = (store.value!.expiresAt - Date.now()) / 1000;
    expect(remaining).toBeLessThan(86400);
    expect(remaining).toBeGreaterThan(86400 - 700);
  });

  it('dit clairement quand les identifiants sont refusés', async () => {
    const impl: FetchLike = async () => ({ ok: false, status: 401, json: async () => ({}) } as Response);
    await expect(defineRestPms(OAUTH_DESC).list({ apiKey: 'X', apiSecret: 'Y' }, { fetchImpl: impl, tokens: fakeStore() }))
      .rejects.toThrow('Identifiants Demo refusés.');
  });
});

describe('basicAuth', () => {
  it('encode identifiant et secret', () => {
    expect(basicAuth('user', 'pass').Authorization)
      .toBe(`Basic ${Buffer.from('user:pass').toString('base64')}`);
  });
});

describe('Catalogue des connecteurs REST', () => {
  it('restreint chaque connecteur à un seul logement', () => {
    for (const d of REST_PMS) {
      const byPath = typeof d.reservations.path === 'function';
      expect(d.reservations.propertyParam !== null || byPath).toBe(true);
    }
  });

  it('se construit sans erreur — donc aucun descripteur ne viole la règle', () => {
    expect(Object.keys(REST_CONNECTORS).length).toBe(REST_PMS.length);
  });

  it('n’a pas d’identifiant en double, et aucun ne recouvre un connecteur dédié', () => {
    const ids = REST_PMS.map(d => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const dedicated of ['smoobu', 'hostaway', 'beds24', 'lodgify']) {
      expect(ids).not.toContain(dedicated);
    }
  });

  it('annonce clairement ce qui n’a pas été confirmé contre un vrai compte', () => {
    // Tant que personne n'a branché de clé réelle, `verified` reste false : c'est
    // ce drapeau qui fait afficher l'avertissement dans le parcours de connexion.
    for (const d of REST_PMS) expect(typeof d.verified).toBe('boolean');
  });
});
