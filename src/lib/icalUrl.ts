// ── Lien iCal : normalisation et reconnaissance de la plateforme ──────────────
//
// Connecter un calendrier ne devrait demander qu'UN geste : coller le lien. La
// plateforme se déduit du lien lui-même — personne n'a envie de la choisir dans
// une liste déroulante après l'avoir copié depuis Airbnb.
//
// Pur (aucun I/O) : la vérification réelle du lien se fait côté serveur
// (/api/reservations/check), qui télécharge et parse le calendrier.

import type { ReservationPlatform } from './types';

/** webcal:// → https://, espaces et guillemets parasites retirés. */
export function normalizeIcalUrl(raw: string): string {
  return raw
    .trim()
    .replace(/^["'<]+|["'>]+$/g, '')
    .replace(/^webcal:\/\//i, 'https://');
}

// Signature d'hôte → plateforme. L'ordre compte peu : les hôtes sont distincts.
const HOST_SIGNATURES: { match: RegExp; platform: ReservationPlatform }[] = [
  { match: /(^|\.)airbnb\.[a-z.]+$/i,        platform: 'airbnb' },
  { match: /(^|\.)booking\.com$/i,           platform: 'booking' },
  { match: /(^|\.)guesty\.com$/i,            platform: 'guesty' },
  { match: /(^|\.)hostaway\.com$/i,          platform: 'hostaway' },
  { match: /(^|\.)lodgify\.com$/i,           platform: 'lodgify' },
  { match: /(^|\.)smoobu\.com$/i,            platform: 'smoobu' },
  { match: /(^|\.)beds24\.com$/i,            platform: 'beds24' },
  { match: /(^|\.)amenitiz\.(io|com)$/i,     platform: 'amenitiz' },
  // Vrbo/Abritel passent par HomeAway : pas de plateforme dédiée chez nous,
  // le flux iCal générique fait le travail.
  { match: /(^|\.)(vrbo|abritel|homeaway)\.[a-z.]+$/i, platform: 'ical' },
];

/**
 * Déduit la plateforme d'une URL iCal. Renvoie 'ical' quand l'hôte n'est pas
 * reconnu (un flux .ics inconnu reste parfaitement exploitable), et undefined
 * quand l'URL n'est pas exploitable du tout.
 */
export function detectPlatform(raw: string): ReservationPlatform | undefined {
  const url = normalizeIcalUrl(raw);
  let host: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
    host = parsed.hostname;
  } catch {
    return undefined;
  }
  return HOST_SIGNATURES.find(s => s.match.test(host))?.platform ?? 'ical';
}

/** Une URL exploitable : http(s), et qui ressemble à un export de calendrier. */
export function isLikelyIcalUrl(raw: string): boolean {
  const url = normalizeIcalUrl(raw);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    // Airbnb : /calendar/ical/12345.ics?s=… — l'extension est bien présente.
    // Certains PMS servent le calendrier sans extension : on accepte aussi les
    // chemins/paramètres qui annoncent un calendrier.
    const haystack = (parsed.pathname + parsed.search).toLowerCase();
    return haystack.includes('.ics') || haystack.includes('ical') || haystack.includes('calendar');
  } catch {
    return false;
  }
}

/** Message d'aide propre à la plateforme détectée (où trouver le lien). */
export const PLATFORM_HELP: Record<string, string> = {
  airbnb:   'Airbnb → votre annonce → Disponibilité → Synchroniser les calendriers → Exporter le calendrier.',
  booking:  'Booking.com → Extranet → Tarifs et disponibilités → Synchro calendrier → Exporter.',
  guesty:   'Guesty → Listing → Calendar → iCal export link.',
  hostaway: 'Hostaway → Listing → Channel Manager → iCal export.',
  lodgify:  'Lodgify → Calendar → Import/Export → Export calendar (.ics).',
  smoobu:   'Smoobu → Logement → Channel manager → Exporter (iCal).',
  beds24:   'Beds24 → Settings → Sync → Export calendar (iCal).',
  amenitiz: 'Amenitiz → Channel manager → Synchronisation iCal → Lien d’export.',
  ical:     'Cherchez « exporter le calendrier » ou « iCal » dans votre outil de réservation.',
  other:    'Cherchez « exporter le calendrier » ou « iCal » dans votre outil de réservation.',
};
