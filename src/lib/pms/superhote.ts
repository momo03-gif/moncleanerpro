// ── Connecteur SuperHote — SERVEUR UNIQUEMENT ────────────────────────────────
//
//  CE QUE LEUR API PERMET VRAIMENT, ET COMMENT ON L'A SU
//  Leur documentation est derrière un espace client, et deux jours d'essais à
//  l'aveugle n'ont rien donné. La réponse était dans le bundle public de leur
//  propre application (`app.superhote.com/static/js/app.*.js`), qui énumère
//  tous les appels qu'elle fait. Si un autre éditeur nous résiste, c'est par là
//  qu'il faudra commencer.
//
//  CE QUI EST FERMÉ : `/rentals`, `/bookings`, `/get-current-bookings` et le
//  reste de l'application s'authentifient par un JETON DE CONNEXION
//  (`Authorization: Bearer <jwt>` obtenu via `/user/login`). Aucune clé que
//  SuperHote délivre à son client ne les ouvre — testé sous toutes les formes.
//  Y accéder supposerait de stocker le mot de passe du client et de passer sa
//  double authentification : hors de question.
//
//  CE QUI EST OUVERT, et qui suffit :
//   · `get-availabilities` (POST, `api_key`) — accepte la « SH apiKey » du
//     client et rend TOUS ses logements, avec leur identifiant `rentalId` ;
//   · `get-not-available-dates` (POST, `rentalId`) — PUBLIC, aucune clé, et
//     rend les périodes occupées d'un logement sous la forme
//     `{startDate, endDate}`. Deux périodes qui se touchent (…→10, 10→…) sont
//     deux séjours qui s'enchaînent : la borne EST la date de départ, donc la
//     date du ménage.
//
//  LIMITE ASSUMÉE : ces périodes ne disent pas si elles sont un séjour vendu ou
//  une date fermée par le propriétaire — même ambiguïté que l'iCal de Booking.
//  Le moteur la traite déjà : la mission naît en `pending`, un faux positif se
//  referme d'un clic, un ménage manqué se découvre par un voyageur.
//
//  NOUVELLE VERSION (« SuperHote V2 », octobre 2026)
//  SuperHote migre ses comptes vers une nouvelle application. Une fois migré,
//  l'ancienne continue de répondre SANS ERREUR… avec des données figées : c'est
//  ainsi que les réservations de Charles&charles ont cessé d'arriver le 08/10.
//  La V2 a une vraie API publique et documentée (docs.superhote.com/api-v2) :
//  `connect.superhote.com/api/v2/public`, jeton « Bearer » créé par le client
//  (Plateformes → API → Créer un token ; lecture seule : rentals.read +
//  reservations.read). Elle donne le STATUT de chaque réservation et n'inclut
//  pas les dates bloquées — fini l'ambiguïté séjour / fermeture.
//  On reconnaît un jeton V2 à sa forme « <numéro>|<secret> » ; une clé V1
//  continue de passer par l'ancien chemin tant qu'un compte n'est pas migré.
//
// ⚠️ Ne jamais importer côté client.

import type { ICalEvent } from '../ical';

const BASE = 'https://app.superhote.com/api/v2';
const BASE_V2 = 'https://connect.superhote.com/api/v2/public';

/** Jeton de la nouvelle API (« 70335|abc… ») — sinon, clé de l'ancienne version. */
export function estJetonV2(cle: string): boolean {
  return /^\d+\|\S+$/.test(cle.trim());
}

async function getV2<T>(jeton: string, chemin: string, essai = 0): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`${BASE_V2}${chemin}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${jeton.trim()}`, Accept: 'application/json' },
    });
    // 120 requêtes par minute et par compte : on attend ce que SuperHote demande.
    if (res.status === 429 && essai < 2) {
      const attente = Math.min(30, Number(res.headers.get('retry-after')) || 10);
      await new Promise(r => setTimeout(r, attente * 1000));
      return getV2<T>(jeton, chemin, essai + 1);
    }
    const texte = await res.text();
    if (res.status === 401) throw new Error('Jeton SuperHote refusé (supprimé ou mal copié).');
    if (res.status === 403) {
      throw new Error('Ce jeton SuperHote n’a pas les droits nécessaires. Dans SuperHote : Plateformes → API, '
        + 'créer un jeton avec la lecture des logements (rentals.read) et des réservations (reservations.read).');
    }
    if (!res.ok) throw new Error(`SuperHote a répondu ${res.status}${detail(texte)}`);
    try { return JSON.parse(texte) as T; }
    catch { throw new Error('SuperHote a renvoyé une réponse illisible.'); }
  } finally {
    clearTimeout(timer);
  }
}

interface PageV2<K extends string, T> {
  result?: { [k in K]?: T[] } & { meta?: { current_page?: number; last_page?: number } };
}

