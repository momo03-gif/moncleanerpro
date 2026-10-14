import { describe, it, expect } from 'vitest';
import { photosApresExigees, maxPhotos, MAX_PHOTOS_AVANT, MAX_PHOTOS_APRES, PHOTOS_APRES_MIN } from './photosRegles';

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

  it('a des limites séparées : les photos « avant » ne bloquent jamais les « après »', () => {
    expect(maxPhotos('before')).toBe(MAX_PHOTOS_AVANT);
    expect(maxPhotos('after')).toBe(MAX_PHOTOS_APRES);
    expect(MAX_PHOTOS_APRES).toBeGreaterThanOrEqual(PHOTOS_APRES_MIN);
  });
});
