// ── Sources de réservations prises en charge ──────────────────────────────────
//
// SOURCE DE VÉRITÉ UNIQUE. Ce fichier décrit toutes les plateformes et tous les
// logiciels que l'on sait brancher, et c'est lui que lisent : la détection du
// lien collé (icalUrl.ts), l'écran de connexion partenaire, la vue admin et la
// route API. Ajouter une source = une entrée ici, nulle part ailleurs.
//
// Deux voies pour brancher une source :
//
//   · LE LIEN iCAL — universel. Tous les logiciels de location saisonnière
//     savent exporter un calendrier. C'est la réponse à « n'importe quel
//     logiciel » : il n'y a aucun cas où ça ne marche pas. Même un logiciel
//     absent de cette liste se connecte — il retombe sur « Flux iCal » et se
//     synchronise exactement pareil. Ce qu'apporte une entrée nommée ici, c'est
//     la reconnaissance automatique du lien et l'aide « où le trouver ».
//     Limite : des dates seulement.
//
//   · LA CLÉ API — apporte en plus les heures d'arrivée et de départ (donc les
//     départs tardifs), le nom du voyageur et le nombre de personnes. Mais
//     chaque éditeur a sa propre API : il faut un connecteur par logiciel.
//     `api: false` = pas de connecteur écrit, et on le dit honnêtement à l'écran
//     plutôt que d'enregistrer une clé que la synchro ne saurait pas lire.
//
// Ajouter une API = un connecteur dans ce dossier + `api: {…}` ici + une ligne
// dans PMS_FETCHERS (reservationSync.ts) et PMS_LISTERS (api/reservations/pms).

import type { ReservationPlatform } from '../types';

export interface PmsCredentialField {
  name: 'apiKey' | 'apiSecret';
  label: string;
  secret?: boolean;   // masqué à la saisie
}

/**
 * `marketplace` : le site de réservation lui-même (Airbnb, Booking…).
 * `pms`         : le logiciel de gestion de la conciergerie.
 * `generic`     : les deux filets de sécurité — un flux iCal quelconque, ou un
 *                 logiciel qu'on ne connaît pas encore. Jamais détecté, jamais
 *                 proposé dans la liste des logiciels : servent d'étiquette.
 */
export type SourceKind = 'marketplace' | 'pms' | 'generic';

export interface PmsDefinition {
  id: ReservationPlatform;
  label: string;
  kind: SourceKind;
  /** Hôtes reconnus dans un lien collé → détection automatique de la source. */
  hosts?: RegExp[];
  /** Où trouver le lien d'export iCal (toujours disponible). */
  icalHelp: string;
  /** Connexion API : false tant qu'aucun connecteur n'existe. */
  api: false | {
    fields: PmsCredentialField[];
    /** Où générer la clé, dans les mots de l'éditeur. */
    help: string;
    /**
     * `false` = forme de l'API décrite d'après ce que l'éditeur publie, mais
     * jamais confirmée contre un vrai compte. Le parcours de connexion le dit,
     * et la clé est testée avant d'être enregistrée : si c'est faux, l'essai
     * échoue devant l'utilisateur et il repart sur le lien de calendrier.
     * Doit rester aligné avec le descripteur (cf. pms/catalog.ts).
     */
    verified?: boolean;
  };
}