async function toutesLesPagesV2<T>(jeton: string, chemin: string, cle: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 50; page++) {
    const sep = chemin.includes('?') ? '&' : '?';
    const r = await getV2<PageV2<string, T>>(jeton, `${chemin}${sep}per_page=100&page=${page}`);
    const res = r.result as Record<string, unknown> | undefined;
    out.push(...((res?.[cle] as T[] | undefined) ?? []));
    const meta = (res?.meta ?? {}) as { current_page?: number; last_page?: number };
    if (!meta.last_page || (meta.current_page ?? page) >= meta.last_page) break;
  }
  return out;
}

/**
 * Statut V2 → statut d'évènement. Seul un séjour CONFIRMÉ crée un ménage ; une
 * annulation (hôte ou voyageur) l'annule ; une demande, une pré-approbation, un
 * séjour non confirmé ou un voyageur absent restent en attente — sans ménage.
 */
export function statutV2(status: number | undefined): 'CONFIRMED' | 'CANCELLED' | 'TENTATIVE' {
  if (status === 1) return 'CONFIRMED';
  if (status === 0 || status === 5) return 'CANCELLED';
  return 'TENTATIVE';
}

export interface SuperhoteCredentials {
  /** « SH apiKey », dans Paramètres Utilisateur du compte SuperHote. */
  apiKey: string;
  apiSecret?: string;   // inutilisé — même forme que les autres connecteurs
}

/**
 * Le message de SuperHote, extrait de sa réponse d'erreur.
 *
 * Il l'écrit en clair (`{"msg":{"api_key":["The selected api key is invalid."]}}`)
 * et c'est exactement ce que l'exploitant a besoin de lire : « 400 » tout seul
 * l'envoie chercher pendant une heure ce qu'une phrase lui aurait dit.
 */
function detail(texte: string): string {
  try {
    const msg = (JSON.parse(texte) as { msg?: unknown }).msg;
    if (typeof msg === 'string') return ` — ${msg}`;
    if (msg && typeof msg === 'object') {
      const lignes = Object.values(msg as Record<string, unknown>)
        .flatMap(v => (Array.isArray(v) ? v : [v]))
        .filter(v => typeof v === 'string');
      if (lignes.length) return ` — ${lignes.join(' ')}`;
    }
  } catch { /* pas du JSON : on s'en tient au code */ }
  return '.';
}

async function post<T>(chemin: string, corps: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${BASE}${chemin}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(corps),
    });
    // SuperHote explique ses refus dans le corps de la réponse — « The selected
    // api key is invalid », par exemple. Ne rendre que le code HTTP oblige à
    // deviner ce qui, chez eux, est écrit noir sur blanc.
    const texte = await res.text();
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error('Clé SuperHote refusée.');
      throw new Error(`SuperHote a répondu ${res.status}${detail(texte)}`);
    }
    try { return JSON.parse(texte) as T; }
    catch { throw new Error('SuperHote a renvoyé une réponse illisible.'); }
  } finally {
    clearTimeout(timer);
  }
}

const jour = (d: Date) => d.toISOString().slice(0, 10);

export interface SuperhoteProperty { id: string; name: string }

/**
 * Logements du compte.
 *
 * `get-availabilities` est le seul endpoint que la clé du client ouvre. Il
 * répond pour une période et rend TOUS les logements du compte : on s'en sert
 * comme annuaire, la disponibilité elle-même ne nous intéresse pas ici.
 *
 * ⚠️ SuperHote ne donne PAS le nom des logements sur cet endpoint — il ne
 * rend que des identifiants. On les présente donc tels quels : l'exploitant
 * retrouve le bon numéro dans l'URL du logement chez SuperHote. Inventer un
 * nom serait pire que d'afficher un numéro assumé.
 */
