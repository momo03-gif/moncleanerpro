// ── Rentabilité par appartement — accès données (config) ─────────────────────────
// La logique de calcul PURE est dans profitabilityCompute.ts (testable sans I/O) ;
// on la réexporte ici pour les appelants existants.

// La table `profit_config` est fermée à la clé publique : elle dit ce que
// l'entreprise gagne. Lecture et écriture passent par /api/admin/profit-config,
// qui vérifie la session admin.
import { DEFAULT_PROFIT_CONFIG } from './profitabilityCompute';
import type { ProfitConfig } from './types';

export { estimateFuel, computeApartmentProfitability, recommendedHourlyPrice, type ApartmentProfit, type PriceQuote } from './profitabilityCompute';

export async function getProfitConfigDB(): Promise<ProfitConfig> {
  // `any` assumé : c'est la ligne brute de la base, remise en forme juste après.
  let data: any = null;
  try {
    const res = await fetch('/api/admin/profit-config');
    if (res.ok) data = (await res.json()).config ?? null;
  } catch { /* on retombe sur les valeurs par défaut */ }
  if (!data) return { ...DEFAULT_PROFIT_CONFIG };
  return {
    productCostCents: Number(data.product_cost_cents) || 0,
    marginTarget: Number(data.margin_target) || 0,
    fuelBaseAddress: data.fuel_base_address ?? undefined,
    fuelBaseLat: data.fuel_base_lat != null ? Number(data.fuel_base_lat) : undefined,
    fuelBaseLng: data.fuel_base_lng != null ? Number(data.fuel_base_lng) : undefined,
    fuelConsumption: Number(data.fuel_consumption) || 0,
    fuelPrice: Number(data.fuel_price) || 0,
    fuelRouteFactor: Number(data.fuel_route_factor) || 1.4,
    cdiChargeRate: data.cdi_charge_rate != null ? Number(data.cdi_charge_rate) : 0.45,
    vatRate: data.vat_rate != null ? Number(data.vat_rate) : 0.20,
    // Linge : ce qu'un kit est facturé au client, et ce qu'il nous coûte.
    linenKitPrice: data.linen_kit_price != null ? Number(data.linen_kit_price) : 0,
    linenKitCost: data.linen_kit_cost != null ? Number(data.linen_kit_cost) : 0,
  };
}

export async function saveProfitConfigDB(cfg: ProfitConfig): Promise<{ error: string | null }> {
  try {
    const res = await fetch('/api/admin/profit-config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    const d = await res.json().catch(() => ({}));
    return { error: res.ok ? null : (d.error ?? 'Enregistrement impossible.') };
  } catch {
    return { error: 'Enregistrement impossible pour le moment.' };
  }
}
