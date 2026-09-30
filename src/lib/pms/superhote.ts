// ── Connecteur SuperHote — SERVEUR UNIQUEMENT ────────────────────────────────
//
// ⚠️ FORME NON CONFIRMÉE. La documentation de SuperHote est derrière leur espace
// client : on ne connaît ni l'adresse exacte de leur API de lecture, ni la façon
// dont elle authentifie. Ce qu'on sait tient en trois points :
//
//  · leur moteur de réservation s'appelle en POST sur `app.superhote.com/api/v2`
//    avec la clé dans le CORPS (`api_key`), plus une `property_key` ;
//  · la clé délivrée au client s'appelle « SH apiKey », ce qui désigne un
//    EN-TÊTE (`SH-APIKEY`) et donc, très probablement, une SECONDE API ;
//  · huit chemins de lecture essayés en POST/corps répondent 404.
//
// On ne peut donc pas parier sur une combinaison. Le connecteur SONDE : il
// essaie des couples (adresse, authentification) plausibles sur un chemin de
// liste, retient le premier qui répond, et s'en sert ensuite. C'est la méthode
// qui a fini par débloquer Lodgify — et elle dit toujours ce qu'elle a trouvé,
// pour qu'on fige la bonne combinaison au lieu de la redécouvrir à chaque appel.
//
// ⚠️ Ne jamais importer côté client.

import { toEvents, type FieldNames } from './normalize';
import type { ICalEvent } from '../ical';

/** Une façon de parler à SuperHote : où, et comment on s'annonce. */
interface Acces {
  nom: string;
  base: string;
  /** En-têtes d'authentification. */
  entetes?: (c: Cles) => Record<string, string>;
  /** Paramètres d'authentification en query (GET) ou dans le corps (POST). */
  params?: (c: Cles) => Record<string, string>;
  methode: 'GET' | 'POST';
}

/** Les deux clés que SuperHote affiche côte à côte dans Paramètres Utilisateur. */
export interface Cles { apiKey: string; websiteKey?: string }

const APP = 'https://app.superhote.com/api/v2';
const APP1 = 'https://app.superhote.com/api';
const API = 'https://api.superhote.com';

// Par ordre de probabilité. L'en-tête d'abord — c'est ce que « SH apiKey »
// annonce. Puis la clé en query, puis le COUPLE de clés : SuperHote en délivre
// deux, et rien ne dit que la lecture s'ouvre avec une seule. La clé dans le
// corps vient en dernier : c'est la forme du moteur de vente, dont on sait
// qu'elle ne lit pas.
const ACCES: Acces[] = [
  { nom: 'app/api/v2 · en-tête SH-APIKEY', base: APP, methode: 'GET', entetes: c => ({ 'SH-APIKEY': c.apiKey }) },
  { nom: 'app/api · en-tête SH-APIKEY', base: APP1, methode: 'GET', entetes: c => ({ 'SH-APIKEY': c.apiKey }) },
  { nom: 'api.superhote · en-tête SH-APIKEY', base: API, methode: 'GET', entetes: c => ({ 'SH-APIKEY': c.apiKey }) },
  { nom: 'app/api/v2 · en-tête apikey', base: APP, methode: 'GET', entetes: c => ({ apikey: c.apiKey }) },
  { nom: 'app/api/v2 · Bearer', base: APP, methode: 'GET', entetes: c => ({ Authorization: `Bearer ${c.apiKey}` }) },
  { nom: 'app/api/v2 · Authorization brut', base: APP, methode: 'GET', entetes: c => ({ Authorization: c.apiKey }) },
  { nom: 'app/api/v2 · X-API-KEY', base: APP, methode: 'GET', entetes: c => ({ 'X-API-KEY': c.apiKey }) },
  { nom: 'app/api/v2 · clé en query', base: APP, methode: 'GET', params: c => ({ api_key: c.apiKey }) },
  { nom: 'app/api/v2 · couple de clés en query', base: APP, methode: 'GET',
    params: c => ({ api_key: c.apiKey, ...(c.websiteKey ? { website_key: c.websiteKey } : {}) }) },
  // Les endpoints du moteur de réservation s'adressent à un SITE, pas à un
  // compte : c'est la Website key qu'ils attendent, seule.
  { nom: 'app/api/v2 · website_key seule (GET)', base: APP, methode: 'GET',
    params: (c): Record<string, string> => (c.websiteKey ? { website_key: c.websiteKey } : { api_key: c.apiKey }) },
  { nom: 'app/api/v2 · website_key seule (POST)', base: APP, methode: 'POST',
    params: (c): Record<string, string> => (c.websiteKey ? { website_key: c.websiteKey } : { api_key: c.apiKey }) },
  { nom: 'app/api/v2 · couple de clés (POST)', base: APP, methode: 'POST',
    params: c => ({ api_key: c.apiKey, ...(c.websiteKey ? { website_key: c.websiteKey } : {}) }) },
  { nom: 'app/api/v2 · clé dans le corps (POST)', base: APP, methode: 'POST', params: c => ({ api_key: c.apiKey }) },
];

