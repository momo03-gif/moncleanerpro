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
    icalUrl: r.ical_url,
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

const FEED_SELECT = '*, airbnbs(name)';
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

export async function createReservationFeed(fields: {
  airbnbId: string; partnerId?: string; platform: string; icalUrl: string; label?: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('reservation_feeds').insert({
    airbnb_id: fields.airbnbId,
    partner_id: fields.partnerId || null,
    platform: fields.platform,
    ical_url: fields.icalUrl.trim(),
    label: fields.label || null,
  });
  if (error) console.error('createReservationFeed:', error.code, error.message);
  return { error: error?.message ?? null };
}

export async function updateReservationFeed(id: string, fields: {
  platform?: string; icalUrl?: string; label?: string; active?: boolean;
}): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = {};
  if (fields.platform !== undefined) patch.platform = fields.platform;
  if (fields.icalUrl !== undefined) patch.ical_url = fields.icalUrl.trim();
  if (fields.label !== undefined) patch.label = fields.label || null;
  if (fields.active !== undefined) patch.active = fields.active;
  const { error } = await supabase.from('reservation_feeds').update(patch).eq('id', id);
  if (error) console.error('updateReservationFeed:', error.code, error.message);
  return { error: error?.message ?? null };
}

export async function deleteReservationFeed(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('reservation_feeds').delete().eq('id', id);
  if (error) console.error('deleteReservationFeed:', error.code, error.message);
  return { error: error?.message ?? null };
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
