import { describe, it, expect } from 'vitest';
import { distanceMeters } from './geo';

describe('distanceMeters — distance GPS (haversine) du pointage', () => {
  it('même point = 0', () => {
    expect(distanceMeters({ lat: 45.75, lng: 4.85 }, { lat: 45.75, lng: 4.85 })).toBeCloseTo(0, 5);
  });

  it('1° de latitude ≈ 111 km', () => {
    const d = distanceMeters({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(112000);
  });

  it('petit déplacement réaliste (~111 m pour 0,001° de latitude)', () => {
    const d = distanceMeters({ lat: 45.75, lng: 4.85 }, { lat: 45.751, lng: 4.85 });
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(125);
  });

  it('est symétrique : d(a,b) = d(b,a)', () => {
    const a = { lat: 45.75, lng: 4.85 };
    const b = { lat: 45.77, lng: 4.83 };
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
  });

  it('deux points proches restent sous la tolérance de 200 m', () => {
    // ~80 m de décalage → doit être jugé "proche"
    const d = distanceMeters({ lat: 45.75, lng: 4.85 }, { lat: 45.7505, lng: 4.8505 });
    expect(d).toBeLessThan(200);
  });
});
