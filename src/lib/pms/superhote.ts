// ── Connecteur SuperHote — SERVEUR UNIQUEMENT ────────────────────────────────
//
// ⚠️ FORME NON CONFIRMÉE. Écrit d'après ce que SuperHote expose publiquement,
// jamais essayé sur un vrai compte : leur documentation d'API est derrière un
// espace client. Le connecteur est donc marqué `verified: false`, et l'écran de
// connexion le dit à la conciergerie. Sans danger : la connexion exige un test
// réussi (la liste des logements doit revenir) avant d'enregistrer quoi que ce
// soit — un connecteur qui se trompe d'endpoint ne s'enregistre pas.
//
// CE QU'ON SAIT, ET QUI EST INHABITUEL : SuperHote authentifie en POST, avec la
// clé dans le CORPS JSON (`api_key`), et non dans un en-tête. Ses paramètres
// sont en snake_case et un logement s'y désigne par `property_key`. C'est la
// forme publiée de `get-availabilities`, qu'on suit pour le reste.
//
// CE QU'ON NE SAIT PAS : le nom exact des endpoints de LECTURE. Leur API
// publique documente surtout la vente (disponibilités, création de séjour) et
// des webhooks sortants. Plutôt que de parier sur un nom, on essaie les
// candidats plausibles et on retient celui qui répond — la même méthode qui a
// fini par débloquer Lodgify.
//
// ⚠️ Ne jamais importer côté client.

import { toEvents, type FieldNames } from './normalize';
import type { ICalEvent } from '../ical';

const BASE = 'https://app.superhote.com/api/v2';

export interface SuperhoteCredentials {
  /** Clé du compte SuperHote de la conciergerie. */
  apiKey: string;
  apiSecret?: string;   // inutilisé — même forme que les autres connecteurs
}

// Noms de champs tolérants : SuperHote mélange l'anglais et le français selon
// les endpoints, et `normalize` REFUSE une ligne plutôt que de deviner une date.
const SUPERHOTE_FIELDS: FieldNames = {
  id: ['id', 'reservation_id', 'booking_id', 'key', 'reservation_key'],
  arrival: ['start_date', 'checkin', 'check_in', 'arrival', 'date_arrivee', 'arrival_date'],
  departure: ['end_date', 'checkout', 'check_out', 'departure', 'date_depart', 'departure_date'],
  arrivalTime: ['checkin_time', 'check_in_time', 'arrival_time', 'heure_arrivee'],
  departureTime: ['checkout_time', 'check_out_time', 'departure_time', 'heure_depart'],
  status: ['status', 'statut', 'state'],
};

/** Un POST JSON portant la clé, comme SuperHote l'attend. */
async function post<T>(path: string, corps: Record<string, unknown>): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(corps),
    });
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error('Clé SuperHote refusée.');
      // Le code voyage avec l'erreur : un 404 ou un 400 veut dire « pas cet
      // endpoint-là », et l'appelant peut essayer le candidat suivant.
      const err = new Error(`SuperHote a répondu ${res.status}.`) as Error & { httpStatus?: number };
      err.httpStatus = res.status;
      throw err;
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Les listes arrivent tantôt à plat, tantôt enveloppées. */
function unwrap(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  const obj = payload as Record<string, unknown> | null;
  for (const key of ['data', 'items', 'results', 'reservations', 'bookings', 'properties', 'logements', 'accommodations']) {
    const v = obj?.[key];
    if (Array.isArray(v)) return v as Record<string, unknown>[];
  }
  return [];
}

/**
 * Essaie plusieurs endpoints et rend la première réponse exploitable.
 *
 * Un 400 ou un 404 signifie « pas ce chemin-là » : on passe au suivant. Une clé
 * refusée ou une panne, elles, remontent tout de suite — insister ne servirait
 * qu'à masquer la vraie cause derrière une liste d'échecs.
 */
