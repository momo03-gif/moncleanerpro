// ── Rentabilité par appartement — accès données (config) ─────────────────────────
// La logique de calcul PURE est dans profitabilityCompute.ts (testable sans I/O) ;
// on la réexporte ici pour les appelants existants.

import { supabase } from './supabase';
import { DEFAULT_PROFIT_CONFIG } from './profitabilityCompute';
import type { ProfitConfig } from './types';

export { estimateFuel, computeApartmentProfitability, recommendedHourlyPrice, type ApartmentProfit, type PriceQuote } from './profitabilityCompute';

export async function getProfitConfigDB(): Promise<ProfitConfig> {
  const { data } = await supabase.from('profit_config').select('*').eq('id', 1).single();
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
  };
}

export async function saveProfitConfigDB(cfg: ProfitConfig): Promise<{ error: string | null }> {
  const { error } = await supabase.from('profit_config').upsert({
    id: 1,
    product_cost_cents: Math.round(cfg.productCostCents) || 0,
    margin_target: cfg.marginTarget,
    fuel_base_address: cfg.fuelBaseAddress || null,
    fuel_base_lat: cfg.fuelBaseLat ?? null,
    fuel_base_lng: cfg.fuelBaseLng ?? null,
    fuel_consumption: cfg.fuelConsumption,
    fuel_price: cfg.fuelPrice,
    fuel_route_factor: cfg.fuelRouteFactor,
    cdi_charge_rate: cfg.cdiChargeRate,
    vat_rate: cfg.vatRate,
  }, { onConflict: 'id' });
  return { error: error?.message ?? null };
}
