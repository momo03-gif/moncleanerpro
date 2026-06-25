// ── Abstraction « fournisseur de stationnement » ────────────────────────────────
// Point d'extension du module Livraison. Aujourd'hui un seul fournisseur concret
// (« manual » : saisie du montant par le livreur, aucun appel externe). Demain, on
// branche PayByPhone (ou autre) en implémentant cette interface dans un nouveau
// fichier, sans toucher au reste : data-access, route et UI restent inchangés.

import type { ParkingStatus, ParkingProviderId } from '../types';

// Données nécessaires pour démarrer/enregistrer un paiement de stationnement.
export interface ParkingSessionInput {
  address: string;
  lat?: number;
  lng?: number;
  amount?: number;          // montant en euros (saisie manuelle pour 'manual')
  durationMinutes?: number; // durée payée (facultatif)
}

// Résultat normalisé renvoyé par un fournisseur, indépendant de l'API sous-jacente.
export interface ParkingSessionResult {
  status: ParkingStatus;
  providerRef?: string;   // id de transaction externe (API future)
  redirectUrl?: string;   // si le fournisseur exige une redirection (API future)
  metadata?: Record<string, unknown>;
}

export interface ParkingProvider {
  readonly id: ParkingProviderId;
  // Crée/enregistre un paiement. Pour 'manual', renvoie immédiatement 'paid'.
  // Pour une API future, peut renvoyer 'pending' + providerRef/redirectUrl.
  createPayment(input: ParkingSessionInput): Promise<ParkingSessionResult>;
}
