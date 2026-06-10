// ── Paiement cleaner ────────────────────────────────────────────────────────
// Règle unique : ce que MonCleanerPro paie au cleaner.
//   gain cleaner = taux horaire du cleaner × durée de la mission (minutes) / 60
//
// À NE PAS confondre avec la facturation client (missions.price / airbnbs.client_price),
// qui reste indépendante.

// Durées proposées en raccourci sur les formulaires (minutes).
export const DURATION_PRESETS = [15, 20, 30, 45, 60, 90, 120];

// Calcule le gain cleaner, arrondi au centime.
export function computeCleanerGain(hourlyRate: number, durationMinutes: number): number {
  const rate = Number(hourlyRate) || 0;
  const minutes = Number(durationMinutes) || 0;
  return Math.round((rate * minutes / 60) * 100) / 100;
}
