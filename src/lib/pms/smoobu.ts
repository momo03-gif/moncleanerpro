// ── Connecteur Smoobu — SERVEUR UNIQUEMENT ────────────────────────────────────
//
// Ce que l'iCal ne donne pas et que l'API apporte : l'heure d'arrivée et l'heure
// de départ (donc les départs tardifs et arrivées anticipées), le nom du
// voyageur, le nombre d'adultes et d'enfants, et les modifications en temps réel.
//
// La clé est générée par la conciergerie DANS SON PROPRE COMPTE Smoobu : aucun
// programme partenaire à obtenir, contrairement à Airbnb.
//
// ⚠️ Ne jamais importer côté client : la clé et le secret transiteraient dans le
// navigateur.

import { createHash, createHmac, randomUUID } from 'node:crypto';
import { canonicalQuery, canonicalString, EMPTY_BODY_SHA256 } from './smoobuSign';
import type { ICalEvent } from '../ical';

const BASE = 'https://login.smoobu.com';

export interface SmoobuCredentials {
  apiKey: string;
  /** Optionnel dans la signature commune aux connecteurs, mais requis ici :
   *  sans secret, impossible de signer une requête. Vérifié à l'appel. */
  apiSecret?: string;
}

/** Requête signée (HMAC) vers l'API Smoobu. */
async function smoobuGet<T>(
  creds: SmoobuCredentials,
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  if (!creds.apiSecret) throw new Error('Secret Smoobu requis pour signer la requête.');
  const query = canonicalQuery(params);
  const timestamp = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const nonce = randomUUID();

  const signature = createHmac('sha256', creds.apiSecret)
    .update(canonicalString({ method: 'GET', path, query, timestamp, nonce, bodyHash: EMPTY_BODY_SHA256, apiKey: creds.apiKey }))
    .digest('base64');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${BASE}${path}${query ? `?${query}` : ''}`, {
      signal: controller.signal,
      headers: {
        'X-API-Key': creds.apiKey,
        'X-Timestamp': timestamp,
        'X-Nonce': nonce,
        'X-Signature': signature,
        'User-Agent': 'MonCleanerPro/1.0',
      },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // 401/403 = clé ou secret faux ; on veut un message que la conciergerie comprenne.
      if (res.status === 401 || res.status === 403) throw new Error('Clé ou secret Smoobu refusé.');
      throw new Error(`Smoobu a répondu ${res.status}. ${detail.slice(0, 120)}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export interface SmoobuApartment { id: number; name: string }

/** Logements du compte — sert à relier « notre » logement au sien. */
export async function listSmoobuApartments(creds: SmoobuCredentials): Promise<SmoobuApartment[]> {
  const data = await smoobuGet<{ apartments?: SmoobuApartment[] }>(creds, '/api/apartments');
  return data.apartments ?? [];
}

// Réponse Smoobu (champs utiles). Les noms à tirets viennent de leur API.
interface SmoobuReservation {
  id: number;
  arrival: string;              // YYYY-MM-DD
  departure: string;            // YYYY-MM-DD
  'check-in'?: string;          // HH:MM — arrivée anticipée visible ici
  'check-out'?: string;         // HH:MM — départ tardif visible ici
  'guest-name'?: string;
  adults?: number;
  children?: number;
  type?: string;                // reservation | modification | cancellation
  'is-blocked-booking'?: boolean;
}

/** HH:MM à partir de ce que renvoie Smoobu (« 14:00 » ou « 14:00:00 »). */
function hm(value?: string): string | undefined {
  if (!value) return undefined;
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : undefined;
}

/**
 * Réservations d'un logement, converties dans la forme que le moteur de synchro
 * consomme déjà (ICalEvent). Aucune autre partie de la chaîne ne change : le
 * dédoublonnage, la création des ménages et l'anti-doublon restent identiques.
 *
 * `summary` reprend le nom du voyageur et le nombre de personnes : le cleaner
 * saura qu'il fait un logement pour 6 et pas pour 2.
 */
export async function fetchSmoobuReservations(
  creds: SmoobuCredentials,
  propertyId: string,
  range: { from: string; to: string },
): Promise<ICalEvent[]> {
  const out: ICalEvent[] = [];
  const pageSize = 100;

  // Pagination : on s'arrête dès qu'une page n'est pas pleine (et au bout de 20
  // pages, garde-fou contre une boucle infinie si l'API change de contrat).
  for (let page = 1; page <= 20; page++) {
    const data = await smoobuGet<{ bookings?: SmoobuReservation[] }>(creds, '/api/reservations', {
      apartmentId: propertyId, from: range.from, to: range.to, page, pageSize,
    });
    const bookings = data.bookings ?? [];

    for (const b of bookings) {
      const people = (b.adults ?? 0) + (b.children ?? 0);
      const who = b['guest-name']?.trim();
      out.push({
        uid: `smoobu-${b.id}`,
        // Une annulation est signalée par `type` ; classifyEvent lit `status`.
        status: b.type === 'cancellation' ? 'CANCELLED' : 'CONFIRMED',
        summary: b['is-blocked-booking']
          ? 'Blocked'
          : [who, people > 0 ? `${people} pers.` : null].filter(Boolean).join(' · ') || 'Réservation',
        start: b.arrival,
        end: b.departure,
        startTime: hm(b['check-in']),
        endTime: hm(b['check-out']),
      });
    }

    if (bookings.length < pageSize) break;
  }

  return out;
}
