// ── Socle commun des connecteurs PMS REST — SERVEUR UNIQUEMENT ───────────────
//
// Les quatre premiers connecteurs (Smoobu, Hostaway, Beds24, Lodgify) ont été
// écrits un par un, clé en main, contre leur documentation. En les relisant, ils
// ne diffèrent que par cinq choses : l'adresse de base, la façon de présenter la
// clé, le nom de l'endpoint des logements, celui des réservations, et le nom des
// paramètres de période. Tout le reste — le délai d'attente, la pagination, les
// erreurs lisibles, la lecture tolérante des champs — est identique.
//
// Ce fichier est ce « tout le reste ». Ajouter un logiciel devient alors un
// OBJET de description (cf. catalog.ts), pas un fichier de code.
//
// ⚠️ RÈGLE ABSOLUE — ON NE LIT QUE NOS LOGEMENTS.
// Une conciergerie nous confie une clé qui ouvre TOUT son compte. Nous n'avons
// aucune raison de voir son activité : seulement le logement qu'elle nous fait
// entretenir. D'où deux garde-fous, et non un seul :
//   1) la requête porte toujours le filtre par logement (`propertyParam`) —
//      un descripteur qui n'en déclare pas est refusé, un test le vérifie ;
//   2) si l'éditeur renvoie quand même des lignes d'un autre logement, on les
//      JETTE avant lecture (`propertyIdFields`).
// C'est aussi ce qu'on promet à l'écran de connexion : « Nous ne lisons que les
// réservations du logement choisi. »
//
// ⚠️ Ne jamais importer côté client.

import { toEvents, type FieldNames } from './normalize';
import type { ICalEvent } from '../ical';

export interface PmsCreds {
  apiKey: string;
  apiSecret?: string;
}

type Params = Record<string, string | number | undefined>;

export interface RestPmsDescriptor {
  id: string;
  label: string;
  /** Racine de l'API, sans barre finale. */
  base: string;
  /** En-têtes d'authentification, à partir des identifiants saisis. */
  auth: (creds: PmsCreds) => Record<string, string>;

  /** Endpoint qui liste les logements du compte (écran « quel logement ? »). */
  listings: {
    path: string;
    params?: (creds: PmsCreds) => Params;
    /** Clés où chercher le tableau dans la réponse (en plus des habituelles). */
    collection?: string[];
    idFields?: string[];
    nameFields?: string[];
    /**
     * Tous les éditeurs ne montrent pas tous les logements sur cet endpoint.
     * Chez Hostify, une clé de conciergerie n'en voit que six alors que son
     * compte en exploite treize : les annonces par canal (« … - Bcom ») et les
     * annonces refaites n'y figurent pas, et `/listings/all` est refusé.
     * Résultat : le logement qu'on cherchait à connecter n'était pas proposé,
     * et on en connectait un homonyme endormi.
     *
     * On complète donc la liste avec les logements VUS dans les réservations
     * récentes : même API, même clé, et surtout les noms que la conciergerie lit
     * dans son propre logiciel.
     *
     * ⚠️ Ce balayage n'a lieu QU'À LA CONNEXION, pour dresser la liste des
     * logements à choisir — exactement ce que fait l'endpoint de liste. La
     * synchro, elle, reste filtrée sur le seul logement retenu (RÈGLE ABSOLUE).
     */
    alsoFromReservations?: {
      idField: string;
      nameField: string;
      /** Nombre de pages à lire EN FIN de liste (les plus récentes). */
      recentPages?: number;
    };
  };

  reservations: {
    /** Chemin, ou fonction quand l'identifiant du logement est dans l'URL. */
    path: string | ((propertyId: string) => string);
    /**
     * Nom du paramètre qui restreint au logement. `null` UNIQUEMENT quand le
     * chemin porte déjà l'identifiant (cf. règle absolue plus haut).
     */
    propertyParam: string | null;
    /**
     * Noms des paramètres de période — FACULTATIFS. Hostify, par exemple, rend
     * zéro ligne si on lui envoie `start_date`/`end_date` : mieux vaut ne rien
     * filtrer côté serveur que de tout perdre. La période est de toute façon
     * rebornée localement, donc le résultat reste juste.
     */
    fromParam?: string;
    toParam?: string;
    /**
     * Pagination. Presque tous plafonnent les pages (Hostify : 100 lignes, quoi
     * qu'on demande). Sans cela, on ne voit que les PLUS ANCIENNES réservations
     * et jamais les séjours à venir — donc aucun ménage n'est créé.
     */
    pagination?: {
      pageParam: string;      // ex. « page »
      sizeParam?: string;     // ex. « per_page »
      size?: number;          // taille demandée (le serveur peut la réduire)
      maxPages?: number;      // garde-fou : on ne balaie pas un compte à l'infini
    };
    /** Paramètres fixes (pagination, statut…). */
    extra?: Params;
    collection?: string[];
    fields: FieldNames;
    /** Où lire l'identifiant du logement dans une ligne (filet de sécurité). */
    propertyIdFields?: string[];
  };

