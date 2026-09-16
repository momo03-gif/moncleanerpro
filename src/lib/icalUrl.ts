// ── Lien iCal : normalisation et reconnaissance de la plateforme ──────────────
//
// Connecter un calendrier ne devrait demander qu'UN geste : coller le lien. La
// plateforme se déduit du lien lui-même — personne n'a envie de la choisir dans
// une liste déroulante après l'avoir copié depuis Airbnb.
//
// Pur (aucun I/O) : la vérification réelle du lien se fait côté serveur
// (/api/reservations/check), qui télécharge et parse le calendrier.

import type { ReservationPlatform } from './types';
import { detectableSources, PMS_LIST } from './pms/registry';

/** webcal:// → https://, espaces et guillemets parasites retirés. */
export function normalizeIcalUrl(raw: string): string {
  return raw
    .trim()
    .replace(/^["'<]+|["'>]+$/g, '')
    .replace(/^webcal:\/\//i, 'https://');
}

// Signature d'hôte → source. La table vient du registre : ajouter une
// plateforme ou un logiciel là-bas suffit pour que son lien soit reconnu ici.
const HOST_SIGNATURES: { match: RegExp; platform: ReservationPlatform }[] =
  detectableSources().flatMap(s => s.hosts.map(match => ({ match, platform: s.platform })));

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

/**
 * Message d'aide propre à la source détectée (où trouver le lien). Dérivé du
 * registre : une source ajoutée là-bas apporte son aide avec elle.
 */
export const PLATFORM_HELP: Record<string, string> =
  Object.fromEntries(PMS_LIST.map(p => [p.id, p.icalHelp]));
