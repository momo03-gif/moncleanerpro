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
      throw new Error(`Lodgify a répondu ${res.status}.`);
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

/** Réservations d'une propriété sur la période. */
export async function fetchLodgifyReservations(
  creds: LodgifyCredentials,
  propertyId: string,
  range: { from: string; to: string },
): Promise<ICalEvent[]> {
  const data = await getWithFallback<unknown>(
    '/v2/reservations/bookings', '/v1/reservation', creds.apiKey,
    { propertyId, stayFilter: 'All', periodStart: range.from, periodEnd: range.to, size: 200 },
  );

  const rows = unwrap(data);
  const events = toEvents(rows, 'lodgify', LODGIFY_FIELDS, 'Lodgify');
  // Filet local : le nom des paramètres de période peut différer d'une version
  // à l'autre, on borne donc la période nous-mêmes.
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
export async function diagnoseLodgify(
  creds: LodgifyCredentials,
  propertyId: string,
  range: { from: string; to: string },
): Promise<{
  version: 'v2' | 'v1';
  lignes: number;
  champs: string[];
  evenements: number;
  horsPeriode: number;
}> {
  let version: 'v2' | 'v1' = 'v2';
  let data: unknown;
  try {
    data = await get<unknown>('/v2/reservations/bookings', creds.apiKey, {
      propertyId, stayFilter: 'All', periodStart: range.from, periodEnd: range.to, size: 200,
    });
  } catch (e) {
    if ((e as Error)?.message !== 'NOT_FOUND') throw e;
    version = 'v1';
    data = await get<unknown>('/v1/reservation', creds.apiKey, {
      propertyId, stayFilter: 'All', periodStart: range.from, periodEnd: range.to, size: 200,
    });
  }

  const rows = unwrap(data);
  // `toEvents` lève quand aucune ligne n'est lisible : ici on veut le chiffre,
  // pas l'exception — c'est précisément ce qu'on cherche à mesurer.
  let evenements: ICalEvent[] = [];
  try { evenements = toEvents(rows, 'lodgify', LODGIFY_FIELDS, 'Lodgify'); } catch { evenements = []; }

  const dansPeriode = evenements.filter(e => e.end >= range.from && e.start <= range.to);

  return {
    version,
    lignes: rows.length,
    champs: rows.length > 0 ? Object.keys(rows[0]).slice(0, 40) : [],
    evenements: evenements.length,
    horsPeriode: evenements.length - dansPeriode.length,
  };
}
