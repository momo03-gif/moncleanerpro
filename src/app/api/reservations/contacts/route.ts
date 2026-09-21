import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { displayableGuestName, dialablePhone } from '@/lib/guestContact';

export const runtime = 'nodejs';

// ── Contact du voyageur, pour le terrain ─────────────────────────────────────
//
// POURQUOI UNE ROUTE : `reservations` porte le nom et le téléphone des voyageurs
// de nos clients. Lue depuis le navigateur avec la clé publique, la table livrait
// les coordonnées de TOUS les voyageurs de TOUS les partenaires à qui les
// demandait. Ces colonnes ne sont plus lisibles publiquement (cf.
// supabase/migration_reservations_verrouillage.sql).
//
// Ici, on ne rend un contact que pour les ménages QUI APPARTIENNENT au demandeur :
//   · le cleaner assigné — c'est lui qui est devant la porte ;
//   · l'admin, qui gère ;
//   · le partenaire, pour ses propres logements (ce sont ses voyageurs).
// Un identifiant de ménage qui ne remplit pas cette condition est ignoré en
// silence : la réponse ne dit pas « ce ménage existe mais pas pour vous ».
//
// Rien n'est renvoyé pour un ménage terminé ou annulé : un numéro de voyageur
// n'a pas à rester consultable dans un historique.

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  let body: { missionIds?: string[] } = {};
  try { body = await req.json(); } catch { /* corps vide → aucune demande */ }
  const ids = Array.from(new Set((body.missionIds ?? []).filter(Boolean))).slice(0, 300);
  if (ids.length === 0) return NextResponse.json({ contacts: {} });

  const db = getSupabaseAdmin();

  // Quels ménages le demandeur a-t-il le droit de voir ?
  const { data: missions } = await db.from('missions')
    .select('id, status, partner_id, cleaners!missions_cleaner_id_fkey(user_id)')
    .in('id', ids)
    .not('status', 'in', '("done","cancelled")');

  const autorises = new Set(
    (missions ?? []).filter(m => {
      if (session.role === 'admin') return true;
      const cleanerUserId = (m as { cleaners?: { user_id?: string } }).cleaners?.user_id ?? null;
      if (cleanerUserId && cleanerUserId === session.id) return true;
      return !!m.partner_id && m.partner_id === session.id;
    }).map(m => m.id as string),
  );
  if (autorises.size === 0) return NextResponse.json({ contacts: {} });

  const { data: rows } = await db.from('reservations')
    .select('mission_id, guest_name, guest_phone, guest_phone_last4, reservation_url')
    .in('mission_id', [...autorises])
    .eq('status', 'confirmed');

  const contacts: Record<string, {
    name?: string; phone?: string; phoneLast4?: string; reservationUrl?: string;
  }> = {};

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

    // Un ménage peut couvrir plusieurs réservations (deux calendriers, ou une
    // maison à annonces multiples) : on garde la plus utile, celle qui porte un
    // vrai numéro.
    const garde = contacts[row.mission_id];
    if (!garde || (!garde.phone && contact.phone)) contacts[row.mission_id] = contact;
  }

  return NextResponse.json({ contacts });
}
