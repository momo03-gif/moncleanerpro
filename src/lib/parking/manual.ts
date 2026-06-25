// Fournisseur « manuel » — comportement par défaut, livré aujourd'hui.
// Aucun appel externe : le livreur saisit le montant, on enregistre le paiement
// comme déjà réglé. Sert aussi de filet de sécurité (fallback) tant qu'aucune API
// n'est configurée.

import type { ParkingProvider, ParkingSessionInput, ParkingSessionResult } from './types';

export const manualParkingProvider: ParkingProvider = {
  id: 'manual',
  async createPayment(_input: ParkingSessionInput): Promise<ParkingSessionResult> {
    // Paiement réputé effectué hors application (horodateur, appli tierce, etc.) ;
    // on ne fait que le tracer. Le montant est porté par l'appelant (data-access).
    return { status: 'paid' };
  },
};