export const PMS_LIST: PmsDefinition[] = [
  // ── Les plateformes de réservation ─────────────────────────────────────────
  // Aucune n'ouvre son API sans programme partenaire : l'iCal est la voie, et
  // elle suffit (ces calendriers ne portent de toute façon que des dates).
  {
    id: 'airbnb',
    label: 'Airbnb',
    kind: 'marketplace',
    hosts: [/(^|\.)airbnb\.[a-z.]+$/i],
    icalHelp: 'Airbnb → votre annonce → Disponibilité → Synchroniser les calendriers → Exporter le calendrier.',
    api: false,
  },
  {
    id: 'booking',
    label: 'Booking.com',
    kind: 'marketplace',
    hosts: [/(^|\.)booking\.com$/i],
    icalHelp: 'Booking.com → Extranet → Tarifs et disponibilités → Synchro calendrier → Exporter.',
    api: false,
  },
  {
    id: 'vrbo',
    label: 'Vrbo / Abritel',
    kind: 'marketplace',
    hosts: [/(^|\.)(vrbo|abritel|homeaway|fewo-direkt)\.[a-z.]+$/i],
    icalHelp: 'Vrbo/Abritel → Calendrier → Importer/Exporter → Exporter le calendrier (.ics).',
    api: false,
  },
  {
    id: 'expedia',
    label: 'Expedia',
    kind: 'marketplace',
    hosts: [/(^|\.)expedia\.[a-z.]+$/i],
    icalHelp: 'Expedia Partner Central → Calendrier → Synchronisation iCal → lien d’export.',
    api: false,
  },

  // ── Les logiciels avec connecteur API écrit ────────────────────────────────
  {
    id: 'smoobu',
    label: 'Smoobu',
    kind: 'pms',
    hosts: [/(^|\.)smoobu\.com$/i],
    icalHelp: 'Smoobu → Logement → Channel manager → Exporter (iCal).',
    api: {
      fields: [
        { name: 'apiKey', label: 'Clé API (usr_live_…)' },
        { name: 'apiSecret', label: 'Secret', secret: true },
      ],
      help: 'Smoobu → Paramètres → API. Générez une clé, copiez la clé et le secret.',
    },
  },
  {
    id: 'hostaway',
    label: 'Hostaway',
    kind: 'pms',
    hosts: [/(^|\.)hostaway\.com$/i],
    icalHelp: 'Hostaway → Listing → Channel Manager → iCal export.',
    api: {
      fields: [
        { name: 'apiKey', label: 'Account ID' },
        { name: 'apiSecret', label: 'API key (secret)', secret: true },
      ],
      help: 'Hostaway → Settings → Hostaway API. Copiez l’Account ID et la clé secrète.',
    },
  },
  {
    id: 'beds24',
    label: 'Beds24',
    kind: 'pms',
    hosts: [/(^|\.)beds24\.com$/i],
    icalHelp: 'Beds24 → Settings → Sync → Export calendar (iCal).',
    api: {
      fields: [{ name: 'apiKey', label: 'Invite code ou refresh token' }],
      help: 'Beds24 → Settings → Account → Access. Créez un « invite code » avec les permissions lecture.',
    },
  },
  {
    id: 'lodgify',
    label: 'Lodgify',
    kind: 'pms',
    hosts: [/(^|\.)lodgify\.com$/i],
    icalHelp: 'Lodgify → Calendar → Import/Export → Export calendar (.ics).',
    api: {
      fields: [{ name: 'apiKey', label: 'Clé API' }],
      help: 'Lodgify → Paramètres → Public API. Copiez la clé.',
    },
  },

  // ── Les autres logiciels ───────────────────────────────────────────────────
  // Précision importante : `api: false` ne veut PAS dire « cet éditeur n'a pas
  // d'API ». Ils en ont tous une. Cela veut dire « nous n'avons pas encore de
  // connecteur pour lui ».
  //
  // Certains d'entre eux en ont reçu un depuis, bâti sur le socle REST commun
  // (cf. pms/catalog.ts) — ceux-là portent désormais `api: {…, verified: false}`.
  // Restent ici ceux qu'un socle REST ne suffit pas à brancher :
  //   · Octorate, Smily/BookingSync → OAuth2 avec écran de consentement ;
  //   · Avantio, Rentals United → API en SOAP/XML, pas en JSON ;
  //   · eviivo, Amenitiz, Elloha, Superhote → accès par programme partenaire.
  // Pour eux, l'iCal reste la voie, et elle fonctionne parfaitement : le lien est
  // reconnu tout seul et le ménage se crée exactement comme pour les autres.
  {
    id: 'guesty',
    label: 'Guesty',
    kind: 'pms',
    hosts: [/(^|\.)guesty\.com$/i],
    icalHelp: 'Guesty → Listing → Calendar → iCal export link.',
    api: {
      fields: [
        { name: 'apiKey', label: 'Client ID de l’intégration' },
        { name: 'apiSecret', label: 'Client Secret', secret: true },
      ],
      help: 'Guesty → Integrations → Guesty API → créez une intégration et copiez le Client ID et le Client Secret.',
      verified: false,
    },
  },
  {
    id: 'hostify',
    label: 'Hostify',
    kind: 'pms',
    hosts: [/(^|\.)hostify\.com$/i],
    icalHelp: 'Hostify → Logement → Calendrier → lien d’export iCal.',
    api: {
      fields: [{ name: 'apiKey', label: 'Clé API' }],
      help: 'Hostify → Paramètres → API (la clé est fournie par leur support si elle n’y figure pas).',
      verified: true,
    },
  },
  {
    id: 'superhote',
    label: 'Superhote',
    kind: 'pms',
    hosts: [/(^|\.)superhote\.com$/i],
    icalHelp: 'Superhote → Logement → Synchronisation → lien iCal.',
    api: false,
  },
  {
    id: 'amenitiz',
    label: 'Amenitiz',
    kind: 'pms',
    hosts: [/(^|\.)amenitiz\.(io|com)$/i],
    icalHelp: 'Amenitiz → Channel manager → Synchronisation iCal → lien d’export.',
    api: false,
  },
  {
    id: 'avantio',
    label: 'Avantio',
    kind: 'pms',
    hosts: [/(^|\.)avantio\.(com|es)$/i],
    icalHelp: 'Avantio → Logement → Calendrier → Synchronisation iCal → lien d’export.',
    api: false,
  },
  {
    id: 'smily',
    label: 'Smily (BookingSync)',
    kind: 'pms',
    hosts: [/(^|\.)(smily|bookingsync)\.(com|io)$/i],
    icalHelp: 'Smily → Logement → Calendrier → Exporter le calendrier (.ics).',
    api: false,
  },
  {
    id: 'hospitable',
    label: 'Hospitable',
    kind: 'pms',
    hosts: [/(^|\.)hospitable\.com$/i],
    icalHelp: 'Hospitable → Properties → Calendar → Export calendar link.',
    api: {
      fields: [{ name: 'apiKey', label: 'Jeton personnel (PAT)', secret: true }],
      help: 'Hospitable → Apps → API access → créez un « Personal Access Token » en lecture.',
      verified: false,
    },
  },
  {
    id: 'hostfully',
    label: 'Hostfully',
    kind: 'pms',
    hosts: [/(^|\.)hostfully\.com$/i],
    icalHelp: 'Hostfully → Property → Calendar → iCal export link.',
    api: {
      fields: [
        { name: 'apiKey', label: 'Clé API', secret: true },
        { name: 'apiSecret', label: 'Identifiant d’agence (agency UUID)' },
      ],
      help: 'Hostfully → Settings → API → demandez la clé, puis copiez l’UUID de votre agence.',
      verified: false,
    },
  },
  {
    id: 'uplisting',
    label: 'Uplisting',
    kind: 'pms',
    hosts: [/(^|\.)uplisting\.(io|com)$/i],
    icalHelp: 'Uplisting → Property → Calendar sync → Export calendar (.ics).',
    api: {
      fields: [{ name: 'apiKey', label: 'Clé API', secret: true }],
      help: 'Uplisting → Settings → Integrations → API key.',
      verified: false,
    },
  },
  {
    id: 'ownerrez',
    label: 'OwnerRez',
    kind: 'pms',
    hosts: [/(^|\.)ownerrez\.com$/i],
    icalHelp: 'OwnerRez → Property → Calendars → Export iCal feed.',
    api: {
      fields: [
        { name: 'apiKey', label: 'Identifiant du compte (e-mail)' },
        { name: 'apiSecret', label: 'Jeton d’accès', secret: true },
      ],
      help: 'OwnerRez → Settings → API → Personal Access Token.',
      verified: false,
    },
  },
  {
    id: 'octorate',
    label: 'Octorate',
    kind: 'pms',
    hosts: [/(^|\.)octorate\.com$/i],
    icalHelp: 'Octorate → Chambre → Channel manager → Export iCal.',
    api: false,
  },
  {
    id: 'eviivo',
    label: 'eviivo',
    kind: 'pms',
    hosts: [/(^|\.)eviivo\.com$/i],
    icalHelp: 'eviivo suite → Calendrier → Synchronisation iCal → lien d’export.',
    api: false,
  },
  {
    id: 'elloha',
    label: 'Elloha',
    kind: 'pms',
    hosts: [/(^|\.)elloha\.com$/i],
    icalHelp: 'Elloha → Hébergement → Planning → Synchronisation iCal → lien d’export.',
    api: false,
  },
  {
    id: 'rentalsunited',
    label: 'Rentals United',
    kind: 'pms',
    hosts: [/(^|\.)rentalsunited\.com$/i],
    icalHelp: 'Rentals United → Property → Calendar → iCal export.',
    api: false,
  },
  {
    id: 'zeevou',
    label: 'Zeevou',
    kind: 'pms',
    hosts: [/(^|\.)zeevou\.com$/i],
    icalHelp: 'Zeevou → Unit → Calendar sync → Export iCal link.',
    api: false,
  },
  {
    id: 'tokeet',
    label: 'Tokeet',
    kind: 'pms',
    hosts: [/(^|\.)tokeet\.com$/i],
    icalHelp: 'Tokeet → Rental → Calendar → Export iCal feed.',
    api: false,
  },

  // ── Les filets de sécurité ────────────────────────────────────────────────
  // Un logiciel absent de la liste n'est jamais un cul-de-sac : son lien .ics
  // est accepté tel quel et se synchronise comme les autres.
  {
    id: 'ical',
    label: 'Flux iCal',
    kind: 'generic',
    icalHelp: 'Cherchez « exporter le calendrier » ou « iCal » dans votre outil de réservation.',
    api: false,
  },
  {
    id: 'other',
    label: 'Autre logiciel',
    kind: 'generic',
    icalHelp: 'Cherchez « exporter le calendrier » ou « iCal » dans votre outil de réservation.',
    api: false,
  },
];

