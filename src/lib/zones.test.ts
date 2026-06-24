import { describe, it, expect } from 'vitest';
import { haversineKm, clusterApartments, ZONE_RADIUS_KM } from './zones';

describe('haversineKm — distance entre deux points (km)', () => {
  it('même point = 0', () => {
    expect(haversineKm(45.75, 4.85, 45.75, 4.85)).toBeCloseTo(0, 6);
  });
  it('1° de latitude ≈ 111 km', () => {
    const d = haversineKm(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });
});

describe('clusterApartments — regroupement par proximité (tournées cleaners)', () => {
  const A = { id: 'a', latitude: 45.75, longitude: 4.85 };
  const B = { id: 'b', latitude: 45.754, longitude: 4.85 }; // ~0,44 km de A → même zone
  const C = { id: 'c', latitude: 45.80, longitude: 4.85 };  // ~5,5 km de A → autre zone
  const sansCoord = { id: 'd', latitude: null, longitude: null };

  it('les appartements sans coordonnées ne reçoivent pas de zone', () => {
    const res = clusterApartments([A, B, C, sansCoord]);
    expect(res.has('d')).toBe(false);
  });

  it('deux apparts proches (< 1 km) sont dans la MÊME zone', () => {
    const res = clusterApartments([A, B, C]);
    expect(res.get('a')!.zoneId).toBe(res.get('b')!.zoneId);
  });

  it('un appart éloigné (> 1 km) est dans une AUTRE zone', () => {
    const res = clusterApartments([A, B, C]);
    expect(res.get('c')!.zoneId).not.toBe(res.get('a')!.zoneId);
  });

  it('produit le bon nombre de zones distinctes', () => {
    const res = clusterApartments([A, B, C]);
    const zones = new Set(Array.from(res.values()).map(z => z.zoneId));
    expect(zones.size).toBe(2);
  });

  it('la 1ʳᵉ zone est rouge (palette ordonnée et déterministe)', () => {
    const res = clusterApartments([A, B, C]);
    expect(res.get('a')!.zoneColor).toBe('#E5484D');
  });

  it('est déterministe : deux exécutions donnent le même résultat', () => {
    const r1 = clusterApartments([C, B, A]);
    const r2 = clusterApartments([A, C, B]);
    expect(r1.get('a')!.zoneId).toBe(r2.get('a')!.zoneId);
    expect(r1.get('c')!.zoneId).toBe(r2.get('c')!.zoneId);
  });

  it('le rayon de regroupement est bien 1 km', () => {
    expect(ZONE_RADIUS_KM).toBe(1);
  });
});
