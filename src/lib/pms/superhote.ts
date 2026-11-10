// ── Connecteur SuperHote — SERVEUR UNIQUEMENT ────────────────────────────────
//
//  API « SuperHote V2 » (octobre 2026), publique et documentée
//  (docs.superhote.com/api-v2) : `connect.superhote.com/api/v2/public`, jeton
//  « Bearer » créé par le client (Plateformes → API → Créer un token ; lecture
//  seule : rentals.read + reservations.read). Elle donne le STATUT de chaque
//  réservation et n'inclut pas les dates bloquées — pas d'ambiguïté séjour /
//  fermeture comme avec l'iCal de Booking.
//
//  L'ANCIENNE API N'EST PLUS GÉRÉE. Un compte migré la voit continuer de
//  répondre SANS ERREUR… avec des données figées : c'est ainsi que les
//  réservations de Charles&charles ont cessé d'arriver le 08/10. Une clé de
//  l'ancienne version est donc refusée en clair plutôt que synchronisée à vide.
//
// ⚠️ Ne jamais importer côté client.

import type { ICalEvent } from '../ical';
import { pickGuests } from './normalize';

const BASE_V2 = 'https://connect.superhote.com/api/v2/public';

/** Jeton de l'API V2 (« 70335|abc… ») — sinon, clé de l'ancienne version. */
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
  /** Jeton de l'API V2 (« <numéro>|<secret> »), créé dans Plateformes → API. */
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

/** Refuse en clair une clé de l'ancienne version (cf. en-tête). */
function exigerJetonV2(cle: string): string {
  if (!estJetonV2(cle)) {
    throw new Error('Cette clé SuperHote est celle de l’ancienne version, qui n’est plus synchronisée. '
      + 'Dans SuperHote : Plateformes → API → Créer un token (lecture des logements et des réservations), '
      + 'puis collez ce jeton — il a la forme « 12345|… ».');
  }
  return cle.trim();
}

export interface SuperhoteProperty { id: string; name: string }

/** Logements actifs du compte, triés par nom. */
export async function listSuperhoteProperties(
  creds: SuperhoteCredentials,
): Promise<SuperhoteProperty[]> {
  const jeton = exigerJetonV2(creds.apiKey);
  const logements = await toutesLesPagesV2<{ id?: number; name?: string; enabled?: boolean }>(jeton, '/rentals', 'rentals');
  return logements
    .filter(l => l.id != null && l.enabled !== false)
    .map(l => ({ id: String(l.id), name: (l.name ?? '').trim() || `Logement SuperHote nº ${l.id}` }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

/**
 * Séjours d'un logement. On ne garde QUE les dates, le statut et le nombre de
 * voyageurs : nom, e-mail et téléphone du voyageur ne sont jamais recopiés.
 * (Les heures d'arrivée/départ existent aussi, mais les lire changerait d'un
 * coup l'heure de tous les ménages déjà prévus — à faire à part.)
 */
export async function fetchSuperhoteReservations(
  creds: SuperhoteCredentials,
  propertyId: string,
  range: { from: string; to: string },
): Promise<ICalEvent[]> {
  const jeton = exigerJetonV2(creds.apiKey);
  const rentalId = Number(propertyId);
  if (!Number.isFinite(rentalId)) throw new Error(`Identifiant de logement SuperHote invalide : « ${propertyId} ».`);
  const resas = await toutesLesPagesV2<{
    id?: number; rental_id?: number; checkin?: string; checkout?: string; status?: number;
    guests_count?: number; adults_count?: number; children_count?: number;
  }>(
    jeton, `/reservations?rental_id=${rentalId}&checkout_from=${range.from}&checkin_to=${range.to}`, 'reservations');
  return resas
    // Ceinture et bretelles : on revérifie le logement, au cas où le filtre serait ignoré.
    .filter(r => r.id != null && r.rental_id === rentalId && !!r.checkin && !!r.checkout && r.checkout > r.checkin)
    .map(r => ({
      // Identifiant stable d'une synchro à l'autre.
      uid: `superhote-v2-${r.id}`,
      status: statutV2(r.status),
      summary: 'Séjour SuperHote',
      start: r.checkin!.slice(0, 10),
      end: r.checkout!.slice(0, 10),
      guests: pickGuests(r as Record<string, unknown>),
    }));
}
