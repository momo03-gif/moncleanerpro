// ── Connecteur Lodgify — SERVEUR UNIQUEMENT ───────────────────────────────────
//
// Authentification simple et publiquement documentée : un en-tête `X-ApiKey`,
// la clé se trouvant dans Paramètres → Public API du compte de la conciergerie.
//
// Lodgify fait cohabiter une v1 et une v2 (cette dernière en cours de
// déploiement). On interroge la v2 et, si elle n'est pas disponible sur le
// compte, on retombe sur la v1 : la conciergerie n'a pas à savoir laquelle elle a.
//
// Le nom exact des champs n'est pas publié : lecture via normalize.ts, qui
// accepte les variantes et REFUSE plutôt que de deviner une date.
//
// ⚠️ Ne jamais importer côté client.

import { toEvents, type FieldNames } from './normalize';
import type { ICalEvent } from '../ical';

const BASE = 'https://api.lodgify.com';

export interface LodgifyCredentials {
  /** Clé publique du compte (Paramètres → Public API). */
  apiKey: string;
  apiSecret?: string;   // inutilisé — même forme que les autres connecteurs
}

// `is_unavailable` est ce que l'iCal de Booking ne dit jamais : Lodgify, lui,
// distingue un séjour vendu d'une simple fermeture de calendrier. On le lit
// comme un statut, ce qui évite de créer un ménage pour une date bloquée.
const LODGIFY_FIELDS: FieldNames = {
  id: ['id', 'bookingId'],
  arrival: ['arrival', 'date_arrival', 'arrivalDate', 'checkIn'],
  departure: ['departure', 'date_departure', 'departureDate', 'checkOut'],
  arrivalTime: ['arrivalTime', 'checkInTime', 'time_arrival'],
  departureTime: ['departureTime', 'checkOutTime', 'time_departure'],
  status: ['status'],
};