export function findPms(id: string | null | undefined): PmsDefinition | undefined {
  return PMS_LIST.find(p => p.id === id);
}

/** Nom lisible d'une source — jamais vide : un identifiant inconnu se montre tel quel. */
export function platformLabel(id: string | null | undefined): string {
  return findPms(id)?.label ?? (id || '—');
}

/** Logiciels avec lesquels on sait parler par API (les seuls proposés à l'écran). */
export function pmsWithApi(): PmsDefinition[] {
  return PMS_LIST.filter(p => p.api !== false);
}

/** La connexion API est-elle réellement branchée pour ce logiciel ? */
export function supportsApi(id: string | null | undefined): boolean {
  return findPms(id)?.api !== false && !!findPms(id);
}

/**
 * Les logiciels proposés dans « Votre logiciel » (écran de connexion par clé) :
 * les PMS, ceux qu'on sait lire d'abord, puis « Autre logiciel » pour ceux qui
 * ne trouvent pas le leur. Les plateformes de réservation n'y figurent pas :
 * elles n'ouvrent leur API à personne, leur voie est le lien de calendrier.
 */
export function pmsSelectable(): PmsDefinition[] {
  const pms = PMS_LIST.filter(p => p.kind === 'pms');
  return [
    ...pms.filter(p => p.api !== false),
    ...pms.filter(p => p.api === false),
    ...PMS_LIST.filter(p => p.id === 'other'),
  ];
}

/** Sources reconnaissables depuis un lien collé (celles qui déclarent des hôtes). */
export function detectableSources(): { platform: ReservationPlatform; hosts: RegExp[] }[] {
  return PMS_LIST.filter(p => p.hosts?.length).map(p => ({ platform: p.id, hosts: p.hosts! }));
}
