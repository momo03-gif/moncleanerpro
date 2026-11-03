// ── Purge des vieilles notifications (serveur) ──────────────────────────────
// Rien ne les supprimait : 7 812 lignes pour 25 comptes au 03/11/2026, environ
// 1 700 de plus chaque mois, dont la moitié jamais lues. Au-delà de 40 jours
// une notification (« ménage terminé », « nouvelle mission »…) n'apprend plus
// rien : l'historique utile vit dans les missions elles-mêmes.

import type { SupabaseClient } from '@supabase/supabase-js';

/** Durée de conservation d'une notification, lue ou non (jours). */
export const NOTIFICATIONS_CONSERVATION_JOURS = 40;

/** Supprime les notifications de plus de `jours` jours. Renvoie combien. */
export async function purgerVieillesNotifications(db: SupabaseClient, jours = NOTIFICATIONS_CONSERVATION_JOURS): Promise<number> {
  const avant = new Date(Date.now() - jours * 86400000).toISOString();
  const { count, error } = await db.from('notifications').delete({ count: 'exact' }).lt('created_at', avant);
  if (error) { console.error('purgerVieillesNotifications:', error.message); return 0; }
  return count ?? 0;
}
