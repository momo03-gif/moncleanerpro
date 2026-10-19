import { describe, it, expect } from 'vitest';
import { photosApresExigees, maxPhotos, MAX_PHOTOS_APRES, PHOTOS_APRES_MIN } from './photosRegles';

describe('photos de ménage — règles', () => {
  it('exige des photos « après » pour un ménage, seul ou avec livraison', () => {
    expect(photosApresExigees('cleaning')).toBe(true);
    expect(photosApresExigees('both')).toBe(true);
    expect(photosApresExigees(undefined)).toBe(true);   // défaut : ménage
  });

  it('ne les exige pas pour une livraison ni un rendez-vous', () => {
    expect(photosApresExigees('delivery')).toBe(false);
    expect(photosApresExigees('appointment')).toBe(false);
  });

  it('ne prend plus que des photos « après », jusqu’à 16', () => {
    expect(MAX_PHOTOS_APRES).toBe(16);
    expect(maxPhotos()).toBe(16);
    expect(MAX_PHOTOS_APRES).toBeGreaterThanOrEqual(PHOTOS_APRES_MIN);
  });
});