async function premierQuiRepond(
  chemins: string[],
  corps: Record<string, unknown>,
): Promise<{ chemin: string; lignes: Record<string, unknown>[] }> {
  let derniere: Error | null = null;
  for (const chemin of chemins) {
    try {
      const lignes = unwrap(await post<unknown>(chemin, corps));
      if (lignes.length > 0) return { chemin, lignes };
      // Une réponse vide n'est pas une erreur : on la garde en réserve, au cas
      // où aucun autre chemin ne réponde mieux.
      derniere = derniere ?? null;
    } catch (e) {
      const code = (e as { httpStatus?: number }).httpStatus;
      if (code !== 400 && code !== 404 && code !== 405) throw e;
      derniere = e as Error;
    }
  }
  if (derniere) throw derniere;
  return { chemin: chemins[chemins.length - 1], lignes: [] };
}

/**
 * La clé et l'adresse répondent-elles ? `get-availabilities` est le seul
 * endpoint que SuperHote publie : il sert de TÉMOIN.
 *
 * Sans lui, un 404 sur nos chemins de lecture est illisible — il peut vouloir
 * dire « ces noms n'existent pas », « cette clé n'a pas les droits » ou « cette
 * adresse n'est pas la bonne », et ces trois-là n'appellent pas du tout la même
 * correction. La leçon vient de Lodgify : un repli qui ne finit pas par un
 * appel connu ne fait qu'échouer autrement.
 */
async function leTemoinRepond(creds: SuperhoteCredentials): Promise<boolean> {
  const demain = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const apres = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  try {
    await post<unknown>('/get-availabilities', {
      api_key: creds.apiKey, start_date: demain, end_date: apres,
      nbr_adults: 1, nbr_children: 0,
    });
    return true;
  } catch (e) {
    // Une clé refusée est une réponse en soi : l'endpoint existe bien.
    return (e as Error).message === 'Clé SuperHote refusée.';
  }
}

export interface SuperhoteProperty { id: string; name: string }

/** Logements du compte — sert à relier « notre » logement au sien. */
export async function listSuperhoteProperties(
  creds: SuperhoteCredentials,
): Promise<SuperhoteProperty[]> {
  let lignes: Record<string, unknown>[];
  try {
    ({ lignes } = await premierQuiRepond(
      ['/get-properties', '/get-accommodations', '/get-logements', '/properties',
       '/get-rentals', '/get-listings', '/get-apartments', '/get-property-list'],
      { api_key: creds.apiKey },
    ));
  } catch (e) {
    // Aucun de nos chemins n'a répondu : reste à savoir si le problème vient
    // d'eux ou de la clé. Le témoin tranche, et le message le dit clairement —
    // « SuperHote a répondu 404 » n'aide personne à décider quoi faire.
    if (await leTemoinRepond(creds)) {
      throw new Error(
        'La clé et l’adresse de SuperHote sont bonnes, mais aucun de nos chemins de '
        + 'lecture n’existe chez eux. Il nous faut le nom exact de l’endpoint qui liste '
        + 'les logements, depuis leur documentation (espace client SuperHote). '
        + 'En attendant, le lien iCal fonctionne.',
      );
    }
    throw e;
  }

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
  const { lignes } = await premierQuiRepond(
    ['/get-reservations', '/get-bookings', '/reservations', '/get-booking-list'],
    {
      api_key: creds.apiKey,
      property_key: propertyId,
      start_date: range.from,
      end_date: range.to,
    },
  );

  // Filet local sur le logement : rien ne garantit que le filtre soit honoré,
  // et importer les séjours d'un autre bien les collerait tous sur celui-ci.
  const attendu = String(propertyId);
  const sien = lignes.filter(r => {
    const k = r.property_key ?? r.property_id ?? r.logement_id;
    return k === undefined || String(k) === attendu;
  });

  const events = toEvents(sien, 'superhote', SUPERHOTE_FIELDS, 'SuperHote');
  // Filet local sur la période, pour la même raison.
  return events.filter(e => e.end >= range.from && e.start <= range.to);
}
