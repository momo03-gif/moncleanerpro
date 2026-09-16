// ── « La clé n'est pas dans la boîte » : lecture des contacts ─────────────────
//
// Deux enrichissements DÉCOUPLÉS du chargement des missions, sur le modèle de la
// vidéo d'accès (siteVideos.ts) : une requête dédiée, et si la migration n'est
// pas jouée ou la requête échoue, on rend une table vide. Le planning du cleaner
// ne doit jamais tomber parce qu'un contact manque.
//
//   · getSiteContactsMap  → qui appeler pour CE LOGEMENT (propriétaire,
//     conciergerie, gardien). Marche toujours, c'est le recours principal.
//   · getMissionGuestsMap → le voyageur de CE MÉNAGE, tel que la plateforme
//     l'a livré. Jamais complet en iCal (cf. guestContact.ts).
//
// ⚠️ Le contact du voyageur est une donnée personnelle : il n'est lu que pour
// les missions du cleaner qui les consulte, et n'est repris nulle part ailleurs.

import { supabase } from './supabase';
import { displayableGuestName, dialablePhone } from './guestContact';

export interface SiteContact {
  name?: string;
  /** Numéro composable (tel:), ou absent si ce qui est saisi n'en est pas un. */
  phone?: string;
}

export interface GuestContact {
  name?: string;
  phone?: string;
  /** iCal Airbnb : on ne connaît que la fin du numéro. */
  phoneLast4?: string;
  /** Lien vers la réservation — ouvre la conversation avec le voyageur. */
  reservationUrl?: string;
}

/** Contact de secours de chaque logement demandé. */
export async function getSiteContactsMap(airbnbIds: string[]): Promise<Record<string, SiteContact>> {
  const ids = Array.from(new Set(airbnbIds.filter(Boolean)));
  if (ids.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('airbnbs').select('id, on_site_contact_name, on_site_contact_phone').in('id', ids);
    if (error) return {};
    const map: Record<string, SiteContact> = {};
    for (const r of data ?? []) {
      const row = r as { id: string; on_site_contact_name?: string; on_site_contact_phone?: string };
      const name = row.on_site_contact_name?.trim() || undefined;
      const phone = dialablePhone(row.on_site_contact_phone);
      if (name || phone) map[row.id] = { name, phone };
    }
    return map;
  } catch {
    return {};
  }
}

/** Voyageur rattaché à chaque mission demandée (quand la source le fournit). */
export async function getMissionGuestsMap(missionIds: string[]): Promise<Record<string, GuestContact>> {
  const ids = Array.from(new Set(missionIds.filter(Boolean)));
  if (ids.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('reservations')
      .select('mission_id, guest_name, guest_phone, guest_phone_last4, reservation_url')
      .in('mission_id', ids)
      .eq('status', 'confirmed');
    if (error) return {};

    const map: Record<string, GuestContact> = {};
    for (const r of data ?? []) {
      const row = r as {
        mission_id: string; guest_name?: string; guest_phone?: string;
        guest_phone_last4?: string; reservation_url?: string;
      };
      const contact: GuestContact = {
        name: displayableGuestName(row.guest_name),
        phone: dialablePhone(row.guest_phone),
        phoneLast4: row.guest_phone_last4 || undefined,
        reservationUrl: row.reservation_url || undefined,
      };
      if (!contact.name && !contact.phone && !contact.phoneLast4 && !contact.reservationUrl) continue;

      // Un ménage peut couvrir plusieurs réservations (logement à deux
      // calendriers, maison à annonces multiples). On garde la plus utile :
      // celle qui porte un vrai numéro l'emporte sur celle qui n'a qu'un nom.
      const kept = map[row.mission_id];
      if (!kept || (!kept.phone && contact.phone)) map[row.mission_id] = contact;
    }
    return map;
  } catch {
    return {};
  }
}
