// ── Qui appeler quand la clé n'est pas dans la boîte (logique PURE) ───────────
//
// Le cleaner est devant la porte, la boîte à clé est vide. Il lui faut un
// humain à joindre, tout de suite. Ce fichier extrait ce qui est joignable des
// données qu'on reçoit déjà — rien de plus, et surtout rien d'inventé.
//
// Ce que chaque source donne réellement :
//   · API du PMS (Smoobu, Hostaway, Beds24, Lodgify) → nom ET téléphone du
//     voyageur. C'est le seul cas où l'on peut composer un numéro.
//   · iCal Airbnb → pas de nom (« Reserved »), mais la DESCRIPTION porte le lien
//     de la réservation et les 4 DERNIERS CHIFFRES du téléphone. On ne peut pas
//     appeler avec ça, mais on peut écrire au voyageur depuis Airbnb, et les 4
//     chiffres permettent de reconnaître un appel entrant.
//   · iCal des autres plateformes → parfois un nom, jamais un numéro.
//
// D'où la règle de l'écran : le contact de secours du logement (propriétaire,
// conciergerie, gardien) est le recours qui marche TOUJOURS. Le voyageur vient
// en complément quand la source le permet.

/** Ce qu'un calendrier Airbnb cache dans sa DESCRIPTION. */
export interface AirbnbGuestHints {
  /** 4 derniers chiffres du téléphone du voyageur (Airbnb ne donne que ça). */
  phoneLast4?: string;
  /** Lien vers la réservation — ouvre la conversation avec le voyageur. */
  reservationUrl?: string;
}

/**
 * Lit la DESCRIPTION d'un évènement iCal Airbnb. Forme habituelle :
 *
 *   Reservation URL: https://www.airbnb.com/hosting/reservations/details/HMABC123
 *   Phone Number (Last 4 Digits): 1234
 *
 * Tolérant : Airbnb traduit ses exports et replie ses lignes. On cherche donc le
 * lien d'abord, puis 4 chiffres présentés comme fin de numéro — et on ne rend
 * rien plutôt que de deviner.
 */
export function parseAirbnbDescription(description?: string | null): AirbnbGuestHints {
  if (!description) return {};
  const out: AirbnbGuestHints = {};

  const url = description.match(/https?:\/\/[^\s<>"]*airbnb\.[a-z.]+\/[^\s<>"]*/i);
  if (url) out.reservationUrl = url[0].replace(/[.,;)]+$/, '');

  // « (Last 4 Digits): 1234 », « 4 derniers chiffres : 1234 », « ...: 1234 »
  const last4 = description.match(/(?:last\s*4\s*digits|derniers?\s*chiffres)[^\d]{0,12}(\d{4})/i);
  if (last4) out.phoneLast4 = last4[1];

  return out;
}

// Ce que les plateformes écrivent quand il n'y a PERSONNE à nommer. Afficher
// « Reserved » comme nom de voyageur ferait croire à un contact qui n'existe pas.
const NOT_A_NAME = [
  'reserved', 'reservation', 'not available', 'unavailable', 'blocked', 'closed',
  'closed - not available', 'airbnb (not available)', 'booked', 'busy', 'indisponible',
];

/**
 * Nom du voyageur affichable, ou undefined. Le SUMMARY d'un iCal Airbnb vaut
 * « Reserved » : ce n'est pas un nom, c'est l'absence de nom.
 */
export function displayableGuestName(summary?: string | null): string | undefined {
  const s = (summary ?? '').trim();
  if (!s) return undefined;
  const bare = s.toLowerCase().replace(/[()]/g, '').trim();
  if (NOT_A_NAME.some(n => bare === n || bare.startsWith(n + ' -') || bare.startsWith(n + ' ·'))) return undefined;
  // Les connecteurs PMS composent « Nom · 3 pers. » : on ne garde que le nom.
  const name = s.split('·')[0].trim();
  if (!name || NOT_A_NAME.includes(name.toLowerCase())) return undefined;
  return name;
}

/** Numéro composable (tel:) — espaces et séparateurs retirés, + conservé. */
export function dialablePhone(phone?: string | null): string | undefined {
  const raw = (phone ?? '').trim();
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^\d+]/g, '');
  // Un numéro français fait 10 chiffres, l'international jusqu'à 15 (E.164).
  const digits = cleaned.replace(/\D/g, '');
  if (digits.length < 6 || digits.length > 15) return undefined;
  return cleaned;
}
