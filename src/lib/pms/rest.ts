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
  };

  reservations: {
    /** Chemin, ou fonction quand l'identifiant du logement est dans l'URL. */
    path: string | ((propertyId: string) => string);
    /**
     * Nom du paramètre qui restreint au logement. `null` UNIQUEMENT quand le
     * chemin porte déjà l'identifiant (cf. règle absolue plus haut).
     */
    propertyParam: string | null;
    /** Noms des paramètres de période. */
    fromParam: string;
    toParam: string;
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
      return unwrap(payload, d.listings.collection)
        .map(row => {
          const id = readField(row, d.listings.idFields ?? ['id', 'uuid', 'listingId', 'propertyId', 'rentalId']);
          const name = readField(row, d.listings.nameFields ?? ['name', 'title', 'internalName', 'nickname', 'propertyName']);
          return id ? { id, name: name ?? `Logement ${id}` } : null;
        })
        .filter((p): p is PmsProperty => p !== null);
    },

    async fetchReservations(creds, propertyId, range, opts = {}) {
      const doFetch = opts.fetchImpl ?? fetch;
      const path = typeof d.reservations.path === 'function'
        ? d.reservations.path(propertyId)
        : d.reservations.path;

      const params: Params = {
        ...d.reservations.extra,
        [d.reservations.fromParam]: range.from,
        [d.reservations.toParam]: range.to,
      };
      if (d.reservations.propertyParam) params[d.reservations.propertyParam] = propertyId;

      const payload = await request(d, buildUrl(d.base, path, params), creds, opts, doFetch);
      const rows = unwrap(payload, d.reservations.collection);

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
