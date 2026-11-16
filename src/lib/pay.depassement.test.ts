import { describe, it, expect } from 'vitest';
import { tempsRetenu } from './pay';

describe('tempsRetenu (seul le temps accordé est payé)', () => {
  it('paie le temps accordé, même plus court ou jusqu’à 5 min de plus', () => {
    expect(tempsRetenu(60, 50)).toEqual({ payees: 60, aValider: 0 });
    expect(tempsRetenu(60, 65)).toEqual({ payees: 60, aValider: 0 });
  });
  it('au-delà de 5 min, le dépassement entier part en validation', () => {
    expect(tempsRetenu(60, 66)).toEqual({ payees: 60, aValider: 6 });
    expect(tempsRetenu(60, 120)).toEqual({ payees: 60, aValider: 60 });
  });
  it('sans temps accordé, le pointage fait foi', () => {
    expect(tempsRetenu(0, 90)).toEqual({ payees: 90, aValider: 0 });
  });
});