  /**
   * Les gros éditeurs ne donnent pas une clé : ils donnent un identifiant et un
   * secret, qu'on échange contre un jeton de courte durée (OAuth2, « client
   * credentials »). C'est ainsi que les plateformes du marché se branchent à
   * Guesty ou BookingSync — il n'y a pas d'autre voie.
   *
   * ⚠️ LE JETON DOIT ÊTRE CONSERVÉ. Guesty n'en délivre que quelques-uns par
   * tranche de 24 h et par application. Un connecteur qui redemande un jeton à
   * chaque synchro épuiserait le quota du client en une journée et lui
   * couperait SON PROPRE accès. Le socle conserve donc le jeton (cf. TokenStore)
   * et ne le renouvelle qu'à l'approche de l'expiration.
   */
  oauth2?: {
    tokenUrl: string;
    /** Corps de la demande de jeton, en JSON. */
    body: (creds: PmsCreds) => Record<string, string>;
    /** Marge avant expiration : on renouvelle un peu avant, jamais trop tard. */
    earlyRefreshSec?: number;
  };

  /**
   * `false` = forme de l'API décrite d'après la documentation publique mais
   * JAMAIS confirmée contre un vrai compte. Le parcours de connexion l'annonce,
   * et la clé est testée avant d'être enregistrée : au pire, l'essai échoue
   * devant l'utilisateur et il repart sur le lien de calendrier.
   */
  verified: boolean;
}

// L'identifiant est toujours rendu en texte : les éditeurs mélangent nombres,
// UUID et codes, et c'est de toute façon en texte qu'on le stocke.
export interface PmsProperty { id: string; name: string }

/** Injectable pour les tests — en production, le `fetch` de la plateforme. */
export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Où ranger un jeton OAuth2 entre deux appels. En mémoire par défaut, ce qui
 * suffit à une même exécution ; la synchro, elle, fournit un magasin qui écrit
 * dans le flux (`reservation_feeds`) — sur une plateforme sans serveur, chaque
 * démarrage à froid repartirait sinon de zéro et brûlerait le quota de jetons.
 */
export interface TokenStore {
  get(key: string): Promise<{ token: string; expiresAt: number } | null>;
  set(key: string, token: string, expiresAt: number): Promise<void>;
}

const memoryTokens = new Map<string, { token: string; expiresAt: number }>();

export const memoryTokenStore: TokenStore = {
  async get(key) { return memoryTokens.get(key) ?? null; },
  async set(key, token, expiresAt) { memoryTokens.set(key, { token, expiresAt }); },
};

/** Options communes aux deux fonctions d'un connecteur. */
export interface PmsCallOptions {
  fetchImpl?: FetchLike;
  tokens?: TokenStore;
  /** Clé de rangement du jeton — l'identifiant du flux en production. */
  tokenKey?: string;
}

const TIMEOUT_MS = 15000;

function buildUrl(base: string, path: string, params: Params): string {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
  return `${base}${path}${query ? `?${query}` : ''}`;
}

/** Les éditeurs enveloppent leurs listes de dix façons. On les déballe toutes. */
function unwrap(payload: unknown, extraKeys: string[] = []): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const obj = payload as Record<string, unknown> | null;
  if (!obj) return [];
  for (const key of [...extraKeys, 'data', 'items', 'results', 'result', 'bookings', 'reservations', 'listings', 'properties', 'rentals']) {
    const v = obj[key];
    if (Array.isArray(v)) return v as Record<string, unknown>[];
    // Une enveloppe peut en cacher une autre : { data: { bookings: [...] } }.
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const inner of [...extraKeys, 'data', 'items', 'results', 'bookings', 'reservations']) {
        const deep = (v as Record<string, unknown>)[inner];
        if (Array.isArray(deep)) return deep as Record<string, unknown>[];
      }
    }
  }
  return [];
}

function readField(row: Record<string, unknown>, names: string[]): string | undefined {
  for (const n of names) {
    const v = row[n];
    if (v !== undefined && v !== null && v !== '') return String(v);
  }
  return undefined;
}

/**
 * Jeton OAuth2 : repris tel quel s'il est encore valable, redemandé sinon.
 * Cf. l'avertissement sur `oauth2` — redemander à chaque appel coupe l'accès du
 * client chez son propre éditeur.
 */