export async function listSuperhoteProperties(
  creds: SuperhoteCredentials,
): Promise<SuperhoteProperty[]> {
  if (estJetonV2(creds.apiKey)) {
    const logements = await toutesLesPagesV2<{ id?: number; name?: string; enabled?: boolean }>(creds.apiKey, '/rentals', 'rentals');
    return logements
      .filter(l => l.id != null && l.enabled !== false)
      .map(l => ({ id: String(l.id), name: (l.name ?? '').trim() || `Logement SuperHote nº ${l.id}` }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }
  const demain = new Date(Date.now() + 86400000);
  const apres = new Date(Date.now() + 3 * 86400000);

  const data = await post<{ status?: string; restrictions?: Record<string, { rentalId?: number }> }>(
    '/get-availabilities',
    { api_key: creds.apiKey, start_date: jour(demain), end_date: jour(apres), nbr_adults: 1, nbr_children: 0 },
  );

  if (data.status === 'error') {
    throw new Error('SuperHote a refusé cette clé. Vérifiez qu’il s’agit bien de la '
      + '« SH apiKey » (Paramètres Utilisateur) et non de la « Website key », '
      + 'et qu’elle n’a pas été régénérée depuis.');
  }

  const restrictions = data.restrictions ?? {};
  const ids = Object.keys(restrictions);
  if (ids.length === 0) {
    throw new Error('SuperHote n’a rendu aucun logement pour cette clé. Vérifiez la SH apiKey '
      + '(Paramètres Utilisateur) : une clé régénérée rend l’ancienne inutilisable.');
  }

  return ids
    .map(id => ({ id: String(restrictions[id]?.rentalId ?? id), name: `Logement SuperHote nº ${id}` }))
    .sort((a, b) => Number(a.id) - Number(b.id));
}

/** Une période pendant laquelle le logement n'est pas disponible. */
interface Periode { startDate?: string; endDate?: string }

// CE QUI N'EST PAS UN SÉJOUR, ET COMMENT ON LE RECONNAÎT.
//
// 39 logements sur 75, sur un vrai compte, portent une période
// « 2010-01-01 → aujourd'hui » : c'est ainsi que SuperHote marque un bien
// inactif. Prise pour un séjour, elle créerait trente-neuf ménages fantômes le
// même jour.
//
// On les reconnaît à leur DATE DE DÉBUT, pas à leur durée. Un premier seuil
// écartait tout ce qui dépassait 90 nuits — il aurait jeté une vraie location
// de 139 nuits (14 septembre → 31 janvier) et, avec elle, le ménage de fin de
// bail, qui est le plus gros de l'année. Une longue location est un séjour
// comme un autre : quelqu'un en part, il faut y passer.
//
// Reste un garde-fou de durée, mais très large : au-delà de deux ans, aucune
// location saisonnière n'a de sens, et c'est forcément une fermeture.
const DEBUT_ABERRANT = '2015-01-01';
const NUITS_MAX_SEJOUR = 730;

const nuitsEntre = (debut: string, fin: string) =>
  Math.round((Date.parse(fin) - Date.parse(debut)) / 86400000);

/**
 * Périodes occupées d'un logement, converties en séjours.
 *
 * `get-not-available-dates` est PUBLIC : il ne demande que le `rentalId`. On
 * n'envoie donc aucune clé — il n'y a rien à protéger ici, et moins un appel
 * porte de secret, mieux c'est.
 *
 * Deux périodes qui se touchent décrivent deux séjours qui s'enchaînent : on
 * les garde SÉPARÉES, surtout pas fusionnées. C'est leur frontière commune qui
 * porte le changement de voyageur, et donc le ménage.
 */
export async function fetchSuperhoteReservations(
  _creds: SuperhoteCredentials,
  propertyId: string,
  range: { from: string; to: string },
): Promise<ICalEvent[]> {
  if (estJetonV2(_creds.apiKey)) return fetchSuperhoteV2(_creds.apiKey, propertyId, range);
  const rentalId = Number(propertyId);
  if (!Number.isFinite(rentalId)) {
    throw new Error(`Identifiant de logement SuperHote invalide : « ${propertyId} ».`);
  }

  const data = await post<{ dates?: Periode[] }>('/get-not-available-dates', { rentalId });

  return (data.dates ?? [])
    .filter((p): p is Required<Periode> => !!p.startDate && !!p.endDate && p.endDate > p.startDate)
    // Une fermeture n'est pas un séjour : personne n'en part, donc aucun ménage.
    .filter(p => p.startDate >= DEBUT_ABERRANT && nuitsEntre(p.startDate, p.endDate) <= NUITS_MAX_SEJOUR)
    // L'horizon est borné ici : leur réponse couvre parfois plusieurs années.
    .filter(p => p.endDate >= range.from && p.startDate <= range.to)
    .map(p => ({
      // L'identifiant doit être stable d'une synchro à l'autre, sans quoi le
      // même séjour serait réimporté comme un nouveau à chaque passage.
      uid: `superhote-${rentalId}-${p.startDate}-${p.endDate}`,
      status: 'CONFIRMED' as const,
      // SuperHote ne dit pas s'il s'agit d'un séjour vendu ou d'une date fermée
      // par le propriétaire. On ne prétend donc pas connaître un voyageur.
      summary: 'Séjour SuperHote',
      start: p.startDate,
      end: p.endDate,
    }));
}

/**
 * Séjours d'un logement par la nouvelle API. On ne garde QUE les dates et le
 * statut : nom, e-mail et téléphone du voyageur ne sont jamais recopiés.
 */
async function fetchSuperhoteV2(jeton: string, propertyId: string, range: { from: string; to: string }): Promise<ICalEvent[]> {
  const rentalId = Number(propertyId);
  if (!Number.isFinite(rentalId)) throw new Error(`Identifiant de logement SuperHote invalide : « ${propertyId} ».`);
  const resas = await toutesLesPagesV2<{ id?: number; rental_id?: number; checkin?: string; checkout?: string; status?: number }>(
    jeton, `/reservations?rental_id=${rentalId}&checkout_from=${range.from}&checkin_to=${range.to}`, 'reservations');
  return resas
    // Ceinture et bretelles : on revérifie le logement, au cas où le filtre serait ignoré.
    .filter(r => r.id != null && r.rental_id === rentalId && !!r.checkin && !!r.checkout && r.checkout > r.checkin)
    .map(r => ({
      // Identifiant stable d'une synchro à l'autre (cf. migration V1 → V2).
      uid: `superhote-v2-${r.id}`,
      status: statutV2(r.status),
      summary: 'Séjour SuperHote',
      start: r.checkin!.slice(0, 10),
      end: r.checkout!.slice(0, 10),
    }));
}