// Le lien du moteur de réservation d'un client se lit
// `app.superhote.com/#/get-available-rentals/…`. Une page qui affiche des
// logements doit bien les LISTER quelque part : ce nom de route est donc le
// meilleur indice qu'on ait sur l'endpoint correspondant, et il vient de
// SuperHote lui-même plutôt que de nos suppositions. On le met en tête.
const CHEMINS_LOGEMENTS = [
  '/get-available-rentals', '/get-rentals', '/available-rentals',
  '/properties', '/get-properties', '/rentals', '/listings', '/accommodations',
];
const CHEMINS_RESERVATIONS = ['/reservations', '/get-reservations', '/bookings', '/get-bookings'];

export interface SuperhoteCredentials {
  apiKey: string;
  apiSecret?: string;   // inutilisé — même forme que les autres connecteurs
}

// Noms de champs tolérants : SuperHote mélange l'anglais et le français, et
// `normalize` REFUSE une ligne plutôt que de deviner une date.
const SUPERHOTE_FIELDS: FieldNames = {
  id: ['id', 'reservation_id', 'booking_id', 'key', 'reservation_key', 'reference'],
  arrival: ['start_date', 'checkin', 'check_in', 'arrival', 'date_arrivee', 'arrival_date', 'date_debut'],
  departure: ['end_date', 'checkout', 'check_out', 'departure', 'date_depart', 'departure_date', 'date_fin'],
  arrivalTime: ['checkin_time', 'check_in_time', 'arrival_time', 'heure_arrivee'],
  departureTime: ['checkout_time', 'check_out_time', 'departure_time', 'heure_depart'],
  status: ['status', 'statut', 'state'],
};