async function bearerToken(
  d: RestPmsDescriptor, creds: PmsCreds, opts: PmsCallOptions, doFetch: FetchLike,
): Promise<string> {
  const oauth = d.oauth2!;
  const store = opts.tokens ?? memoryTokenStore;
  const key = `${d.id}:${opts.tokenKey ?? creds.apiKey}`;

  const kept = await store.get(key);
  if (kept && kept.expiresAt > Date.now()) return kept.token;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await doFetch(oauth.tokenUrl, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(oauth.body(creds)),
    });
    if (!res.ok) {
      throw new Error(res.status === 401 || res.status === 403
        ? `Identifiants ${d.label} refusés.`
        : `${d.label} a refusé de délivrer un jeton (${res.status}).`);
    }
    const payload = await res.json() as { access_token?: string; token?: string; expires_in?: number };
    const token = payload.access_token ?? payload.token;
    if (!token) throw new Error(`Réponse ${d.label} non comprise : aucun jeton reçu.`);

    // Marge : on renouvelle avant l'échéance, jamais après.
    const early = oauth.earlyRefreshSec ?? 300;
    const ttl = Math.max(60, (payload.expires_in ?? 3600) - early);
    await store.set(key, token, Date.now() + ttl * 1000);
    return token;
  } finally {
    clearTimeout(timer);
  }
}

