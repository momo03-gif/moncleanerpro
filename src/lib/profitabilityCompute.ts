// ── Calcul de rentabilité par appartement (logique PURE, sans I/O) ───────────────
// Isolé de profitability.ts (qui importe supabase) pour rester testable.

import { serviceParts } from './service';
import { distanceMeters, type GeoPoint } from './geo';
import type { Apartment, Mission, ProfitConfig } from './types';

export const DEFAULT_PROFIT_CONFIG: ProfitConfig = {
  productCostCents: 50, marginTarget: 0.30,
  fuelConsumption: 7, fuelPrice: 1.90, fuelRouteFactor: 1.4,
  cdiChargeRate: 0.45,
};

// Essence estimée d'un aller-retour base ⇄ appartement (€). 0 si pas de base/coords.
export function estimateFuel(distanceKm: number | null, cfg: ProfitConfig): number {
  if (!distanceKm || distanceKm <= 0) return 0;
  const km = 2 * distanceKm * (cfg.fuelRouteFactor || 1.4);
  const fuel = km * (cfg.fuelConsumption / 100) * cfg.fuelPrice;
  return Math.round(fuel * 100) / 100;
}

export interface ApartmentProfit {
  apartmentId?: string;
  name: string;
  jobs: number;
  revenue: number;
  cleanerCost: number;
  deliveryCost: number;
  productCost: number;
  parkingCost: number;
  fuelCost: number;
  totalCost: number;
  margin: number;
  marginPct: number;
  recommendedPrice: number;
  profitable: boolean;
  plannedMinutes: number;
  realMinutes: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function computeApartmentProfitability(params: {
  missions: Mission[];
  apartments: Apartment[];
  parkingByMission: Map<string, number>;
  config: ProfitConfig;
  cleaners?: { id: string; employment_type?: string }[];
}): ApartmentProfit[] {
  const { missions, apartments, parkingByMission, config, cleaners } = params;
  const aptById = new Map(apartments.map(a => [a.id, a]));
  const costMult = new Map<string, number>();
  (cleaners ?? []).forEach(c => costMult.set(c.id, c.employment_type === 'cdi' ? 1 + config.cdiChargeRate : 1));
  const multOf = (cleanerId?: string) => (cleanerId ? (costMult.get(cleanerId) ?? 1) : 1);

  const groups = new Map<string, Mission[]>();
  for (const m of missions) {
    const key = m.airbnbId ?? `name:${m.property ?? '—'}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(m);
  }

  const result: ApartmentProfit[] = [];
  for (const [key, ms] of groups) {
    const apt = key.startsWith('name:') ? undefined : aptById.get(key);
    const name = apt?.name ?? ms[0].property ?? 'Appartement';

    const cleaningMs = ms.filter(m => serviceParts(m.service).cleaning);
    const deliveryMs = ms.filter(m => serviceParts(m.service).delivery);
    if (cleaningMs.length === 0 && deliveryMs.length === 0) continue;

    const revenue = round2(cleaningMs.reduce((s, m) => s + (m.price || 0), 0));
    const cleanerCost = round2(cleaningMs.reduce((s, m) => s + (m.cleanerGain || 0) * multOf(m.cleanerId), 0));
    const deliveryCost = round2(deliveryMs.reduce((s, m) => s + (m.cleanerGain || 0) * multOf(m.cleanerId), 0));

    const unitProductCents = apt?.productCostCents ?? config.productCostCents;
    const productCost = round2((unitProductCents / 100) * cleaningMs.length);

    const parkingCost = round2(ms.reduce((s, m) => s + (parkingByMission.get(m.id) ?? 0), 0));

    const base: GeoPoint | null = config.fuelBaseLat != null && config.fuelBaseLng != null
      ? { lat: config.fuelBaseLat, lng: config.fuelBaseLng } : null;
    const aptCoords: GeoPoint | null = apt?.latitude != null && apt?.longitude != null
      ? { lat: apt.latitude, lng: apt.longitude } : null;
    let fuelCost = 0;
    if (base && aptCoords) {
      const distKm = distanceMeters(base, aptCoords) / 1000;
      fuelCost = round2(deliveryMs.length * estimateFuel(distKm, config));
    }

    const totalCost = round2(cleanerCost + deliveryCost + productCost + parkingCost + fuelCost);
    const margin = round2(revenue - totalCost);
    const marginPct = revenue > 0 ? margin / revenue : 0;
    const jobs = cleaningMs.length || 1;
    const costPerJob = totalCost / jobs;
    const recommendedPrice = config.marginTarget < 1
      ? Math.round((costPerJob / (1 - config.marginTarget)) * 100) / 100 : costPerJob;

    const plannedMinutes = cleaningMs.reduce((s, m) => s + (m.missionDurationMinutes || 0), 0);
    const realMinutes = cleaningMs.reduce((s, m) => s + (m.actualDurationMinutes || 0), 0);

    result.push({
      apartmentId: apt?.id, name, jobs: cleaningMs.length,
      revenue, cleanerCost, deliveryCost, productCost, parkingCost, fuelCost,
      totalCost, margin, marginPct, recommendedPrice,
      profitable: revenue > 0 && marginPct >= config.marginTarget,
      plannedMinutes, realMinutes,
    });
  }

  return result.sort((a, b) => a.marginPct - b.marginPct);
}
