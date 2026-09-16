// ── Descriptions des connecteurs REST — SERVEUR UNIQUEMENT ───────────────────
//
// Une entrée = un logiciel branché par clé API. Le code commun vit dans rest.ts ;
// ici, il n'y a que ce qui change d'un éditeur à l'autre.
//
// HONNÊTETÉ SUR CE QUI EST PROUVÉ ET CE QUI NE L'EST PAS
//
// `verified: true`  → forme confirmée contre un vrai compte (Smoobu, Hostaway,
//                     Beds24, Lodgify : connecteurs dédiés, hors de ce fichier).
// `verified: false` → forme décrite d'après ce que l'éditeur publie, mais jamais
//                     exécutée contre un compte réel. Ce n'est PAS un pari
//                     dangereux, pour une raison précise : on ne peut pas
//                     enregistrer une connexion sans avoir d'abord TESTÉ la clé
//                     (le parcours liste les logements du compte avant de
//                     laisser choisir). Si la description est fausse, l'essai
//                     échoue devant l'utilisateur, avec le message de l'éditeur,
//                     et il repart sur le lien de calendrier. Rien ne se crée
//                     en silence, aucun ménage n'est planifié de travers.
//
// Corriger une description quand un vrai compte dit le contraire = modifier
// l'objet ci-dessous, et rien d'autre.
//
// Les éditeurs absents de ce fichier le sont pour une raison, pas par oubli :
//   · Octorate, Smily/BookingSync → OAuth2 « autorisation » : il faut renvoyer
//     l'utilisateur sur un écran de consentement chez l'éditeur, donc un vrai
//     aller-retour web que le socle ne fait pas (encore).
//   · Avantio, Rentals United → API en SOAP/XML, pas en JSON.
//   · eviivo, Amenitiz, Elloha → accès réservé à un programme partenaire.
// Pour tous ceux-là, le lien iCal reste la voie, et elle marche.

import { defineRestPms, basicAuth, type RestPmsDescriptor } from './rest';
import type { FieldNames } from './normalize';

// La plupart des éditeurs nomment leurs champs de la même famille de façons.
// normalize.ts accepte déjà les variantes ; on part de ce socle commun.
const COMMON_FIELDS: FieldNames = {
  id: ['id', 'uuid', 'bookingId', 'reservationId', 'code'],
  arrival: ['arrival', 'arrivalDate', 'checkIn', 'check_in', 'checkin', 'start_date', 'startDate', 'from'],
  departure: ['departure', 'departureDate', 'checkOut', 'check_out', 'checkout', 'end_date', 'endDate', 'to'],
  arrivalTime: ['arrivalTime', 'checkInTime', 'check_in_time', 'checkin_time'],
  departureTime: ['departureTime', 'checkOutTime', 'check_out_time', 'checkout_time'],
  status: ['status', 'state', 'bookingStatus'],
};

