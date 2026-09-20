import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { exigerSession } from '@/lib/apiGuard';
import { displayableGuestName, dialablePhone } from '@/lib/guestContact';

export const runtime = 'nodejs';

// ── Tout ce qu'il faut pour entrer dans un logement, en UNE requête ──────────
//
// DEUX PROBLÈMES, UNE RÉPONSE.
//
// Sécurité : les codes d'accès (portail, boîte à clés, directives d'entrée)
// voyageaient dans la jointure des missions, lisible avec la clé publique.
// Autrement dit, l'adresse ET le code de la boîte à clés de chaque logement
// répondaient à qui les demandait. Ici, ils ne sortent que pour les ménages du
// demandeur.
//
// Lenteur : le planning du cleaner enchaînait quatre allers-retours — missions,
// vidéo d'accès, contact du logement, contact du voyageur. Sur un téléphone en
// 4G, chacun coûte 150 à 300 ms. Cette route les rassemble : un seul aller-retour
// après le chargement des missions.
//
// QUI VOIT QUOI : le cleaner assigné (c'est lui qui est devant la porte),
// le partenaire propriétaire du logement, et l'admin. Un identifiant de ménage
// qui ne remplit aucune de ces conditions est ignoré en silence — la réponse ne
// dit pas « ce ménage existe, mais pas pour vous ».
//
// Le contact du VOYAGEUR obéit en plus à sa propre règle : rien pour un ménage
// terminé ou annulé. Un numéro n'a pas à rester consultable dans un historique.

export interface TerrainInfo {
  portalCode?: string;
  keyboxCode?: string;
  entryInstructions?: string;
  apartmentNotes?: string;
  accessVideoUrl?: string;
  siteContact?: { name?: string; phone?: string };
  guest?: { name?: string; phone?: string; phoneLast4?: string; reservationUrl?: string };
}

export async function POST(req: NextRequest) {
  const { refus, appelant } = await exigerSession();
  if (refus) return refus;

  let body: { missionIds?: string[] } = {};
  try { body = await req.json(); } catch { /* corps vide → rien à rendre */ }
  const ids = Array.from(new Set((body.missionIds ?? []).filter(Boolean))).slice(0, 400);
  if (ids.length === 0) return NextResponse.json({ terrain: {} });

  const db = getSupabaseAdmin();
  const estAdmin = appelant!.role === 'admin';

  const { data: missions } = await db.from('missions')
    .select('id, status, airbnb_id, partner_id, cleaners(user_id), '
      + 'airbnbs(code_portail, code_boite, entry_instructions, notes, access_video_url, on_site_contact_name, on_site_contact_phone)')
    .in('id', ids);

  const terrain: Record<string, TerrainInfo> = {};
  const ouverts: string[] = [];   // ménages en cours, pour le contact voyageur

  type Ligne = {
    id: string; status: string; airbnb_id: string | null; partner_id: string | null;
    cleaners?: { user_id?: string } | null;
    airbnbs?: Record<string, string | null> | null;
  };

  for (const m of (missions ?? []) as unknown as Ligne[]) {
    const cleanerUserId = m.cleaners?.user_id ?? null;
    const autorise = estAdmin
      || (cleanerUserId && cleanerUserId === appelant!.id)
      || (!!m.partner_id && m.partner_id === appelant!.id);
    if (!autorise) continue;

    const apt = m.airbnbs ?? {};
    const info: TerrainInfo = {
      portalCode: apt.code_portail || undefined,
      keyboxCode: apt.code_boite || undefined,
      entryInstructions: apt.entry_instructions || undefined,
      apartmentNotes: apt.notes || undefined,
      accessVideoUrl: apt.access_video_url || undefined,
    };
    const nom = apt.on_site_contact_name?.trim() || undefined;
    const tel = dialablePhone(apt.on_site_contact_phone);
    if (nom || tel) info.siteContact = { name: nom, phone: tel };

    terrain[m.id] = info;
    if (m.status !== 'done' && m.status !== 'cancelled') ouverts.push(m.id);
  }

  // ── Le voyageur, seulement pour les ménages encore ouverts ─────────────────
  if (ouverts.length > 0) {
    const { data: rows } = await db.from('reservations')
      .select('mission_id, guest_name, guest_phone, guest_phone_last4, reservation_url')
      .in('mission_id', ouverts)
      .eq('status', 'confirmed');

    for (const r of rows ?? []) {
      const row = r as {
        mission_id: string; guest_name?: string; guest_phone?: string;
        guest_phone_last4?: string; reservation_url?: string;
      };
      const contact = {
        name: displayableGuestName(row.guest_name),
        phone: dialablePhone(row.guest_phone),
        phoneLast4: row.guest_phone_last4 || undefined,
        reservationUrl: row.reservation_url || undefined,
      };
      if (!contact.name && !contact.phone && !contact.phoneLast4 && !contact.reservationUrl) continue;

      // Un ménage peut couvrir plusieurs réservations : on garde celle qui porte
      // un vrai numéro.
      const fiche = terrain[row.mission_id];
      if (!fiche) continue;
      if (!fiche.guest || (!fiche.guest.phone && contact.phone)) fiche.guest = contact;
    }
  }

  return NextResponse.json({ terrain });
}
