// ── Réapprovisionnement des consommables — accès données ──────────────────────
// La logique PURE est dans suppliesCompute.ts (testable sans I/O) ; on la
// réexporte ici pour n'avoir qu'un point d'import.

import { supabase } from './supabase';
import { supplyNeeds, type SupplyReport, type SupplyRestock } from './suppliesCompute';

export { supplyNeeds, urgentNeeds, type SupplyNeed, type SupplyReport, type SupplyRestock } from './suppliesCompute';

/**
 * Consommables signalés lors des ménages d'un logement, du plus récent au plus
 * ancien. On borne à 30 ménages : au-delà, un manque non traité depuis si
 * longtemps ne dit plus rien d'utile.
 */
async function getSupplyReportsDB(airbnbId: string): Promise<SupplyReport[]> {
  const { data, error } = await supabase
    .from('missions')
    .select('id, date_from, mission_reports(consumables, consumables_note)')
    .eq('airbnb_id', airbnbId)
    // En base, un ménage terminé porte le statut 'done' ('completed' est le nom
    // applicatif, cf. mapMissionStatus). Ne pas « corriger » en 'completed'.
    .eq('status', 'done')
    .order('date_from', { ascending: false })
    .limit(30);
  if (error) { console.error('getSupplyReportsDB:', error.message); return []; }

  const out: SupplyReport[] = [];
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    // La jointure renvoie un tableau (0 ou 1 rapport par mission).
    const reports = row.mission_reports as { consumables?: string[]; consumables_note?: string }[] | null;
    const report = Array.isArray(reports) ? reports[0] : (reports as { consumables?: string[]; consumables_note?: string } | null);
    const items = report?.consumables ?? [];
    if (!items.length) continue;
    out.push({
      items,
      date: String(row.date_from ?? '').slice(0, 10),
      missionId: row.id as string,
      note: report?.consumables_note || undefined,
    });
  }
  return out;
}

async function getRestocksDB(airbnbId: string): Promise<SupplyRestock[]> {
  const { data, error } = await supabase
    .from('supply_restocks').select('item, restocked_at')
    .eq('airbnb_id', airbnbId)
    .order('restocked_at', { ascending: false });
  if (error) { console.error('getRestocksDB:', error.message); return []; }
  return (data ?? []).map(r => ({ item: r.item as string, restockedAt: r.restocked_at as string }));
}

/** Liste de courses d'un logement (ce qui reste à racheter). */
export async function getSupplyNeedsDB(airbnbId: string) {
  const [reports, restocks] = await Promise.all([getSupplyReportsDB(airbnbId), getRestocksDB(airbnbId)]);
  return supplyNeeds(reports, restocks);
}

/** Marque un article comme réapprovisionné : il disparaît de la liste. */
export async function markRestockedDB(
  airbnbId: string, item: string, by?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('supply_restocks').insert({
    airbnb_id: airbnbId, item, restocked_by: by ?? null,
  });
  if (error) console.error('markRestockedDB:', error.message);
  return { error: error?.message ?? null };
}

/** Annule un « réapprovisionné » posé par erreur (le plus récent de cet article). */
export async function undoRestockDB(airbnbId: string, item: string): Promise<{ error: string | null }> {
  const { data } = await supabase
    .from('supply_restocks').select('id')
    .eq('airbnb_id', airbnbId).eq('item', item)
    .order('restocked_at', { ascending: false }).limit(1).maybeSingle();
  if (!data?.id) return { error: null };
  const { error } = await supabase.from('supply_restocks').delete().eq('id', data.id);
  if (error) console.error('undoRestockDB:', error.message);
  return { error: error?.message ?? null };
}
