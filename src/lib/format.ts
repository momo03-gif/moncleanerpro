// ── Formatage d'affichage ─────────────────────────────────────────────────────
// Utilitaires purement visuels. Ne modifient jamais les valeurs stockées :
// les durées restent enregistrées en minutes en base pour les calculs.

/**
 * Formate une durée exprimée en minutes pour l'affichage.
 *   < 60 min  → "45 min"
 *   ≥ 60 min  → "1 h", "1 h 30", "2 h"…
 *
 * @param minutes durée en minutes (la valeur métier reste toujours en minutes)
 */
export function formatDuration(minutes: number | null | undefined): string {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const rest = total % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest}`;
}

// ── Créneaux horaires prédéfinis ───────────────────────────────────────────────
// Listes fermées : seules ces valeurs sont sélectionnables.
//   Départ client : 8h → 13h     Arrivée du prochain client : 13h → 17h
// Stockées au format "HH:MM" (colonne TIME), affichées via formatHour ("10h").
export const DEPARTURE_TIMES = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00'];
export const ARRIVAL_TIMES = ['13:00', '14:00', '15:00', '16:00', '17:00'];

/**
 * Formate une heure "HH:MM" pour l'affichage : "10:00" → "10h", "14:30" → "14h30".
 * Ne montre jamais les secondes ni de format technique.
 */
export function formatHour(time: string | null | undefined): string {
  if (!time) return '';
  const [h, m = '0'] = time.split(':');
  const hh = parseInt(h, 10);
  if (Number.isNaN(hh)) return time;
  const mm = parseInt(m, 10) || 0;
  return mm === 0 ? `${hh}h` : `${hh}h${String(mm).padStart(2, '0')}`;
}
