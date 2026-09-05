import { describe, it, expect } from 'vitest';
import {
  isEligibleMacro, isEligibleSelection, netAfterCredit, creditForYear,
  CREDIT_RATE, CREDIT_MAX,
} from './creditImpot';

describe('éligibilité au crédit d’impôt', () => {
  it('le résidentiel ouvre droit au crédit', () => {
    expect(isEligibleMacro('residentiel')).toBe(true);
  });
  it('vitres, sols et textiles chez l’habitant aussi', () => {
    expect(isEligibleMacro('vst')).toBe(true);
  });
  // Le piège du dispositif : un Airbnb n'est pas un domicile, c'est une activité
  // de location. L'annoncer à une conciergerie serait une promesse fausse.
  it('Airbnb et locaux pro n’ouvrent AUCUN droit', () => {
    expect(isEligibleMacro('airbnb')).toBe(false);
    expect(isEligibleMacro('pro')).toBe(false);
  });
  it('chantier et extérieurs restent exclus par prudence', () => {
    expect(isEligibleMacro('remise')).toBe(false);
    expect(isEligibleMacro('ext')).toBe(false);
  });
});

describe('isEligibleSelection — le panier entier, pas seulement une ligne', () => {
  it('sélection vide → rien à annoncer', () => {
    expect(isEligibleSelection([])).toBe(false);
  });
  it('tout éligible → crédit affiché', () => {
    expect(isEligibleSelection(['residentiel', 'vst', 'residentiel'])).toBe(true);
  });
  it('panier mixte domicile + local pro → rien affiché', () => {
    expect(isEligibleSelection(['residentiel', 'pro'])).toBe(false);
  });
  it('une seule ligne Airbnb suffit à tout disqualifier', () => {
    expect(isEligibleSelection(['residentiel', 'airbnb'])).toBe(false);
  });
});

describe('netAfterCredit — le reste à charge affiché au client', () => {
  it('coupe la dépense en deux', () => {
    expect(netAfterCredit(180)).toBe(90);
  });
  it('arrondit à l’euro', () => {
    expect(netAfterCredit(175)).toBe(88); // 87,5 → 88
  });
  it('un montant nul ou absurde ne produit pas de prix négatif', () => {
    expect(netAfterCredit(0)).toBe(0);
    expect(netAfterCredit(-50)).toBe(0);
    expect(netAfterCredit(NaN)).toBe(0);
  });
  it('le taux reste bien celui de la loi', () => {
    expect(CREDIT_RATE).toBe(0.5);
  });
});

describe('creditForYear — le plafond annuel', () => {
  it('sous le plafond, 50 % de la dépense', () => {
    expect(creditForYear(3000)).toBe(1500);
  });
  it('au-delà de 12 000 € de dépenses, l’avantage est bloqué à 6 000 €', () => {
    expect(creditForYear(20000)).toBe(CREDIT_MAX);
  });
  it('exactement au plafond', () => {
    expect(creditForYear(12000)).toBe(6000);
  });
  it('plafond majoré passé en argument', () => {
    expect(creditForYear(20000, 15000)).toBe(7500);
  });
  it('dépense nulle → aucun crédit', () => {
    expect(creditForYear(0)).toBe(0);
  });
});