/** Un appel, dans le style de l'accès demandé. */
async function appel(
  acces: Acces,
  chemin: string,
  cles: Cles,
  filtres: Record<string, string | undefined>,
): Promise<unknown> {
  const controller = new AbortController();
  // Court : une sonde enchaîne des tentatives, un timeout long rendrait l'écran
  // de connexion insupportable.
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const propres = Object.entries({ ...(acces.params?.(cles) ?? {}), ...filtres })
      .filter(([, v]) => v !== undefined && v !== '') as [string, string][];
    const entetes = { ...(acces.entetes?.(cles) ?? {}), Accept: 'application/json' };

    if (acces.methode === 'GET') {
      const query = propres.length ? '?' + new URLSearchParams(propres).toString() : '';
      return await lire(await fetch(`${acces.base}${chemin}${query}`, {
        method: 'GET', signal: controller.signal, headers: entetes,
      }));
    }

    return await lire(await fetch(`${acces.base}${chemin}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { ...entetes, 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(propres)),
    }));
  } finally {
    clearTimeout(timer);
  }
}

async function lire(res: Response): Promise<unknown> {
  if (!res.ok) {
    const err = new Error(`SuperHote a répondu ${res.status}.`) as Error & { httpStatus?: number };
    err.httpStatus = res.status;
    throw err;
  }
  return res.json();
}

/** Les listes arrivent tantôt à plat, tantôt enveloppées. */
function unwrap(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const obj = payload as Record<string, unknown> | null;
  for (const cle of ['data', 'items', 'results', 'properties', 'rentals', 'listings',
    'logements', 'reservations', 'bookings']) {
    const v = obj?.[cle];
    if (Array.isArray(v)) return v as Record<string, unknown>[];
  }
  return [];
}

// L'accès qui a marché, gardé le temps du processus : la sonde n'a de sens
// qu'une fois. Sans ce cache, chaque synchro recommencerait tout le balayage.
let accesRetenu: Acces | null = null;

/**
 * Trouve une combinaison qui répond, EN DEUX TEMPS.
 *
 * Croiser onze façons de s'authentifier avec cinq chemins ferait cinquante-cinq
 * appels à chaque connexion — plusieurs minutes d'attente si les adresses ne
 * répondent pas. On cherche donc d'abord l'AUTHENTIFICATION sur un seul chemin,
 * puis on n'essaie les autres chemins qu'avec celle qui a mordu.
 *
 * Un 401/403 est un renseignement, pas un échec : il prouve que l'adresse
 * existe et que seule la clé manque. Une adresse qui ne répond rien du tout n'a
 * rien appris. Le message final distingue les deux — ce ne sont pas les mêmes
 * suites.
 */
async function sonder(
  cles: Cles,
  chemins: string[],
  filtres: Record<string, string | undefined>,
): Promise<{ acces: Acces; chemin: string; lignes: Record<string, unknown>[] }> {
  const ordre = accesRetenu ? [accesRetenu, ...ACCES.filter(a => a !== accesRetenu)] : ACCES;
  let refusee = false;
  const existantes: Acces[] = [];

  // ── 1. Quelle authentification est acceptée ? ─────────────────────────────
  for (const acces of ordre) {
    try {
      const lignes = unwrap(await appel(acces, chemins[0], cles, filtres));
      if (lignes.length > 0) { accesRetenu = acces; return { acces, chemin: chemins[0], lignes }; }
      // Répond 200 mais rien à cet endroit : l'accès est bon, le chemin non.
      existantes.push(acces);
    } catch (e) {
      const code = (e as { httpStatus?: number }).httpStatus;
      if (code === 401 || code === 403) { refusee = true; continue; }
      // 404/400/405 : l'adresse existe peut-être, mais pas ce chemin. On la
      // garde pour le second temps.
      if (code !== undefined) existantes.push(acces);
    }
  }

  // ── 2. Les autres chemins, avec les accès qui ont répondu ─────────────────
  for (const acces of existantes) {
    for (const chemin of chemins.slice(1)) {
      try {
        const lignes = unwrap(await appel(acces, chemin, cles, filtres));
        if (lignes.length > 0) { accesRetenu = acces; return { acces, chemin, lignes }; }
      } catch { /* chemin suivant */ }
    }
  }

  throw new Error(refusee
    ? 'SuperHote a refusé cette clé. Vérifiez qu’il s’agit bien de la SH apiKey à jour '
      + '(Paramètres Utilisateur) : si elle a été régénérée, l’ancienne ne vaut plus rien. '
      + 'Si elle est à jour, c’est que cette clé n’ouvre pas la lecture du planning — '
      + 'il faut alors demander à SuperHote un accès en lecture pour ce compte.'
    : 'Aucune adresse de lecture SuperHote n’a répondu avec cette clé.');
}

export interface SuperhoteProperty { id: string; name: string }

/** Logements du compte — sert à relier « notre » logement au sien. */
export async function listSuperhoteProperties(
  creds: SuperhoteCredentials,
): Promise<SuperhoteProperty[]> {
  const { lignes } = await sonder(
    { apiKey: creds.apiKey, websiteKey: creds.apiSecret }, CHEMINS_LOGEMENTS, {},
  );
  return lignes
    .map(p => ({
      // `property_key` est l'identifiant que SuperHote emploie dans ses propres
      // appels : c'est lui qu'il faut conserver, pas un id interne.
      id: String(p.property_key ?? p.key ?? p.id ?? ''),
      name: String(p.name ?? p.title ?? p.nom ?? p.label ?? `Logement ${p.id ?? ''}`).trim(),
    }))
    .filter(p => p.id !== '');
}

/** Réservations d'un logement sur la période. */
export async function fetchSuperhoteReservations(
  creds: SuperhoteCredentials,
  propertyId: string,
  range: { from: string; to: string },
): Promise<ICalEvent[]> {
  const { lignes } = await sonder(
    { apiKey: creds.apiKey, websiteKey: creds.apiSecret },
    CHEMINS_RESERVATIONS,
    { property_key: propertyId, start_date: range.from, end_date: range.to },
  );

  // Filets locaux : rien ne garantit que les filtres soient honorés, et importer
  // les séjours d'un autre bien les collerait tous sur celui-ci.
  const attendu = String(propertyId);
  const sien = lignes.filter(r => {
    const k = r.property_key ?? r.property_id ?? r.logement_id;
    return k === undefined || String(k) === attendu;
  });

  const events = toEvents(sien, 'superhote', SUPERHOTE_FIELDS, 'SuperHote');
  return events.filter(e => e.end >= range.from && e.start <= range.to);
}

/** Ce que chaque combinaison a répondu — pour figer la bonne, ou renoncer. */
export async function diagnoseSuperhote(creds: SuperhoteCredentials): Promise<{
  acces: string; statut: number | 'ok'; lignes: number;
}[]> {
  const cles: Cles = { apiKey: creds.apiKey, websiteKey: creds.apiSecret };
  const out: { acces: string; statut: number | 'ok'; lignes: number }[] = [];
  for (const acces of ACCES) {
    try {
      const lignes = unwrap(await appel(acces, CHEMINS_LOGEMENTS[0], cles, {}));
      out.push({ acces: acces.nom, statut: 'ok', lignes: lignes.length });
    } catch (e) {
      out.push({ acces: acces.nom, statut: (e as { httpStatus?: number }).httpStatus ?? 0, lignes: 0 });
    }
  }
  return out;
}