async function get<T>(path: string, apiKey: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]),
  ).toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${BASE}${path}${query ? `?${query}` : ''}`, {
      signal: controller.signal,
      headers: { 'X-ApiKey': apiKey, Accept: 'application/json' },
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error('Clé Lodgify refusée.');
      if (res.status === 404) throw new Error('NOT_FOUND');   // signal interne : bascule v2 → v1
      // Le code voyage avec l'erreur : un 400 signifie « ces paramètres-là ne
      // conviennent pas », et l'appelant peut alors réessayer autrement plutôt
      // que d'abandonner la synchronisation du logement.
      const err = new Error(`Lodgify a répondu ${res.status}.`) as Error & { httpStatus?: number };
      err.httpStatus = res.status;
      throw err;
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Essaie la v2, retombe sur la v1 si le compte ne l'a pas encore. */
async function getWithFallback<T>(
  v2Path: string, v1Path: string, apiKey: string, params: Record<string, string | number | undefined> = {},
): Promise<T> {
  try {
    return await get<T>(v2Path, apiKey, params);
  } catch (e) {
    if ((e as Error)?.message !== 'NOT_FOUND') throw e;
    return get<T>(v1Path, apiKey, params);
  }
}

/** Les listes de Lodgify arrivent tantôt à plat, tantôt enveloppées. */
function unwrap(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const obj = payload as Record<string, unknown> | null;
  for (const key of ['items', 'data', 'results', 'bookings', 'properties']) {
    const v = obj?.[key];
    if (Array.isArray(v)) return v as Record<string, unknown>[];
  }
  return [];
}

export interface LodgifyProperty { id: number; name: string }

/** Propriétés du compte — sert à relier « notre » logement au sien. */
export async function listLodgifyProperties(creds: LodgifyCredentials): Promise<LodgifyProperty[]> {
  const data = await getWithFallback<unknown>('/v2/properties', '/v1/properties', creds.apiKey, { size: 200 });
  return unwrap(data).map(p => ({
    id: Number(p.id),
    name: String(p.name ?? p.title ?? `Logement ${p.id}`),
  })).filter(p => Number.isFinite(p.id));
}

/**
 * Lodgify porte l'indisponibilité dans un BOOLÉEN (`is_unavailable`), là où la
 * normalisation ne sait lire qu'un statut texte. On traduit.
 *
 * C'est ce que l'iCal de Booking ne dit jamais : une ligne fermée y ressemble
 * trait pour trait à un séjour vendu. Passer par le logiciel de la conciergerie
 * rend cette distinction — et donc évite de planifier un ménage pour une date
 * que le propriétaire s'est simplement réservée.
 */
function marquerBlocage(row: Record<string, unknown>): Record<string, unknown> {
  return row.is_unavailable === true ? { ...row, status: 'blocked' } : row;
}

// Lodgify plafonne une page à 100 lignes, quoi qu'on demande.
const PAGE = 100;
const PAGES_MAX = 10;   // 1 000 séjours sur 90 jours : au-delà, ce n'est plus un logement

/**
 * Réservations d'une propriété sur la période.
 *
 * `stayFilter` COMMANDE TOUT. Avec « All », Lodgify ignore `periodStart` et
 * `periodEnd` et rend la première page de tout l'historique du compte : on
 * recevait 100 lignes dont 99 passées, aucune réservation à venir, et pas la
 * moindre erreur pour le signaler. On filtre donc sur la DATE DE DÉPART —
 * c'est elle qui déclenche un ménage, et elle retient aussi les séjours en
 * cours, qu'un filtre « à venir » laisserait de côté.
 *
 * Et on pagine : la première page ne suffit pas dès qu'un compte a de l'espace.
 */
export async function fetchLodgifyReservations(
  creds: LodgifyCredentials,
  propertyId: string,
  range: { from: string; to: string },
): Promise<ICalEvent[]> {
  // Deux façons de demander, essayées dans cet ordre. La première laisse
  // Lodgify filtrer sur la date de départ — c'est la bonne, quand le compte
  // l'accepte. La seconde ramène tout et nous filtrons nous-mêmes : plus
  // d'appels, mais elle passe partout. Sans ce repli, un compte qui refuse le
  // filtre précis se retrouvait sans aucune réservation.
  // La DERNIÈRE est l'appel exactement tel qu'il fonctionnait avant qu'on
  // cherche mieux : sans `page`, avec les bornes, `size` à 200. Un repli doit
  // finir par quelque chose de connu — sinon « on essaie autre chose » veut
  // seulement dire « on échoue autrement ».
  const TENTATIVES: Record<string, string | number | undefined>[] = [
    { stayFilter: 'DepartureDate', periodStart: range.from, periodEnd: range.to, page: 1, size: PAGE },
    { stayFilter: 'All', page: 1, size: PAGE },
    { stayFilter: 'All', periodStart: range.from, periodEnd: range.to, size: 200 },
  ];

  let rows: Record<string, unknown>[] = [];
  let derniere: Error | null = null;
  for (const filtre of TENTATIVES) {
    try {
      const lues: Record<string, unknown>[] = [];
      // On ne pagine que si la variante accepte `page` : sur celle qui n'en
      // veut pas, insister ne ferait que répéter la première page.
      const paginable = filtre.page !== undefined;
      for (let page = 1; page <= (paginable ? PAGES_MAX : 1); page++) {
        const data = await getWithFallback<unknown>(
          '/v2/reservations/bookings', '/v1/reservation', creds.apiKey,
          { propertyId, ...filtre, ...(paginable ? { page } : {}) },
        );
        const lot = unwrap(data);
        lues.push(...lot);
        if (lot.length < PAGE) break;
      }
      rows = lues;
      derniere = null;
      break;
    } catch (e) {
      // Un 400 dit « pas ces paramètres-là » : on tente la variante suivante.
      // Toute autre erreur (clé refusée, panne) doit remonter telle quelle.
      if ((e as { httpStatus?: number }).httpStatus !== 400) throw e;
      derniere = e as Error;
    }
  }
  if (derniere) throw derniere;

  // Filet local sur le logement : le filtre `propertyId` n'est pas garanti
  // d'une version à l'autre, et importer les séjours d'un autre bien les
  // collerait tous sur celui-ci.
  const attendu = String(propertyId);
  const duLogement = attendu
    ? rows.filter(r => r.property_id === undefined || String(r.property_id) === attendu)
    : rows;

  const events = toEvents(duLogement.map(marquerBlocage), 'lodgify', LODGIFY_FIELDS, 'Lodgify');
  // Filet local sur la période, pour la même raison.
  return events.filter(e => e.end >= range.from && e.start <= range.to);
}

/**
 * Ce que Lodgify a RÉPONDU, sans interprétation — pour diagnostic.
 *
 * Une synchro qui remonte zéro réservation sans erreur a trois causes
 * possibles, et rien ne permettait de les distinguer : la requête part sur la
 * mauvaise version d'API, Lodgify renvoie une enveloppe que `unwrap` ne
 * reconnaît pas, ou le filtre de période ne mord pas. On relit donc la réponse
 * brute et on rend de quoi trancher.
 *
 * CE QU'ON NE REND PAS : les valeurs. Une réservation porte le nom et le
 * contact du voyageur de notre client. On rend le NOMBRE de lignes et le NOM
 * des champs de la première — de quoi comprendre la forme, rien sur les gens.
 */
export interface SondeLodgify {
  variante: string;
  statut: number | 'ok';
  lignes: number;
  duLogement: number;
  evenements: number;
  dansPeriode: number;
  champs: string[];
}

/**
 * Essaie plusieurs façons de demander, et rend ce que chacune a donné.
 *
 * La documentation d'un éditeur décrit rarement ce que son API fait vraiment :
 * « All » ignore silencieusement les bornes de période, « DepartureDate » est
 * refusé par certains comptes. Plutôt que d'alterner les hypothèses à chaque
 * échec, on les essaie toutes une fois et on lit le résultat.
 *
 * CE QU'ON NE REND PAS : les valeurs. Une réservation porte le nom et le
 * contact du voyageur de notre client. On rend des COMPTES et le NOM des
 * champs — de quoi comprendre la forme, rien sur les gens.
 */
export async function diagnoseLodgify(
  creds: LodgifyCredentials,
  propertyId: string,
  range: { from: string; to: string },
): Promise<SondeLodgify[]> {
  // Le TÉMOIN d'abord : l'appel dont on sait qu'il répondait. S'il échoue lui
  // aussi, le problème n'est pas le filtre mais le compte ou la clé — et sans
  // lui on conclurait à tort que telle ou telle variante est en cause.
  const VARIANTES: { nom: string; params: Record<string, string | number | undefined> }[] = [
    { nom: 'TÉMOIN All + période, sans page', params: { stayFilter: 'All', periodStart: range.from, periodEnd: range.to, size: 200 } },
    { nom: 'All + page', params: { stayFilter: 'All', page: 1, size: PAGE } },
    { nom: 'DepartureDate + période', params: { stayFilter: 'DepartureDate', periodStart: range.from, periodEnd: range.to, size: PAGE } },
    { nom: 'ArrivalDate + période', params: { stayFilter: 'ArrivalDate', periodStart: range.from, periodEnd: range.to, size: PAGE } },
    { nom: 'Upcoming', params: { stayFilter: 'Upcoming', size: PAGE } },
  ];

  const out: SondeLodgify[] = [];
  const attendu = String(propertyId);

  for (const v of VARIANTES) {
    try {
      const data = await get<unknown>('/v2/reservations/bookings', creds.apiKey, {
        propertyId, ...v.params,
      });
      const rows = unwrap(data);
      const duLogement = attendu
        ? rows.filter(r => r.property_id === undefined || String(r.property_id) === attendu)
        : rows;
      let evenements: ICalEvent[] = [];
      try { evenements = toEvents(duLogement.map(marquerBlocage), 'lodgify', LODGIFY_FIELDS, 'Lodgify'); } catch { /* 0 */ }
      out.push({
        variante: v.nom,
        statut: 'ok',
        lignes: rows.length,
        duLogement: duLogement.length,
        evenements: evenements.length,
        dansPeriode: evenements.filter(e => e.end >= range.from && e.start <= range.to).length,
        champs: rows.length > 0 ? Object.keys(rows[0]).slice(0, 40) : [],
      });
    } catch (e) {
      out.push({
        variante: v.nom,
        statut: (e as { httpStatus?: number }).httpStatus ?? 0,
        lignes: 0, duLogement: 0, evenements: 0, dansPeriode: 0, champs: [],
      });
    }
  }
  return out;
}