async function request(
  d: RestPmsDescriptor, url: string, creds: PmsCreds, opts: PmsCallOptions, doFetch: FetchLike,
): Promise<unknown> {
  const authHeaders = d.oauth2
    ? { Authorization: `Bearer ${await bearerToken(d, creds, opts, doFetch)}`, ...d.auth(creds) }
    : d.auth(creds);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await doFetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', ...authHeaders },
    });
    if (!res.ok) {
      // Messages destinés à une conciergerie, pas à un développeur.
      if (res.status === 401 || res.status === 403) throw new Error(`Clé ${d.label} refusée.`);
      if (res.status === 404) {
        throw new Error(d.verified
          ? `${d.label} n'a pas trouvé cette ressource.`
          : `L'adresse de l'API ${d.label} ne répond pas comme prévu. Utilisez le lien de calendrier en attendant.`);
      }
      if (res.status === 429) throw new Error(`${d.label} limite temporairement les appels. Réessayez dans quelques minutes.`);
      throw new Error(`${d.label} a répondu ${res.status}.`);
    }
    return await res.json();
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error(`${d.label} n'a pas répondu à temps.`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Logements aperçus dans les réservations, quand l'endpoint de liste est
 * incomplet. On ne lit QUE les dernières pages : les éditeurs rangent leurs
 * réservations de la plus ancienne à la plus récente, et ce sont les logements
 * actifs aujourd'hui qui nous intéressent — pas ceux abandonnés en 2023.
 * Quatre requêtes au maximum, uniquement pendant le parcours de connexion.
 */
async function discoverFromReservations(
  d: RestPmsDescriptor, creds: PmsCreds, opts: PmsCallOptions, doFetch: FetchLike,
): Promise<Map<string, string>> {
  const extra = d.listings.alsoFromReservations!;
  const out = new Map<string, string>();
  const path = typeof d.reservations.path === 'function' ? d.reservations.path('') : d.reservations.path;
  const size = d.reservations.pagination?.size ?? 100;
  const pageParam = d.reservations.pagination?.pageParam ?? 'page';
  const sizeParam = d.reservations.pagination?.sizeParam;

  const harvest = (rows: Record<string, unknown>[]) => {
    for (const r of rows) {
      const id = readField(r, [extra.idField]);
      if (!id || out.has(id)) continue;
      out.set(id, readField(r, [extra.nameField]) ?? `Logement ${id}`);
    }
  };

  const ask = async (page: number) => {
    const params: Params = { [pageParam]: page };
    if (sizeParam) params[sizeParam] = size;
    const payload = await request(d, buildUrl(d.base, path, params), creds, opts, doFetch);
    harvest(unwrap(payload, d.reservations.collection));
    const total = (payload as { total?: number } | null)?.total;
    return typeof total === 'number' ? total : null;
  };

  try {
    const total = await ask(1);
    const lastPage = total ? Math.ceil(total / size) : 1;
    const pages = extra.recentPages ?? 3;
    for (let p = lastPage; p > lastPage - pages && p > 1; p--) await ask(p);
  } catch (e) {
    // Le complément est un bonus : s'il échoue, la liste de base reste valable.
    console.warn(`découverte des logements ${d.label} :`, (e as Error)?.message);
  }
  return out;
}

/**
 * Rapatrie toutes les pages d'une liste de réservations.
 *
 * Deux garde-fous, parce qu'une boucle de pagination est le meilleur moyen de
 * marteler l'API d'un client : un nombre de pages maximal, et l'arrêt dès qu'une
 * page ne contient rien de nouveau (certains éditeurs ignorent `page` et
 * renvoient éternellement la première).
 */
async function collectPages(
  d: RestPmsDescriptor, path: string, baseParams: Params,
  creds: PmsCreds, opts: PmsCallOptions, doFetch: FetchLike,
): Promise<Record<string, unknown>[]> {
  const pg = d.reservations.pagination;
  if (!pg) {
    const payload = await request(d, buildUrl(d.base, path, baseParams), creds, opts, doFetch);
    return unwrap(payload, d.reservations.collection);
  }

  const size = pg.size ?? 100;
  const maxPages = pg.maxPages ?? 20;
  const all: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  for (let page = 1; page <= maxPages; page++) {
    const params: Params = { ...baseParams, [pg.pageParam]: page };
    if (pg.sizeParam) params[pg.sizeParam] = size;

    const payload = await request(d, buildUrl(d.base, path, params), creds, opts, doFetch);
    const rows = unwrap(payload, d.reservations.collection);
    if (rows.length === 0) break;

    // Rien de neuf sur cette page → l'éditeur ignore la pagination, on s'arrête.
    let fresh = 0;
    for (const r of rows) {
      const key = JSON.stringify(r.id ?? r.uuid ?? r.confirmation_code ?? r);
      if (seen.has(key)) continue;
      seen.add(key);
      all.push(r);
      fresh++;
    }
    if (fresh === 0) break;
    if (rows.length < size) break;   // dernière page
  }
  return all;
}

/**
 * Fabrique les deux fonctions d'un connecteur à partir de sa description.
 * Lève à la construction si la description ne restreint pas à un logement :
 * une erreur de programmation ne doit pas devenir une fuite de données.
 */
export function defineRestPms(d: RestPmsDescriptor): {
  list: (creds: PmsCreds, opts?: PmsCallOptions) => Promise<PmsProperty[]>;
  fetchReservations: (
    creds: PmsCreds, propertyId: string, range: { from: string; to: string }, opts?: PmsCallOptions,
  ) => Promise<ICalEvent[]>;
} {
  if (d.reservations.propertyParam === null && typeof d.reservations.path !== 'function') {
    throw new Error(`Descripteur ${d.id} : aucun filtre par logement (cf. RÈGLE ABSOLUE dans rest.ts).`);
  }

  return {
    async list(creds, opts = {}) {
      const doFetch = opts.fetchImpl ?? fetch;
      const url = buildUrl(d.base, d.listings.path, d.listings.params?.(creds) ?? {});
      const payload = await request(d, url, creds, opts, doFetch);

      const found = new Map<string, string>();
      for (const row of unwrap(payload, d.listings.collection)) {
        const id = readField(row, d.listings.idFields ?? ['id', 'uuid', 'listingId', 'propertyId', 'rentalId']);
        const name = readField(row, d.listings.nameFields ?? ['name', 'title', 'internalName', 'nickname', 'propertyName']);
        if (id) found.set(id, name ?? `Logement ${id}`);
      }

      // Complément : les logements aperçus dans les réservations récentes.
      const extra = d.listings.alsoFromReservations;
      if (extra) {
        for (const [id, name] of await discoverFromReservations(d, creds, opts, doFetch)) {
          if (!found.has(id)) found.set(id, name);
        }
      }

      return [...found].map(([id, name]) => ({ id, name }));
    },

    async fetchReservations(creds, propertyId, range, opts = {}) {
      const doFetch = opts.fetchImpl ?? fetch;
      const path = typeof d.reservations.path === 'function'
        ? d.reservations.path(propertyId)
        : d.reservations.path;

      const params: Params = { ...d.reservations.extra };
      if (d.reservations.propertyParam) params[d.reservations.propertyParam] = propertyId;

      if (d.reservations.fromParam) params[d.reservations.fromParam] = range.from;
      if (d.reservations.toParam) params[d.reservations.toParam] = range.to;

      const rows = await collectPages(d, path, params, creds, opts, doFetch);

      // Garde-fou n°2 : on jette ce qui ne concerne pas NOTRE logement. Un
      // éditeur qui ignore le filtre ne doit pas nous faire lire le reste du
      // compte — ni créer des ménages pour des logements qu'on n'entretient pas.
      const idFields = d.reservations.propertyIdFields;
      const mine = idFields
        ? rows.filter(r => {
            const found = readField(r, idFields);
            return found === undefined || found === String(propertyId);
          })
        : rows;

      const events = toEvents(mine, d.id, d.reservations.fields, d.label);
      // La période est rebornée ici : le nom des paramètres varie, pas la règle.
      return events.filter(e => e.end >= range.from && e.start <= range.to);
    },
  };
}

/** Authentification « Basic » (identifiant + secret), encodée sans dépendance. */
export function basicAuth(user: string, pass: string): Record<string, string> {
  return { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` };
}
