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
  licensePlate?: string;    // plaque du véhicule du livreur (requise par PayByPhone)
}

// Résultat normalisé renvoyé par un fournisseur, indépendant de l'API sous-jacente.
export interface ParkingSessionResult {
  status: ParkingStatus;
  amount?: number;        // montant RÉELLEMENT facturé (tarif fournisseur) — fait foi
  currency?: string;
  providerRef?: string;   // id de transaction externe (API future)
  redirectUrl?: string;   // si le fournisseur exige une redirection (API future)
  metadata?: Record<string, unknown>;
}

// Devis : prix calculé pour une durée selon le tarif du fournisseur (ex. PayByPhone :
// 20 min = 1 €). Renvoie null si le fournisseur ne tarife pas (saisie manuelle).
export interface ParkingQuote {
  amount: number;
  currency: string;
}

export interface ParkingProvider {
  readonly id: ParkingProviderId;
  // Crée/enregistre un paiement. Pour 'manual', renvoie immédiatement 'paid'.
  // Pour une API (PayByPhone), démarre une session et renvoie le montant facturé.
  createPayment(input: ParkingSessionInput): Promise<ParkingSessionResult>;
  // Calcule le prix d'une durée selon le tarif du fournisseur. null = pas de tarif
  // automatique (le livreur saisit le montant lui-même).
  quote?(input: ParkingSessionInput): Promise<ParkingQuote | null>;
}
