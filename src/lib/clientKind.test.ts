import { describe, it, expect } from 'vitest';
import { clientKindOf } from './clientKind';

describe('clientKindOf — Airbnb / Hôtel / EHPAD', () => {
  const ehpad = new Set(['user-ehpad-1']);

  it('source airbnb → airbnb', () => {
    expect(clientKindOf({ source: 'airbnb', createdBy: 'x' }, ehpad)).toBe('airbnb');
  });
  it('source hotel, créateur non-EHPAD → hôtel', () => {
    expect(clientKindOf({ source: 'hotel', createdBy: 'user-hotel-9' }, ehpad)).toBe('hotel');
  });
  it('source hotel, créateur EHPAD → ehpad', () => {
    expect(clientKindOf({ source: 'hotel', createdBy: 'user-ehpad-1' }, ehpad)).toBe('ehpad');
  });
  it('ensemble EHPAD vide → tout compte hôtelier reste hôtel (repli sûr)', () => {
    expect(clientKindOf({ source: 'hotel', createdBy: 'user-ehpad-1' }, new Set())).toBe('hotel');
  });
  it('sans créateur → hôtel', () => {
    expect(clientKindOf({ source: 'hotel' }, ehpad)).toBe('hotel');
  });
});
