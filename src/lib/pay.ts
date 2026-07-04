// ── Paiement cleaner ────────────────────────────────────────────────────────
// Règle unique : ce que MonCleanerPro paie au cleaner.
//   gain cleaner = taux horaire du cleaner × durée de la mission (minutes) / 60
//
// À NE PAS confondre avec la facturation client (missions.price / airbnbs.client_price),
// qui reste indépendante.

import type { MissionService } from './types';
import { serviceParts } from './service';

// Durées proposées en raccourci sur les formulaires (minutes).
export const DURATION_PRESETS = [15, 20, 30, 45, 60, 90, 120];

// Calcule le gain cleaner, arrondi au centime.
export function computeCleanerGain(hourlyRate: number, durationMinutes: number): number {
  const rate = Number(hourlyRate) || 0;
  const minutes = Number(durationMinutes) || 0;
  return Math.round((rate * minutes / 60) * 100) / 100;
}

// Prix client FACTURÉ pour un ménage hôtel / EHPAD selon le pointage.
// Règle : on facture le MAX du temps accordé et du temps réel. Un dépassement est
// facturé au réel ; un ménage plus rapide est facturé au temps convenu (jamais
// moins). Sans temps prévu ou sans prix de base → on renvoie le prix de base tel
// quel. (Ne s'applique PAS aux Airbnb : prix fixe par ménage.)
export function billableHotelPrice(basePrice: number, plannedMinutes: number, realMinutes: number): number {
  const base = Number(basePrice) || 0;
  const planned = Number(plannedMinutes) || 0;
  const real = Number(realMinutes) || 0;
  if (base <= 0 || planned <= 0) return base;
  return Math.round(base * Math.max(1, real / planned) * 100) / 100;
}

// Gain d'une mission selon sa prestation :
//   ménage   → taux horaire × durée / 60
//   livraison → montant fixe par livraison (delivery_rate)
//   ménage + livraison (même personne) → les deux s'additionnent
export function computeMissionGain(params: {
  service?: MissionService | null;
  hourlyRate: number;
  deliveryRate: number;
  durationMinutes: number;
}): number {
  const parts = serviceParts(params.service);
  let gain = 0;
  if (parts.cleaning) gain += (Number(params.hourlyRate) || 0) * (Number(params.durationMinutes) || 0) / 60;
  if (parts.delivery) gain += Number(params.deliveryRate) || 0;
  return Math.round(gain * 100) / 100;
}
