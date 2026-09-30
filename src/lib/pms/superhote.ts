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
  /** En-têtes d'authentification, ou `null` quand la clé va dans le corps. */
  entetes: ((cle: string) => Record<string, string>) | null;
}

// Par ordre de probabilité. L'en-tête d'abord : c'est ce que « SH apiKey »
// annonce, et c'est la forme d'une API de lecture. Le corps en dernier : c'est
// celle du moteur de vente, dont on sait déjà qu'elle ne sait pas lire.
const ACCES: Acces[] = [
  { nom: 'app/api/v2 · SH-APIKEY', base: 'https://app.superhote.com/api/v2', entetes: c => ({ 'SH-APIKEY': c }) },
  { nom: 'app/api · SH-APIKEY', base: 'https://app.superhote.com/api', entetes: c => ({ 'SH-APIKEY': c }) },
  { nom: 'api/v2 · SH-APIKEY', base: 'https://api.superhote.com/v2', entetes: c => ({ 'SH-APIKEY': c }) },
  { nom: 'api · SH-APIKEY', base: 'https://api.superhote.com', entetes: c => ({ 'SH-APIKEY': c }) },
  { nom: 'app/api/v2 · Bearer', base: 'https://app.superhote.com/api/v2', entetes: c => ({ Authorization: `Bearer ${c}` }) },
  { nom: 'app/api/v2 · X-API-KEY', base: 'https://app.superhote.com/api/v2', entetes: c => ({ 'X-API-KEY': c }) },
  { nom: 'app/api/v2 · clé dans le corps', base: 'https://app.superhote.com/api/v2', entetes: null },
];

// Chemins plausibles pour lister les logements, puis les réservations.
const CHEMINS_LOGEMENTS = ['/properties', '/get-properties', '/rentals', '/listings', '/accommodations'];
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
  cle: string,
  params: Record<string, string | undefined>,
): Promise<unknown> {
  const controller = new AbortController();
  // Court : une sonde enchaîne plusieurs tentatives, un timeout long les rendrait
  // insupportables à l'écran de connexion.
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const propres = Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][];

    if (acces.entetes) {
      const query = propres.length ? '?' + new URLSearchParams(propres).toString() : '';
      const res = await fetch(`${acces.base}${chemin}${query}`, {
        method: 'GET',
        signal: controller.signal,
        headers: { ...acces.entetes(cle), Accept: 'application/json' },
      });
      return await lire(res);
    }

    const res = await fetch(`${acces.base}${chemin}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ api_key: cle, ...Object.fromEntries(propres) }),
    });
    return await lire(res);
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
 * Trouve une combinaison qui répond, et la retient.
 *
 * Une erreur d'AUTHENTIFICATION (401/403) sur une adresse est un renseignement :
 * elle prouve que l'adresse existe. On la garde donc en mémoire pour le message
 * d'erreur final, qui doit distinguer « cette API n'existe pas » de « cette clé
 * n'y donne pas droit » — deux problèmes, deux solutions.
 */
async function sonder(
  cle: string,
  chemins: string[],
  params: Record<string, string | undefined>,
): Promise<{ acces: Acces; chemin: string; lignes: Record<string, unknown>[] }> {
  const ordre = accesRetenu ? [accesRetenu, ...ACCES.filter(a => a !== accesRetenu)] : ACCES;
  let refusee = false;

  for (const acces of ordre) {
    for (const chemin of chemins) {
      try {
        const lignes = unwrap(await appel(acces, chemin, cle, params));
        if (lignes.length > 0) { accesRetenu = acces; return { acces, chemin, lignes }; }
      } catch (e) {
        const code = (e as { httpStatus?: number }).httpStatus;
        if (code === 401 || code === 403) { refusee = true; continue; }
        if (code === undefined) continue;   // délai dépassé, réseau : on poursuit
        // 404, 400, 405 : pas ce chemin-là.
      }
    }
  }

  throw new Error(refusee
    ? 'SuperHote a refusé cette clé sur toutes ses adresses : elle n’ouvre probablement '
      + 'que le moteur de réservation, pas la lecture du planning. Le lien iCal reste la voie.'
    : 'Aucune API de lecture SuperHote n’a répondu. Leur clé publique ne sert peut-être '
      + 'qu’au moteur de réservation. Le lien iCal reste la voie.');
}

export interface SuperhoteProperty { id: string; name: string }

/** Logements du compte — sert à relier « notre » logement au sien. */
export async function listSuperhoteProperties(
  creds: SuperhoteCredentials,
): Promise<SuperhoteProperty[]> {
  const { lignes } = await sonder(creds.apiKey, CHEMINS_LOGEMENTS, {});
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
  const { lignes } = await sonder(creds.apiKey, CHEMINS_RESERVATIONS, {
    property_key: propertyId,
    start_date: range.from,
    end_date: range.to,
  });

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
  acces: string; chemin: string; statut: number | 'ok'; lignes: number;
}[]> {
  const out: { acces: string; chemin: string; statut: number | 'ok'; lignes: number }[] = [];
  for (const acces of ACCES) {
    for (const chemin of CHEMINS_LOGEMENTS) {
      try {
        const lignes = unwrap(await appel(acces, chemin, creds.apiKey, {}));
        out.push({ acces: acces.nom, chemin, statut: 'ok', lignes: lignes.length });
      } catch (e) {
        out.push({ acces: acces.nom, chemin, statut: (e as { httpStatus?: number }).httpStatus ?? 0, lignes: 0 });
      }
    }
  }
  // Ce qui a répondu d'abord : c'est la seule ligne qu'on lira vraiment.
  return out.sort((a, b) => (b.lignes - a.lignes) || (a.statut === 'ok' ? -1 : 1));
}
