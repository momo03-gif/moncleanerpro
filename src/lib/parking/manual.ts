// Fournisseur « manuel » — comportement par défaut, livré aujourd'hui.
// Aucun appel externe : le livreur saisit le montant, on enregistre le paiement
// comme déjà réglé. Sert aussi de filet de sécurité (fallback) tant qu'aucune API
// n'est configurée.

import type { ParkingProvider, ParkingSessionInput, ParkingSessionResult, ParkingQuote } from './types';

export const manualParkingProvider: ParkingProvider = {
  id: 'manual',
  async createPayment(_input: ParkingSessionInput): Promise<ParkingSessionResult> {
    // Paiement réputé effectué hors application (horodateur, appli tierce, etc.) ;
    // on ne fait que le tracer. Le montant est porté par l'appelant (data-access).
    return { status: 'paid' };
  },
  // Tarif optionnel : si PARKING_RATE_PER_HOUR est défini (ex. 3 = 3 €/h → 20 min = 1 €),
  // le prix est calculé selon la durée. Sinon → null = saisie manuelle du montant.
  async quote(input: ParkingSessionInput): Promise<ParkingQuote | null> {
    const rate = Number(process.env.PARKING_RATE_PER_HOUR);
    if (!rate || rate <= 0 || !input.durationMinutes || input.durationMinutes <= 0) return null;
    const amount = Math.round((rate * input.durationMinutes / 60) * 100) / 100;
    return { amount, currency: 'EUR' };
  },
};
