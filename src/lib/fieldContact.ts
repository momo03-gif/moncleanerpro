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
import { dialablePhone } from './guestContact';

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

/**
 * Voyageur rattaché à chaque mission demandée (quand la source le fournit).
 *
 * Passe par le serveur : le nom et le téléphone des voyageurs ne sont plus
 * lisibles avec la clé publique, et la route ne rend que les ménages qui
 * appartiennent au demandeur — cleaner assigné, partenaire propriétaire, ou
 * admin. Un ménage terminé ne rend rien : un numéro n'a pas à traîner dans
 * l'historique.
 */
export async function getMissionGuestsMap(missionIds: string[]): Promise<Record<string, GuestContact>> {
  const ids = Array.from(new Set(missionIds.filter(Boolean)));
  if (ids.length === 0) return {};
  try {
    const res = await fetch('/api/reservations/contacts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missionIds: ids }),
    });
    if (!res.ok) return {};
    const data = await res.json().catch(() => ({}));
    return (data.contacts ?? {}) as Record<string, GuestContact>;
  } catch {
    return {};
  }
}
