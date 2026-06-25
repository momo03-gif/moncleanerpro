import { describe, it, expect, afterEach } from 'vitest';
import { getParkingProvider } from './index';
import { manualParkingProvider } from './manual';

const ORIGINAL = process.env.PARKING_PROVIDER;
afterEach(() => { process.env.PARKING_PROVIDER = ORIGINAL; });

describe('getParkingProvider — sélection du fournisseur', () => {
  it('défaut = manuel (aucune variable d’env)', () => {
    delete process.env.PARKING_PROVIDER;
    expect(getParkingProvider().id).toBe('manual');
  });
  it('id inconnu → retombe sur manuel (filet de sécurité)', () => {
    process.env.PARKING_PROVIDER = 'inexistant';
    expect(getParkingProvider().id).toBe('manual');
  });
  it('paybyphone sélectionnable mais non configuré (stub lève)', async () => {
    process.env.PARKING_PROVIDER = 'paybyphone';
    expect(getParkingProvider().id).toBe('paybyphone');
    await expect(getParkingProvider().createPayment({ address: 'x' })).rejects.toThrow();
  });
});

describe('manualParkingProvider — saisie manuelle', () => {
  it('enregistre un paiement réputé réglé', async () => {
    const res = await manualParkingProvider.createPayment({ address: '1 rue de Lyon', amount: 2.5 });
    expect(res.status).toBe('paid');
  });
});