export const REST_PMS: RestPmsDescriptor[] = [
  {
    // Hostify — CONFIRMÉ sur un compte réel (Les Cocons Lyonnais, 09/2026).
    // Trois choses que seule une vraie clé pouvait apprendre :
    //
    //  1. `start_date`/`end_date` ne filtrent pas : ils VIDENT le résultat.
    //     Aucun filtre de période côté serveur, donc ; on borne localement.
    //  2. Hostify plafonne à 100 lignes par page quoi qu'on demande, et range
    //     les réservations de la PLUS ANCIENNE à la plus récente. Sans
    //     pagination, un logement à 327 réservations ne montrait que 2023-2025
    //     et jamais les séjours à venir — donc aucun ménage créé.
    //  3. Les statuts réels sont `accepted`, `cancelled`, `expired`, `voided`,
    //     `timedout`, `inquiry` (cf. normalize.ts, qui les départage).
    id: 'hostify',
    label: 'Hostify',
    base: 'https://api-rms.hostify.com',
    auth: creds => ({ 'x-api-key': creds.apiKey }),
    listings: {
      path: '/listings',
      params: () => ({ per_page: 200 }),
      collection: ['listings'],
      // Une clé de conciergerie ne voit pas tous ses logements ici (6 annoncés
      // sur 13 réellement exploités) : on complète avec ceux des réservations
      // récentes, sous le nom que Hostify leur donne (`listing_nickname`).
      alsoFromReservations: { idField: 'listing_id', nameField: 'listing_nickname', recentPages: 4 },
    },
    reservations: {
      path: '/reservations',
      propertyParam: 'listing_id',
      // Pas de fromParam/toParam : cf. point 1 ci-dessus.
      pagination: { pageParam: 'page', sizeParam: 'per_page', size: 100, maxPages: 25 },
      collection: ['reservations'],
      fields: {
        ...COMMON_FIELDS,
        // Hostify écrit `checkIn`/`checkOut`, et porte les horaires réels dans
        // `planned_arrival`/`planned_departure` quand l'hôte les a saisis.
        arrivalTime: ['planned_arrival', ...COMMON_FIELDS.arrivalTime],
        departureTime: ['planned_departure', ...COMMON_FIELDS.departureTime],
      },
      propertyIdFields: ['listing_id', 'listingId'],
    },
    verified: true,
  },
  {
    // Hospitable — jeton personnel (Personal Access Token) créé par l'hôte
    // lui-même dans son compte, en-tête Bearer.
    id: 'hospitable',
    label: 'Hospitable',
    base: 'https://public.api.hospitable.com/v2',
    auth: creds => ({ Authorization: `Bearer ${creds.apiKey}` }),
    listings: { path: '/properties', params: () => ({ per_page: 100 }) },
    reservations: {
      path: '/reservations',
      propertyParam: 'properties[]',
      fromParam: 'start_date',
      toParam: 'end_date',
      extra: { per_page: 100 },
      fields: COMMON_FIELDS,
      propertyIdFields: ['property_id', 'propertyId'],
    },
    verified: false,
  },
  {
    // OwnerRez — authentification « Basic » : identifiant du compte + jeton
    // d'accès personnel. Le secret porte donc ici le jeton.
    id: 'ownerrez',
    label: 'OwnerRez',
    base: 'https://api.ownerreservations.com/v2',
    auth: creds => basicAuth(creds.apiKey, creds.apiSecret ?? ''),
    listings: { path: '/properties', params: () => ({ limit: 100 }) },
    reservations: {
      path: '/bookings',
      propertyParam: 'property_ids',
      fromParam: 'from',
      toParam: 'to',
      extra: { limit: 100, include_cancelled: 'false' },
      fields: COMMON_FIELDS,
      propertyIdFields: ['property_id', 'propertyId'],
    },
    verified: false,
  },
  {
    // Hostfully — en-tête propriétaire X-HOSTFULLY-APIKEY, documenté
    // publiquement. Les logements sont rattachés à une « agency », dont
    // l'identifiant est demandé en second champ.
    id: 'hostfully',
    label: 'Hostfully',
    base: 'https://api.hostfully.com/v3',
    auth: creds => ({ 'X-HOSTFULLY-APIKEY': creds.apiKey }),
    listings: {
      path: '/properties',
      params: creds => ({ agencyUuid: creds.apiSecret, limit: 100 }),
      idFields: ['uid', 'uuid', 'id'],
    },
    reservations: {
      path: '/leads',
      propertyParam: 'propertyUuid',
      fromParam: 'startDate',
      toParam: 'endDate',
      extra: { limit: 100 },
      fields: COMMON_FIELDS,
      propertyIdFields: ['propertyUuid', 'propertyUid'],
    },
    verified: false,
  },
  {
    // Guesty — le plus gros du marché. Pas de clé simple : un identifiant et un
    // secret d'application, échangés contre un jeton (OAuth2 « client
    // credentials »). C'est exactement la voie qu'empruntent les plateformes qui
    // s'y connectent.
    //
    // ⚠️ Guesty ne délivre que quelques jetons par 24 h et par application. Le
    // socle conserve donc le jeton dans le flux et ne le renouvelle qu'avant
    // expiration — sinon on couperait au client l'accès à son propre compte.
    id: 'guesty',
    label: 'Guesty',
    base: 'https://open-api.guesty.com/v1',
    auth: () => ({}),                 // tout passe par le jeton
    oauth2: {
      tokenUrl: 'https://open-api.guesty.com/oauth2/token',
      body: creds => ({
        grant_type: 'client_credentials',
        scope: 'open-api',
        clientId: creds.apiKey,
        clientSecret: creds.apiSecret ?? '',
      }),
      earlyRefreshSec: 600,
    },
    listings: { path: '/listings', params: () => ({ limit: 100 }), collection: ['results'] },
    reservations: {
      path: '/reservations',
      propertyParam: 'listingId',
      fromParam: 'checkInDateFrom',
      toParam: 'checkInDateTo',
      extra: { limit: 100 },
      collection: ['results'],
      fields: COMMON_FIELDS,
      propertyIdFields: ['listingId', 'listing_id'],
    },
    verified: false,
  },
  {
    // Uplisting — clé d'API en authentification « Basic » (la clé tient lieu
    // d'identifiant, le mot de passe est vide).
    id: 'uplisting',
    label: 'Uplisting',
    base: 'https://connect.uplisting.io',
    auth: creds => basicAuth(creds.apiKey, ''),
    listings: { path: '/properties' },
    reservations: {
      path: '/bookings',
      propertyParam: 'property_id',
      fromParam: 'check_in_from',
      toParam: 'check_in_to',
      fields: COMMON_FIELDS,
      propertyIdFields: ['property_id', 'propertyId'],
    },
    verified: false,
  },
];

/** Les deux fonctions de chaque connecteur, prêtes à l'emploi. */
export const REST_CONNECTORS = Object.fromEntries(
  REST_PMS.map(d => [d.id, { descriptor: d, ...defineRestPms(d) }]),
);

export function restConnector(id: string) {
  return REST_CONNECTORS[id];
}

/** Un connecteur dont la forme n'a pas encore été confirmée par un vrai compte. */
export function isUnverifiedPms(id: string | null | undefined): boolean {
  return !!id && REST_CONNECTORS[id]?.descriptor.verified === false;
}
