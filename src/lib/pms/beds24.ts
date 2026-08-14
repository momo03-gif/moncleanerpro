// ── Connecteur Beds24 (API v2) — SERVEUR UNIQUEMENT ───────────────────────────
//
// Authentification en deux étages, documentée publiquement :
//   1. la conciergerie crée un « invite code » dans SETTINGS > ACCOUNT > ACCESS ;
//   2. GET /authentication/setup (en-tête `code`) l'échange contre un
//      refresh token de longue durée ;
//   3. GET /authentication/token (en-tête `refreshToken`) rend un jeton d'accès
//      valable 24 h, envoyé ensuite dans l'en-tête `token`.
//
// On accepte les deux dans le champ « clé » : un invite code (à usage unique) ou
// un refresh token déjà obtenu. La conciergerie n'a pas à comprendre la
// différence — le connecteur se débrouille.
//
// Le nom exact des champs d'un booking n'est pas publié : la lecture passe par
// normalize.ts, qui accepte les variantes et REFUSE plutôt que de deviner une
// date. Voir la règle de sûreté là-bas.
//
// ⚠️ Ne jamais importer côté client.

import { toEvents, type FieldNames } from './normalize';
import type { ICalEvent } from '../ical';

const BASE = 'https://api.beds24.com/v2';

export interface Beds24Credentials {
  /** Invite code ou refresh token. */
  apiKey: string;
  /** Non utilisé par Beds24 — présent pour garder la même forme que les autres. */
  apiSecret?: string;
}

const BEDS24_FIELDS: FieldNames = {
  id: ['id', 'bookId', 'bookingId'],
  arrival: ['arrival', 'arrivalDate', 'checkIn'],
  departure: ['departure', 'departureDate', 'checkOut'],
  arrivalTime: ['arrivalTime', 'checkInTime'],
  departureTime: ['departureTime', 'checkOutTime'],
  status: ['status'],
};

// Jeton d'accès (24 h côté Beds24) gardé en mémoire une heure seulement, pour
// qu'un accès révoqué ne nous reste pas en tête toute la journée.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function get<T>(path: string, headers: Record<string, string>, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]),
  ).toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${BASE}${path}${query ? `?${query}` : ''}`, { signal: controller.signal, headers });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error('Accès Beds24 refusé — code ou permissions insuffisantes.');
      if (res.status === 429) throw new Error('Beds24 limite temporairement les appels. Réessayez dans quelques minutes.');
      throw new Error(`Beds24 a répondu ${res.status}.`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Jeton d'accès. On tente d'abord le refresh token ; si Beds24 le refuse, on
 * suppose qu'on nous a donné un invite code et on fait l'échange.
 */
async function getAccessToken(creds: Beds24Credentials): Promise<string> {
  const cached = tokenCache.get(creds.apiKey);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  let refreshToken = creds.apiKey;
  try {
    const t = await get<{ token?: string }>('/authentication/token', { refreshToken });
    if (t.token) {
      tokenCache.set(creds.apiKey, { token: t.token, expiresAt: Date.now() + 3600_000 });
      return t.token;
    }
  } catch {
    // Ce n'était pas un refresh token : on essaie l'invite code ci-dessous.
  }

  const setup = await get<{ refreshToken?: string; token?: string }>('/authentication/setup', { code: creds.apiKey });
  if (!setup.refreshToken && !setup.token) throw new Error('Code Beds24 non reconnu.');
  refreshToken = setup.refreshToken ?? creds.apiKey;

  const token = setup.token
    ?? (await get<{ token?: string }>('/authentication/token', { refreshToken })).token;
  if (!token) throw new Error('Beds24 n’a pas renvoyé de jeton.');

  tokenCache.set(creds.apiKey, { token, expiresAt: Date.now() + 3600_000 });
  return token;
}

export interface Beds24Property { id: number; name: string }

/** Propriétés du compte — sert à relier « notre » logement au sien. */
export async function listBeds24Properties(creds: Beds24Credentials): Promise<Beds24Property[]> {
  const token = await getAccessToken(creds);
  const data = await get<{ data?: { id: number; name?: string; propertyName?: string }[] }>(
    '/properties', { token },
  );
  return (data.data ?? []).map(p => ({ id: p.id, name: p.propertyName || p.name || `Propriété ${p.id}` }));
}

/**
 * Réservations d'une propriété. Beds24 documente le filtrage par propriété et
 * par dates, mais pas le nom précis des paramètres : on filtre donc aussi
 * localement sur la période, ce qui rend le connecteur insensible à ce détail.
 */
export async function fetchBeds24Reservations(
  creds: Beds24Credentials,
  propertyId: string,
  range: { from: string; to: string },
): Promise<ICalEvent[]> {
  const token = await getAccessToken(creds);
  const data = await get<{ data?: Record<string, unknown>[] }>('/bookings', { token }, {
    propertyId, arrivalFrom: range.from, arrivalTo: range.to,
  });

  const events = toEvents(data.data ?? [], 'beds24', BEDS24_FIELDS, 'Beds24');
  // Filet local : si le filtre de dates n'a pas été pris en compte par l'API,
  // on ne remonte quand même que la période qui nous intéresse.
  return events.filter(e => e.end >= range.from && e.start <= range.to);
}
