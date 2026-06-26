import { describe, it, expect } from 'vitest';
import { computeApartmentProfitability, estimateFuel, DEFAULT_PROFIT_CONFIG } from './profitabilityCompute';
import type { Mission, Apartment, ProfitConfig } from './types';

const cfg: ProfitConfig = { ...DEFAULT_PROFIT_CONFIG, productCostCents: 50, marginTarget: 0.30, cdiChargeRate: 0.45 };

const mission = (over: Partial<Mission>): Mission => ({
  id: 'm', property: '', address: '', date: '2026-06-10', time: '', duration: 0,
  status: 'completed', price: 0, type: 'regular', service: 'cleaning', ...over,
} as Mission);

const apt = (over: Partial<Apartment>): Apartment => ({ id: 'a1', name: 'Studio', address: '', entryDirectives: '', ...over } as Apartment);

describe('estimateFuel', () => {
  it('aller-retour avec facteur route', () => {
    // 5 km × 2 × 1,4 = 14 km ; 7 L/100km ; 1,90 €/L → 14×0,07×1,9 = 1,862 → 1,86
    expect(estimateFuel(5, cfg)).toBeCloseTo(1.86, 2);
  });
  it('pas de distance → 0', () => expect(estimateFuel(null, cfg)).toBe(0));
});

describe('computeApartmentProfitability', () => {
  const apartments = [apt({ id: 'a1' })];
  const noParking = new Map<string, number>();

  it('auto-entrepreneur : marge = prix − paie − produits', () => {
    const ms = [mission({ id: 'm1', airbnbId: 'a1', price: 50, cleanerGain: 15, cleanerId: 'c1' })];
    const [r] = computeApartmentProfitability({ missions: ms, apartments, parkingByMission: noParking, config: cfg, cleaners: [{ id: 'c1', employment_type: 'auto' }] });
    expect(r.cleanerCost).toBe(15);
    expect(r.productCost).toBe(0.5);
    expect(r.margin).toBe(34.5);
    expect(r.profitable).toBe(true);
  });

  it('CDI : la paie est majorée des charges patronales (+45 %)', () => {
    const ms = [mission({ id: 'm1', airbnbId: 'a1', price: 50, cleanerGain: 15, cleanerId: 'c1' })];
    const [r] = computeApartmentProfitability({ missions: ms, apartments, parkingByMission: noParking, config: cfg, cleaners: [{ id: 'c1', employment_type: 'cdi' }] });
    expect(r.cleanerCost).toBeCloseTo(21.75, 2); // 15 × 1,45
    expect(r.margin).toBeCloseTo(27.75, 2);
  });

  it('parking et override produits sont pris en compte', () => {
    const parking = new Map([['m1', 3]]);
    const ms = [mission({ id: 'm1', airbnbId: 'a1', price: 50, cleanerGain: 15, cleanerId: 'c1' })];
    const [r] = computeApartmentProfitability({ missions: ms, apartments: [apt({ id: 'a1', productCostCents: 200 })], parkingByMission: parking, config: cfg, cleaners: [{ id: 'c1' }] });
    expect(r.productCost).toBe(2);      // override 200 c
    expect(r.parkingCost).toBe(3);
    expect(r.margin).toBe(30);          // 50 − 15 − 2 − 3
  });

  it('appartement non rentable sous la marge cible', () => {
    const ms = [mission({ id: 'm1', airbnbId: 'a1', price: 20, cleanerGain: 18, cleanerId: 'c1' })];
    const [r] = computeApartmentProfitability({ missions: ms, apartments, parkingByMission: noParking, config: cfg, cleaners: [{ id: 'c1' }] });
    expect(r.profitable).toBe(false);
    expect(r.recommendedPrice).toBeGreaterThan(20);
  });
});
