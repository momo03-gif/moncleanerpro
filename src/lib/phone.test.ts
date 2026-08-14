import { describe, it, expect } from 'vitest';
import { normalizePhone, formatPhone } from './phone';

describe('normalizePhone — accepter ce que les gens tapent vraiment', () => {
  it('numéro français avec espaces', () => {
    expect(normalizePhone('06 12 34 56 78')).toBe('33612345678');
  });

  it('numéro français collé', () => {
    expect(normalizePhone('0612345678')).toBe('33612345678');
  });

  it('format international avec +', () => {
    expect(normalizePhone('+33 6 12 34 56 78')).toBe('33612345678');
  });

  it('format international en 00', () => {
    expect(normalizePhone('0033612345678')).toBe('33612345678');
  });

  it('indicatif sans + ni 0', () => {
    expect(normalizePhone('33612345678')).toBe('33612345678');
  });

  it('numéro étranger avec +', () => {
    expect(normalizePhone('+32 470 12 34 56')).toBe('32470123456');
  });

  it('ponctuation et points de séparation', () => {
    expect(normalizePhone('06.12.34.56.78')).toBe('33612345678');
    expect(normalizePhone('06-12-34-56-78')).toBe('33612345678');
  });

  it('refuse ce qui n’est pas un numéro', () => {
    expect(normalizePhone('')).toBeNull();
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone('bonjour')).toBeNull();
    expect(normalizePhone('12345')).toBeNull();
  });

  it('refuse un numéro trop long', () => {
    expect(normalizePhone('+3361234567890123456')).toBeNull();
  });
});

describe('formatPhone — affichage lisible', () => {
  it('remet en forme un numéro français', () => {
    expect(formatPhone('33612345678')).toBe('+33 6 12 34 56 78');
  });

  it('préfixe simplement un numéro étranger', () => {
    expect(formatPhone('32470123456')).toBe('+32470123456');
  });

  it('ne rend rien sans numéro', () => {
    expect(formatPhone(null)).toBe('');
  });
});
