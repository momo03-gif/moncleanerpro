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

/** Ce que la route « terrain » rend pour un ménage. */
export interface TerrainInfo {
  portalCode?: string;
  keyboxCode?: string;
  entryInstructions?: string;
  apartmentNotes?: string;
  accessVideoUrl?: string;
  siteContact?: SiteContact;
  guest?: GuestContact;
}

/**
 * Tout ce qu'il faut pour entrer dans un logement, en UNE requête : codes
 * d'accès, directives, vidéo, contact de secours et contact du voyageur.
 *
 * Remplace les trois appels séparés d'avant (vidéo, contact du logement,
 * voyageur). Sur un téléphone en 4G, chaque aller-retour évité vaut 150 à
 * 300 ms — et les codes d'accès ne transitent plus par une requête lisible avec
 * la clé publique.
 *
 * Échec silencieux : une table vide, jamais d'erreur qui ferait tomber le
 * planning.
 */
export async function getTerrainMap(missionIds: string[]): Promise<Record<string, TerrainInfo>> {
  const ids = Array.from(new Set(missionIds.filter(Boolean)));
  if (ids.length === 0) return {};
  try {
    const res = await fetch('/api/missions/terrain', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missionIds: ids }),
    });
    if (!res.ok) return {};
    const data = await res.json().catch(() => ({}));
    return (data.terrain ?? {}) as Record<string, TerrainInfo>;
  } catch {
    return {};
  }
}

/**
 * Voyageur rattaché à chaque mission — conservé pour les écrans qui n'ont besoin
 * que de ça. Les plannings passent par getTerrainMap, qui rend tout d'un coup.
 */
export async function getMissionGuestsMap(missionIds: string[]): Promise<Record<string, GuestContact>> {
  const terrain = await getTerrainMap(missionIds);
  const out: Record<string, GuestContact> = {};
  for (const [id, info] of Object.entries(terrain)) if (info.guest) out[id] = info.guest;
  return out;
}
