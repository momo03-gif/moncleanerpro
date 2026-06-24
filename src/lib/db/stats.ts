// ── Statistiques globales (tableau de bord admin) ────────────────────────────────
// Extrait de db.ts.

import { supabase } from '../supabase';

export async function getStatsDB() {
  const [{ data: missions }, { data: cleaners }, { data: hotels }] = await Promise.all([
    supabase.from('missions').select('*'),
    supabase.from('cleaners').select('*'),
    supabase.from('hotels').select('status_account'),
  ]);

  const completed = (missions ?? []).filter(m => m.status === 'done');
  const totalRevenue = completed.reduce((s: number, m: any) => s + (m.price ?? 0), 0);
  const totalSalaries = completed.reduce((s: number, m: any) => s + (m.cleaner_gain ?? 0), 0);

  return {
    totalMissions: (missions ?? []).length,
    completedMissions: completed.length,
    totalRevenue,
    totalSalaries,
    netProfit: totalRevenue - totalSalaries,
    activeCleaners: (cleaners ?? []).filter((c: any) => c.status === 'active').length,
    approvedHotels: (hotels ?? []).filter((h: any) => h.status_account === 'approved').length,
  };
}
