// Fournisseur PayByPhone — STUB (non branché).
// ────────────────────────────────────────────────────────────────────────────────
// Le branchement réel est volontairement reporté (décision métier : attendre un
// premier client qui en a besoin). Ce fichier matérialise le point d'extension :
// le jour venu, il suffira d'implémenter `createPayment` avec l'API PayByPhone
// Business (clés API à obtenir auprès de leur service commercial B2B) puis de
// définir la variable d'env PARKING_PROVIDER=paybyphone. Rien d'autre à changer.
//
// Pistes d'implémentation future (à confirmer avec la doc PayByPhone B2B) :
//   1. Authentifier le compte flotte (OAuth client_credentials).
//   2. Démarrer une session de stationnement pour la plaque + zone + durée.
//   3. Renvoyer { status: 'pending'|'paid', providerRef: <sessionId> }.
//   4. Confirmer le statut via webhook ou polling getStatus().

import type { ParkingProvider, ParkingSessionInput, ParkingSessionResult } from './types';

export const payByPhoneProvider: ParkingProvider = {
  id: 'paybyphone',
  async createPayment(_input: ParkingSessionInput): Promise<ParkingSessionResult> {
    throw new Error(
      "Fournisseur PayByPhone non configuré. Définissez l'intégration API avant " +
      "PARKING_PROVIDER=paybyphone, ou utilisez la saisie manuelle (PARKING_PROVIDER=manual).",
    );
  },
};
