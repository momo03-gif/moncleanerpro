// ── Synchronisation des réservations (conciergeries / partenaires Airbnb) ─────────
// Extrait de db.ts. Lecture/écriture via le client (clé publique) ; le fetch des
// iCal et la création des missions se font côté serveur (routes API → service_role).

import { supabase } from '../supabase';
import { trimTime } from './shared';
import type { ReservationFeed, Reservation } from '../types';

function rowToFeed(r: any): ReservationFeed {
  return {
    id: r.id,
    airbnbId: r.airbnb_id,
    apartmentName: r.airbnbs?.name ?? undefined,
    partnerId: r.partner_id ?? undefined,
    platform: r.platform,
    icalUrl: r.ical_url ?? '',
    // Comment ce flux est alimenté. Les identifiants API eux-mêmes ne quittent
    // jamais le serveur : seul le fait qu'une connexion existe est exposé.
    connectionKind: r.connection_kind === 'api' ? 'api' : 'ical',
    externalPropertyId: r.external_property_id ?? undefined,
    label: r.label ?? undefined,
    active: r.active ?? true,
    lastSyncAt: r.last_sync_at ?? undefined,
    lastSyncStatus: r.last_sync_status ?? undefined,
    lastError: r.last_error ?? undefined,
    createdAt: r.created_at ?? undefined,
  };
}

function rowToReservation(r: any): Reservation {
  return {
    id: r.id,
    feedId: r.feed_id ?? undefined,
    airbnbId: r.airbnb_id,
    apartmentName: r.airbnbs?.name ?? undefined,
    partnerId: r.partner_id ?? undefined,
    platform: r.platform,
    externalUid: r.external_uid,
    guestName: r.guest_name ?? undefined,
    status: r.status,
    checkIn: r.check_in ?? '',
    checkOut: r.check_out ?? '',
    checkInTime: r.check_in_time ? trimTime(r.check_in_time) : undefined,
    checkOutTime: r.check_out_time ? trimTime(r.check_out_time) : undefined,
    missionId: r.mission_id ?? undefined,
    missionCreatedAt: r.mission_created_at ?? undefined,
    createdAt: r.created_at ?? undefined,
  };
}

// ⚠️ Colonnes EXPLICITES, pas d'étoile : depuis la connexion par API, cette table
// contient `api_key` et `api_secret`. Un `select *` les enverrait au navigateur.
// `connection_kind` et `external_property_id` sont sûrs (ils ne servent qu'à
// afficher « connecté par API ») ; les identifiants eux-mêmes ne sortent jamais
// du serveur. Ne pas remettre d'étoile ici.
const FEED_SELECT = 'id, airbnb_id, partner_id, platform, ical_url, label, active, '
  + 'last_sync_at, last_sync_status, last_error, created_at, '
  + 'connection_kind, external_property_id, airbnbs(name)';
const RESERVATION_SELECT = '*, airbnbs(name)';

// Flux d'un partenaire (ou tous, pour l'admin).
export async function getReservationFeedsForPartner(userId: string): Promise<ReservationFeed[]> {
  const { data, error } = await supabase.from('reservation_feeds').select(FEED_SELECT)
    .eq('partner_id', userId).order('created_at');
  if (error) console.error('getReservationFeedsForPartner:', error.code, error.message);
  return (data ?? []).map(rowToFeed);
}

export async function getAllReservationFeeds(): Promise<ReservationFeed[]> {
  const { data, error } = await supabase.from('reservation_feeds').select(FEED_SELECT).order('created_at');
  if (error) console.error('getAllReservationFeeds:', error.code, error.message);
  return (data ?? []).map(rowToFeed);
}

// ── Écritures : par le serveur, jamais par le navigateur ─────────────────────
// Cette table porte les clés API des conciergeries — une clé Hostify ouvre tout
// le compte de gestion du client. Les écritures passent donc par
// /api/reservations/feeds, qui vérifie la session et la propriété du logement ;
// en base, le rôle public n'a plus le droit d'écrire ni de lire les colonnes
// secrètes (cf. supabase/migration_feeds_verrouillage.sql).
async function ecrireFlux(payload: Record<string, unknown>): Promise<{ error: string | null }> {
  try {
    const res = await fetch('/api/reservations/feeds', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return { error: res.ok ? null : (data.error ?? 'Enregistrement impossible.') };
  } catch {
    return { error: 'Connexion impossible. Réessayez.' };
  }
}

/**
 * Un logement peut porter PLUSIEURS calendriers — c'est le cas normal du
 * propriétaire sans PMS qui loue sur Airbnb, Booking et Abritel à la fois. Les
 * départs des différents flux sont fusionnés en un seul ménage par date.
 * Ce qu'on refuse, c'est le MÊME lien deux fois sur le même logement (le
 * contrôle est fait côté serveur, où il ne peut pas être contourné).
 */
export async function createReservationFeed(fields: {
  airbnbId: string; partnerId?: string; platform: string; icalUrl: string; label?: string;
}): Promise<{ error: string | null }> {
  return ecrireFlux({
    action: 'create', airbnbId: fields.airbnbId,
    platform: fields.platform, icalUrl: fields.icalUrl, label: fields.label ?? null,
  });
}

export async function updateReservationFeed(id: string, fields: {
  platform?: string; icalUrl?: string; label?: string; active?: boolean;
}): Promise<{ error: string | null }> {
  return ecrireFlux({ action: 'update', feedId: id, ...fields });
}

/**
 * Réservations qui disparaîtront avec ce flux. Les réservations sont une
 * PROJECTION du calendrier externe : sans le flux, elles ne seraient plus jamais
 * mises à jour. On les supprime donc avec lui (ON DELETE CASCADE), et on
 * annonce le nombre avant d'agir — c'est la seule chose honnête à faire.
 */
export async function countReservationsForFeed(feedId: string): Promise<number> {
  const { count, error } = await supabase
    .from('reservations').select('id', { count: 'exact', head: true }).eq('feed_id', feedId);
  if (error) { console.error('countReservationsForFeed:', error.message); return 0; }
  return count ?? 0;
}

export async function deleteReservationFeed(id: string): Promise<{ error: string | null }> {
  return ecrireFlux({ action: 'delete', feedId: id });
}

// Réservations d'un partenaire (tableau « Réservations synchronisées »).
export async function getReservationsForPartner(userId: string): Promise<Reservation[]> {
  const { data, error } = await supabase.from('reservations').select(RESERVATION_SELECT)
    .eq('partner_id', userId).order('check_out', { ascending: false });
  if (error) console.error('getReservationsForPartner:', error.code, error.message);
  return (data ?? []).map(rowToReservation);
}

// Toutes les réservations (vue admin occupation).
export async function getAllReservations(): Promise<Reservation[]> {
  const { data, error } = await supabase.from('reservations').select(RESERVATION_SELECT)
    .order('check_out', { ascending: false });
  if (error) console.error('getAllReservations:', error.code, error.message);
  return (data ?? []).map(rowToReservation);
}
