import type { SupabaseClient } from '@supabase/supabase-js';
import { aujourdhuiParis } from '@/lib/dateParis';

// ══════════════════════════════════════════════════════════════════════════════
//  Changement de propriétaire d'un logement.
//
//  Dans la fiche logement, l'admin choisit le partenaire en tapant son NOM.
//  Pendant longtemps, seul ce nom changeait : le rattachement (partner_id) restait
//  sur l'ancien compte. Cas réel en novembre 2026 : la Villa Rochetaillée est passée
//  d'Aura Prestige à MJS Conciergerie. Le nouveau propriétaire ne voyait pas le
//  logement, l'ancien le voyait encore.
//
//  Le nom tapé est maintenant rapproché du compte partenaire qui porte ce nom.
//  Le logement suit ce compte, avec ce qui en dépend pour la suite :
//   - ses calendriers, sinon les prochaines réservations recréeraient des ménages
//     au nom de l'ancien propriétaire ;
//   - ses réservations ;
//   - les ménages à venir qui ne sont pas encore faits.
//  Les ménages passés restent à l'ancien propriétaire : c'est lui qui les a
//  commandés, et c'est à lui qu'on les facture.
// ══════════════════════════════════════════════════════════════════════════════

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();

/** Compte partenaire dont le nom correspond exactement, à la casse et aux accents près. */
export async function comptePourNom(db: SupabaseClient, nom: string): Promise<string | null> {
  const cible = norm(nom);
  if (!cible) return null;
  const { data } = await db.from('airbnb_partners').select('user_id, partner_name');
  const ids = [...new Set((data ?? [])
    .filter((p: { partner_name: string | null }) => norm(p.partner_name ?? '') === cible)
    .map((p: { user_id: string }) => p.user_id))];
  // Deux comptes du même nom : on ne devine pas lequel est le bon.
  return ids.length === 1 ? ids[0] : null;
}

/** Rattache le logement et ce qui en dépend au nouveau compte (ou à aucun). */
export async function transfererLogement(db: SupabaseClient, airbnbId: string, nouveau: string | null): Promise<void> {
  const err = (t: string, e: { message: string } | null) => { if (e) throw new Error(`${t}: ${e.message}`); };
  let r = await db.from('airbnbs').update({ partner_id: nouveau }).eq('id', airbnbId);
  err('airbnbs', r.error);
  r = await db.from('reservation_feeds').update({ partner_id: nouveau }).eq('airbnb_id', airbnbId);
  err('reservation_feeds', r.error);
  r = await db.from('reservations').update({ partner_id: nouveau }).eq('airbnb_id', airbnbId);
  err('reservations', r.error);
  r = await db.from('missions').update({ partner_id: nouveau })
    .eq('airbnb_id', airbnbId).neq('status', 'done').gte('date_from', aujourdhuiParis());
  err('missions', r.error);
}
