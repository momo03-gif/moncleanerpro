// ── Réapprovisionnement des consommables — accès données ──────────────────────
// La logique PURE est dans suppliesCompute.ts (testable sans I/O) ; on la
// réexporte ici pour n'avoir qu'un point d'import.

import { annexe } from './db/shared';
import { supplyNeeds, type SupplyReport, type SupplyRestock } from './suppliesCompute';

export { supplyNeeds, urgentNeeds, type SupplyNeed, type SupplyReport, type SupplyRestock } from './suppliesCompute';

/**
 * Consommables signalés lors des ménages d'un logement, du plus récent au plus
 * ancien. On borne à 30 ménages : au-delà, un manque non traité depuis si
 * longtemps ne dit plus rien d'utile.
 */
async function getSupplyReportsDB(airbnbId: string): Promise<SupplyReport[]> {
  // Lecture par le serveur : la table missions n'est plus lisible en direct.
  // Réservé à l'admin et à la conciergerie propriétaire du logement.
  let data: any[] = [];
  try {
    const res = await fetch(`/api/missions?scope=supplies&airbnbId=${encodeURIComponent(airbnbId)}`, { cache: 'no-store' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `Erreur ${res.status}`);
    data = body.data ?? [];
  } catch (e) { console.error('getSupplyReportsDB:', e); return []; }

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
  try {
    const rows: Record<string, unknown>[] = (await annexe('restocks', { airbnbId })).data ?? [];
    return rows.map(r => ({ item: r.item as string, restockedAt: r.restocked_at as string }));
  } catch (e) { console.error('getRestocksDB:', e); return []; }
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
  // Par le serveur (admin ou conciergerie du logement) : la table refuse la clé publique.
  try { await annexe('restock-mark', { airbnbId, item, by }); return { error: null }; }
  catch (e) { const m = e instanceof Error ? e.message : 'Enregistrement impossible.'; console.error('markRestockedDB:', m); return { error: m }; }
}

/** Annule un « réapprovisionné » posé par erreur (le plus récent de cet article). */
export async function undoRestockDB(airbnbId: string, item: string): Promise<{ error: string | null }> {
  try { await annexe('restock-undo', { airbnbId, item }); return { error: null }; }
  catch (e) { const m = e instanceof Error ? e.message : 'Annulation impossible.'; console.error('undoRestockDB:', m); return { error: m }; }
}
