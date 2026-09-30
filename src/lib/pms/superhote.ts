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
// ⚠️ Ne jamais importer côté client.

import type { ICalEvent } from '../ical';

const BASE = 'https://app.superhote.com/api/v2';

export interface SuperhoteCredentials {
  /** « SH apiKey », dans Paramètres Utilisateur du compte SuperHote. */
  apiKey: string;
  apiSecret?: string;   // inutilisé — même forme que les autres connecteurs
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
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new Error('Clé SuperHote refusée.');
      throw new Error(`SuperHote a répondu ${res.status}.`);
    }
    return (await res.json()) as T;
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
  const demain = new Date(Date.now() + 86400000);
  const apres = new Date(Date.now() + 3 * 86400000);

  const data = await post<{ status?: string; restrictions?: Record<string, { rentalId?: number }> }>(
    '/get-availabilities',
    { api_key: creds.apiKey, start_date: jour(demain), end_date: jour(apres), nbr_adults: 1, nbr_children: 0 },
  );

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
  const rentalId = Number(propertyId);
  if (!Number.isFinite(rentalId)) {
    throw new Error(`Identifiant de logement SuperHote invalide : « ${propertyId} ».`);
  }

  const data = await post<{ dates?: Periode[] }>('/get-not-available-dates', { rentalId });

  return (data.dates ?? [])
    .filter((p): p is Required<Periode> => !!p.startDate && !!p.endDate && p.endDate > p.startDate)
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
