// ── Connecteur Hostaway — SERVEUR UNIQUEMENT ──────────────────────────────────
//
// Hostaway est le seul des grands PMS à publier sa référence d'API en accès
// libre, ce qui permet d'écrire ce connecteur sans deviner.
//
// Authentification : OAuth 2.0 « client credentials ». La conciergerie récupère
// dans son tableau de bord un identifiant de compte (client_id) et une clé
// secrète (client_secret) ; on les échange contre un jeton porteur.
//
// Ce que ça apporte par rapport à l'iCal : `checkInTime` / `checkOutTime` (les
// départs tardifs et arrivées anticipées) et `numberOfGuests`.
//
// ⚠️ Ne jamais importer côté client.

import type { ICalEvent } from '../ical';

const BASE = 'https://api.hostaway.com/v1';

export interface HostawayCredentials {
  /** Identifiant de compte Hostaway (client_id). */
  apiKey: string;
  /** Clé secrète générée dans le tableau de bord (client_secret). Optionnelle
   *  dans la signature commune aux connecteurs, mais requise ici. */
  apiSecret?: string;
}

// Le jeton Hostaway vit très longtemps (24 mois). On le garde en mémoire le
// temps du processus : inutile de le redemander à chaque logement synchronisé.
// Un redémarrage le redemande, ce qui est sans conséquence.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function getAccessToken(creds: HostawayCredentials): Promise<string> {
  if (!creds.apiSecret) throw new Error('Clé secrète Hostaway requise.');
  const cached = tokenCache.get(creds.apiKey);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const res = await fetch(`${BASE}/accessTokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Cache-Control': 'no-cache' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: creds.apiKey,
      client_secret: creds.apiSecret,
      scope: 'general',
    }),
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) throw new Error('Identifiants Hostaway refusés.');
    throw new Error(`Hostaway a répondu ${res.status} à la demande de jeton.`);
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new Error('Hostaway n’a pas renvoyé de jeton.');

  // On raccourcit volontairement la validité mise en cache (1 h) : un jeton
  // révoqué côté Hostaway ne doit pas nous rester en tête pendant deux ans.
  tokenCache.set(creds.apiKey, { token: data.access_token, expiresAt: Date.now() + 3600_000 });
  return data.access_token;
}

async function hostawayGet<T>(
  creds: HostawayCredentials,
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const token = await getAccessToken(creds);
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${BASE}${path}${query ? `?${query}` : ''}`, {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        tokenCache.delete(creds.apiKey);   // jeton périmé ou révoqué
        throw new Error('Accès Hostaway refusé.');
      }
      throw new Error(`Hostaway a répondu ${res.status}.`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface HostawayListing { id: number; name: string }

/** Annonces du compte — sert à relier « notre » logement au sien. */
export async function listHostawayListings(creds: HostawayCredentials): Promise<HostawayListing[]> {
  const data = await hostawayGet<{ result?: { id: number; name?: string; internalListingName?: string }[] }>(
    creds, '/listings', { limit: 200 },
  );
  return (data.result ?? []).map(l => ({
    id: l.id,
    name: l.internalListingName || l.name || `Annonce ${l.id}`,
  }));
}

interface HostawayReservation {
  id: number;
  arrivalDate: string;          // YYYY-MM-DD
  departureDate: string;        // YYYY-MM-DD
  checkInTime?: number | string;   // heure locale du logement
  checkOutTime?: number | string;
  guestName?: string;
  numberOfGuests?: number;
  status?: string;              // reserved, cancelled, ownerStay, …
}

/**
 * Hostaway renvoie parfois l'heure comme un simple nombre (« 15 » pour 15 h),
 * parfois comme « 15:00 ». On normalise en HH:MM, ou rien.
 */
function hm(value?: number | string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') {
    return value >= 0 && value <= 23 ? `${String(value).padStart(2, '0')}:00` : undefined;
  }
  const m = /^(\d{1,2})(?::(\d{2}))?/.exec(value.trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2] ?? '00'}` : undefined;
}

/**
 * Réservations d'une annonce, converties dans la forme que le moteur de synchro
 * consomme déjà (ICalEvent) : le reste de la chaîne ne change pas.
 */
export async function fetchHostawayReservations(
  creds: HostawayCredentials,
  listingId: string,
  range: { from: string; to: string },
): Promise<ICalEvent[]> {
  const out: ICalEvent[] = [];
  const limit = 100;

  for (let offset = 0; offset < 2000; offset += limit) {
    const data = await hostawayGet<{ result?: HostawayReservation[] }>(creds, '/reservations', {
      listingId, arrivalStartDate: range.from, arrivalEndDate: range.to, limit, offset,
    });
    const rows = data.result ?? [];

    for (const r of rows) {
      // Hostaway distingue plusieurs statuts ; seul « cancelled » nous fait
      // annuler. « ownerStay » reste une occupation : le ménage a lieu quand même.
      const cancelled = (r.status ?? '').toLowerCase() === 'cancelled';
      const who = r.guestName?.trim();
      out.push({
        uid: `hostaway-${r.id}`,
        status: cancelled ? 'CANCELLED' : 'CONFIRMED',
        summary: [who, r.numberOfGuests ? `${r.numberOfGuests} pers.` : null]
          .filter(Boolean).join(' · ') || 'Réservation',
        start: r.arrivalDate,
        end: r.departureDate,
        startTime: hm(r.checkInTime),
        endTime: hm(r.checkOutTime),
      });
    }

    if (rows.length < limit) break;
  }

  return out;
}
