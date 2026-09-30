// ── Lire une réservation poussée par un logiciel (logique PURE) ──────────────
//
//  POURQUOI CE MODULE
//  Un webhook arrive sans qu'on ait pu lire la documentation de l'éditeur. Sa
//  forme n'est donc pas connue à l'avance — et on ne peut pas se permettre de
//  la refuser : un webhook rejeté est un webhook que l'éditeur finit par
//  désactiver, et le client perd la synchronisation sans que personne ne le
//  sache.
//
//  LA RÈGLE : on cherche largement, et on REFUSE de deviner une date. Mieux
//  vaut rendre « je n'ai pas compris » — l'évènement est alors conservé tel
//  quel pour qu'un humain le lise — que fabriquer un séjour qui n'existe pas et
//  envoyer un intervenant chez personne.
//
//  Les éditeurs enveloppent souvent la réservation (`data`, `payload`,
//  `booking`…) et mélangent anglais, français, camelCase et snake_case. On
//  parcourt donc l'objet en profondeur plutôt que d'exiger une forme.

/** Ce qu'on a réussi à lire d'un évènement reçu. */
export interface ReservationRecue {
  /** Identifiant chez l'éditeur — sert à ne pas créer deux fois le même séjour. */
  externalUid: string;
  checkIn: string;
  checkOut: string;
  /** Identifiant du logement chez l'éditeur, quand il est fourni. */
  propertyRef?: string;
  /** Nom du logement, utile quand aucun identifiant ne vient. */
  propertyName?: string;
  status: 'confirmed' | 'cancelled' | 'tentative';
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})/;

/** Une date exploitable, ou rien. On ne réinterprète jamais un format ambigu. */
function versDate(v: unknown): string | null {
  if (typeof v === 'number') {
    // Horodatage en secondes ou en millisecondes.
    const ms = v > 1e11 ? v : v * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  if (typeof v !== 'string') return null;
  const t = v.trim();
  const iso = ISO.exec(t);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // JJ/MM/AAAA — sans ambiguïté possible dès que le jour dépasse 12, mais on
  // l'accepte aussi en dessous : un éditeur français ne change pas de format
  // selon le jour du mois, et le reste du système attend de l'ISO.
  const fr = /^(\d{2})[/-](\d{2})[/-](\d{4})/.exec(t);
  if (fr) return `${fr[3]}-${fr[2]}-${fr[1]}`;
  return null;
}

/** Cherche la première valeur dont la CLÉ correspond, en profondeur. */
function chercher(objet: unknown, noms: string[], profondeur = 0): unknown {
  if (profondeur > 4 || objet === null || typeof objet !== 'object') return undefined;

  const entries = Array.isArray(objet)
    ? objet.map((v, i) => [String(i), v] as const)
    : Object.entries(objet as Record<string, unknown>);

  // Le niveau courant d'abord : une clé proche compte plus qu'une clé profonde.
  for (const [cle, valeur] of entries) {
    const norm = cle.toLowerCase().replace(/[^a-z]/g, '');
    if (noms.includes(norm) && valeur !== null && valeur !== undefined && valeur !== '') return valeur;
  }
  for (const [, valeur] of entries) {
    const trouve = chercher(valeur, noms, profondeur + 1);
    if (trouve !== undefined) return trouve;
  }
  return undefined;
}

const NOMS = {
  id: ['id', 'reservationid', 'bookingid', 'reservationkey', 'bookingkey', 'uid', 'reference', 'key'],
  arrivee: ['startdate', 'checkin', 'arrival', 'arrivaldate', 'datearrivee', 'datedebut', 'from', 'debut'],
  depart: ['enddate', 'checkout', 'departure', 'departuredate', 'datedepart', 'datefin', 'to', 'fin'],
  logement: ['propertykey', 'propertyid', 'rentalid', 'listingid', 'logementid', 'accommodationid', 'apartmentid'],
  nomLogement: ['propertyname', 'rentalname', 'listingname', 'logement', 'propertytitle', 'apartmentname'],
  statut: ['status', 'statut', 'state', 'bookingstatus'],
  evenement: ['event', 'eventtype', 'type', 'action', 'topic'],
};

const ANNULE = ['cancelled', 'canceled', 'cancel', 'declined', 'refused', 'annule', 'annulee', 'deleted', 'expired'];
const ATTENTE = ['pending', 'tentative', 'inquiry', 'request', 'option', 'hold', 'unconfirmed', 'enattente'];

const texte = (v: unknown) => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '');

/**
 * Lit un corps de webhook. Renvoie `null` quand les dates ne sont pas
 * reconnaissables : l'appelant doit alors CONSERVER l'évènement tel quel plutôt
 * que de l'ignorer, pour qu'on puisse en lire la forme et compléter ce module.
 */
export function lireReservationRecue(corps: unknown): ReservationRecue | null {
  const checkIn = versDate(chercher(corps, NOMS.arrivee));
  const checkOut = versDate(chercher(corps, NOMS.depart));
  if (!checkIn || !checkOut || checkOut < checkIn) return null;

  const brutId = texte(chercher(corps, NOMS.id));
  // Sans identifiant, les dates et le logement font une clé stable : le même
  // séjour renvoyé deux fois ne doit pas produire deux réservations.
  const propertyRef = texte(chercher(corps, NOMS.logement)) || undefined;
  const externalUid = brutId || `${propertyRef ?? 'x'}-${checkIn}-${checkOut}`;

  // Le statut peut vivre dans la réservation ou dans le nom de l'évènement
  // (« booking.cancelled »). On regarde les deux.
  const marqueur = `${texte(chercher(corps, NOMS.statut))} ${texte(chercher(corps, NOMS.evenement))}`
    .toLowerCase().replace(/[^a-z]/g, '');
  const status: ReservationRecue['status'] =
    ANNULE.some(m => marqueur.includes(m)) ? 'cancelled'
      : ATTENTE.some(m => marqueur.includes(m)) ? 'tentative'
        : 'confirmed';

  return {
    externalUid,
    checkIn,
    checkOut,
    propertyRef,
    propertyName: texte(chercher(corps, NOMS.nomLogement)) || undefined,
    status,
  };
}
