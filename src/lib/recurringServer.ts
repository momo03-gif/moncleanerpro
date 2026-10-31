// ── Ménages récurrents, côté serveur ─────────────────────────────────────────
// Génère les prochaines occurrences, puis confie celles qui n'ont pas de
// cleaner au prestataire attitré de leur logement. À appeler à la place de
// generateRecurringMissions dans les routes (crons, admin) : recurring.ts est
// aussi chargé dans le navigateur et ne peut pas importer les notifications.

import 'server-only';
import { generateRecurringMissions } from './recurring';
import { confierAuPrestataireAttitre } from './prestataireConfier';
import { getSupabaseAdmin } from './supabaseAdmin';

export async function genererRecurrents(horizonDays?: number): Promise<{ created: number }> {
  const res = await generateRecurringMissions(horizonDays);
  await confierAuPrestataireAttitre(getSupabaseAdmin(), res.sansCleaner);
  return { created: res.created };
}
