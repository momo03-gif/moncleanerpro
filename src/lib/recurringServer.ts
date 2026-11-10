// ── Ménages récurrents, côté serveur ─────────────────────────────────────────
// Génère les prochaines occurrences, confie celles qui n'ont pas de cleaner au
// prestataire attitré de leur logement, et crée leurs livraisons. À appeler à
// la place de generateRecurringMissions dans les routes (crons, admin) :
// recurring.ts est aussi chargé dans le navigateur et ne peut pas importer les
// notifications.

import 'server-only';
import { generateRecurringMissions } from './recurring';
import { confierAuPrestataireAttitre } from './prestataireConfier';
import { creerLivraisonsAssociees } from './livraisonAuto';
import { getSupabaseAdmin } from './supabaseAdmin';

export async function genererRecurrents(horizonDays?: number): Promise<{ created: number }> {
  const res = await generateRecurringMissions(horizonDays);
  await confierAuPrestataireAttitre(getSupabaseAdmin(), res.sansCleaner);
  await creerLivraisonsAssociees(getSupabaseAdmin(), res.crees);
  return { created: res.created };
}
