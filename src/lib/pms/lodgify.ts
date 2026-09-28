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

/** Les clés de premier niveau de la réponse — c'est là que vit la pagination. */
function clesEnveloppe(payload: unknown): string[] {
  if (Array.isArray(payload)) return ['(tableau à plat)'];
  const obj = payload as Record<string, unknown> | null;
  return obj && typeof obj === 'object' ? Object.keys(obj).slice(0, 20) : [];
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

interface Candidate {
  nom: string;
  params: Record<string, string | number | undefined>;
  /** Comment demander la page n (1 = première). Absent = pas de pagination. */
  curseur?: (n: number) => Record<string, number>;
}

// Dans l'ordre de préférence : d'abord ce qui laisse Lodgify filtrer lui-même,
// ensuite ce qui pagine, enfin l'appel minimal qui répond toujours — celui dont
// on sait qu'il répond, même s'il ne voit que la première page.
function candidates(range: { from: string; to: string }): Candidate[] {
  const periode = { periodStart: range.from, periodEnd: range.to };
  return [
    { nom: 'DepartureDate + page', params: { stayFilter: 'DepartureDate', ...periode, size: PAGE }, curseur: n => ({ page: n }) },
    { nom: 'All + page', params: { stayFilter: 'All', size: PAGE }, curseur: n => ({ page: n }) },
    { nom: 'All + offset', params: { stayFilter: 'All', limit: PAGE }, curseur: n => ({ offset: (n - 1) * PAGE }) },
    { nom: 'All + pageNumber', params: { stayFilter: 'All', pageSize: PAGE }, curseur: n => ({ pageNumber: n }) },
    { nom: 'All, sans pagination', params: { stayFilter: 'All', ...periode, size: 200 } },
  ];
}

/**
 * Réservations d'une propriété sur la période.
 *
 * CE QUE LA VRAIE CLÉ A APPRIS, et qu'aucune documentation ne disait :
 *  · `stayFilter: 'All'` fait IGNORER `periodStart`/`periodEnd` — on reçoit
 *    l'historique du compte, presque entièrement passé ;
 *  · une page est plafonnée à 100 lignes, triées du plus ANCIEN au plus
 *    récent : sans pagination, un compte un peu ancien ne montre aucune
 *    réservation à venir ;
 *  · le filtre par date de départ, qui serait le bon, est refusé (400) par
 *    certains comptes ;
 *  · et le nom du curseur de page n'est pas le même partout.
 *
 * Aucune combinaison ne marche donc sur tous les comptes. Plutôt que d'en
 * choisir une et d'espérer, on essaie les candidates sur UNE page et on retient
 * celle qui rend le plus de séjours DANS LA PÉRIODE — un appel qui répond 200
 * en ne rendant que du passé n'a pas « marché ». Puis on pagine celle-là.
 */
export async function fetchLodgifyReservations(
  creds: LodgifyCredentials,
  propertyId: string,
  range: { from: string; to: string },
): Promise<ICalEvent[]> {
  const attendu = String(propertyId);

  const utiles = (rows: Record<string, unknown>[]) => {
    const duLogement = attendu
      ? rows.filter(r => r.property_id === undefined || String(r.property_id) === attendu)
      : rows;
    let ev: ICalEvent[] = [];
    try { ev = toEvents(duLogement.map(marquerBlocage), 'lodgify', LODGIFY_FIELDS, 'Lodgify'); } catch { ev = []; }
    return ev.filter(e => e.end >= range.from && e.start <= range.to);
  };

  const lire = (filtre: Record<string, string | number | undefined>) => getWithFallback<unknown>(
    '/v2/reservations/bookings', '/v1/reservation', creds.apiKey, { propertyId, ...filtre },
  );

  // ── 1. Laquelle de ces façons de demander rend vraiment quelque chose ? ────
  let choisie: Candidate | null = null;
  let premieres: Record<string, unknown>[] = [];
  let derniere: Error | null = null;

  for (const c of candidates(range)) {
    try {
      const rows = unwrap(await lire({ ...c.params, ...(c.curseur ? c.curseur(1) : {}) }));
      const score = utiles(rows).length;
      // Une variante qui rend des séjours dans la période gagne tout de suite.
      if (score > 0) { choisie = c; premieres = rows; break; }
      // Sinon on garde la première qui répond : mieux vaut peu que rien.
      if (!choisie) { choisie = c; premieres = rows; }
    } catch (e) {
      if ((e as { httpStatus?: number }).httpStatus !== 400) throw e;
      derniere = e as Error;
    }
  }
  if (!choisie) throw derniere ?? new Error('Lodgify n’a accepté aucune de nos requêtes.');

  // ── 2. Puis on la pagine, si elle porte un curseur ─────────────────────────
  const rows = [...premieres];
  if (choisie.curseur && premieres.length >= PAGE) {
    const empreinte = (l: Record<string, unknown>[]) => String(l[0]?.id ?? '') + '|' + l.length;
    let precedente = empreinte(premieres);

    for (let n = 2; n <= PAGES_MAX; n++) {
      const lot = unwrap(await lire({ ...choisie.params, ...choisie.curseur(n) }));
      // Un compte peut répondre 200 en IGNORANT le curseur : on relirait alors
      // la même page dix fois. Deux pages identiques = il n'y a pas de suite.
      if (lot.length === 0 || empreinte(lot) === precedente) break;
      precedente = empreinte(lot);
      rows.push(...lot);
      if (lot.length < PAGE) break;
    }
  }

  // Une même réservation peut revenir d'une page à l'autre si le tri bouge.
  const vues = new Set<string>();
  const uniques = rows.filter(r => {
    const k = String(r.id ?? `${r.arrival}-${r.departure}`);
    if (vues.has(k)) return false;
    vues.add(k); return true;
  });

  return utiles(uniques);
}

export interface SondeLodgify {
  variante: string;
  statut: number | 'ok';
  lignes: number;
  duLogement: number;
  evenements: number;
  dansPeriode: number;
  champs: string[];
  /** Clés de premier niveau de la réponse : c'est là que vit la pagination. */
  enveloppe: string[];
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
  // Exactement les candidates du connecteur, page 1, plus deux repères : le
  // témoin dont on sait qu'il répond, et ArrivalDate pour comparer.
  const VARIANTES: { nom: string; params: Record<string, string | number | undefined> }[] = [
    ...candidates(range).map(c => ({
      nom: c.nom,
      params: { ...c.params, ...(c.curseur ? c.curseur(1) : {}) },
    })),
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
        enveloppe: clesEnveloppe(data),
      });
    } catch (e) {
      out.push({
        variante: v.nom,
        statut: (e as { httpStatus?: number }).httpStatus ?? 0,
        lignes: 0, duLogement: 0, evenements: 0, dansPeriode: 0, champs: [], enveloppe: [],
      });
    }
  }
  return out;
}
