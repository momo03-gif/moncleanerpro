import { describe, it, expect } from 'vitest';
import { computeCleanerGain, computeMissionGain, billableHotelPrice } from './pay';

describe('billableHotelPrice — facturation hôtel/EHPAD = max(temps accordé, réel)', () => {
  // Prix de base = taux × prévu. Ex. 40€ pour 120 min prévues (= 20€/h).
  it('temps réel = prévu → prix inchangé', () => {
    expect(billableHotelPrice(40, 120, 120)).toBe(40);
  });
  it('dépassement (150 min pour 120 prévues) → facturé au réel', () => {
    expect(billableHotelPrice(40, 120, 150)).toBe(50); // 40 × 150/120
  });
  it('plus rapide (90 min pour 120 prévues) → facturé au temps accordé (jamais moins)', () => {
    expect(billableHotelPrice(40, 120, 90)).toBe(40);
  });
  it('sans temps prévu → prix de base conservé', () => {
    expect(billableHotelPrice(40, 0, 90)).toBe(40);
  });
  it('sans prix de base → 0', () => {
    expect(billableHotelPrice(0, 120, 200)).toBe(0);
  });
});

describe('computeCleanerGain — salaire = taux horaire × durée / 60', () => {
  it('une heure pleine = le taux horaire', () => {
    expect(computeCleanerGain(12, 60)).toBe(12);
  });
  it('une demi-heure = la moitié du taux', () => {
    expect(computeCleanerGain(12, 30)).toBe(6);
  });
  it('45 minutes à 15€/h = 11,25€', () => {
    expect(computeCleanerGain(15, 45)).toBe(11.25);
  });
  it('arrondit au centime', () => {
    expect(computeCleanerGain(13, 20)).toBe(4.33); // 4,3333…
  });
  it('taux 0 → 0', () => {
    expect(computeCleanerGain(0, 90)).toBe(0);
  });
  it('entrées invalides → 0 (jamais NaN)', () => {
    expect(computeCleanerGain(NaN as any, 60)).toBe(0);
    expect(computeCleanerGain(12, undefined as any)).toBe(0);
  });
});

describe('computeMissionGain — selon la prestation', () => {
  it('ménage seul : taux × durée, la livraison n’est PAS ajoutée', () => {
    expect(computeMissionGain({ service: 'cleaning', hourlyRate: 12, deliveryRate: 5, durationMinutes: 60 })).toBe(12);
  });
  it('livraison seule : montant fixe, la durée est ignorée', () => {
    expect(computeMissionGain({ service: 'delivery', hourlyRate: 12, deliveryRate: 5, durationMinutes: 240 })).toBe(5);
  });
  it('ménage + livraison (legacy) : les deux s’additionnent', () => {
    expect(computeMissionGain({ service: 'cleaning_delivery', hourlyRate: 12, deliveryRate: 5, durationMinutes: 60 })).toBe(17);
  });
  it('service non précisé = ménage par défaut', () => {
    expect(computeMissionGain({ service: undefined, hourlyRate: 10, deliveryRate: 5, durationMinutes: 30 })).toBe(5);
  });
  it('arrondit au centime', () => {
    expect(computeMissionGain({ service: 'cleaning', hourlyRate: 13, deliveryRate: 0, durationMinutes: 20 })).toBe(4.33);
  });
});
