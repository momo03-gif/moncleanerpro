// ── Statistiques globales (tableau de bord admin) ────────────────────────────────
// Calculées côté serveur (/api/partners?op=stats) : elles agrègent des données
// sensibles (CA, salaires) et lisent `hotels` (verrouillée RLS).

import { getServer } from './shared';

export async function getStatsDB() {
  try {
    const d = await getServer('/api/partners?op=stats');
    return d.stats ?? {
      totalMissions: 0, completedMissions: 0, totalRevenue: 0, totalSalaries: 0,
      netProfit: 0, activeCleaners: 0, approvedHotels: 0,
    };
  } catch {
    return {
      totalMissions: 0, completedMissions: 0, totalRevenue: 0, totalSalaries: 0,
      netProfit: 0, activeCleaners: 0, approvedHotels: 0,
    };
  }
}
