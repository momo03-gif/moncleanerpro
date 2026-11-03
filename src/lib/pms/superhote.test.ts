import { describe, it, expect } from 'vitest';
import { estJetonV2, statutV2 } from './superhote';

describe('SuperHote V2 — jeton et statuts', () => {
  it('reconnaît un jeton de la nouvelle API', () => {
    expect(estJetonV2('70335|vXRjVumcRhpvvWf49a5yl8')).toBe(true);
    expect(estJetonV2('  12|abc  ')).toBe(true);
  });
  it('ne prend pas une clé de l’ancienne version pour un jeton', () => {
    expect(estJetonV2('a1b2c3d4e5f6')).toBe(false);
    expect(estJetonV2('abc|def')).toBe(false);
  });
  it('seul un séjour confirmé crée un ménage', () => {
    expect(statutV2(1)).toBe('CONFIRMED');
    expect(statutV2(0)).toBe('CANCELLED');   // annulée par l'hôte
    expect(statutV2(5)).toBe('CANCELLED');   // annulée par le voyageur
    for (const s of [2, 3, 4, 6, 7, undefined]) expect(statutV2(s)).toBe('TENTATIVE');
  });
});
