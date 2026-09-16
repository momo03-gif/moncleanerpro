// ── Réalignement d'un ménage automatique sur sa fiche logement (logique PURE) ─
//
// Extrait de reservationSync.ts pour être testable sans base de données.

/**
 * Un ménage auto copie la durée et le prix de la fiche logement AU MOMENT où il
 * est créé. C'est voulu : une fois le ménage fait, il doit rester le témoin de
 * ce qui était convenu ce jour-là.
 *
 * Mais tant qu'il n'est pas attribué, ce fige n'a aucun sens : on renseigne la
 * fiche d'un logement APRÈS avoir branché son calendrier, et tous les ménages
 * déjà planifiés gardaient alors l'ancienne valeur — 1 h et 0 € au lieu de
 * 1 h 30 et 50 €, sur des dizaines de dates. Personne ne va les corriger une par
 * une.
 *
 * Deux verrous pour ne jamais écraser une décision humaine :
 *   · seuls les ménages encore « en attente » sont réalignés (un ménage attribué
 *     porte la paie du cleaner, on n'y touche pas en douce) ;
 *   · seuls ceux dont la durée est restée celle de la fiche. Si quelqu'un a
 *     ajusté la durée à la main, `mission_duration_minutes` s'écarte de
 *     `apartment_default_duration_snapshot` : c'est le signal qu'un humain est
 *     passé par là, et on laisse.
 */
export function shouldRealign(
  mission: { minutes: number | null; snapshot: number | null; price: number | null },
  apt: { minutes: number | null; price: number | null },
): boolean {
  // Durée retouchée à la main → on ne touche à rien, ni durée ni prix.
  if (mission.snapshot != null && mission.minutes != null && mission.minutes !== mission.snapshot) return false;
  const sameMinutes = apt.minutes == null || mission.minutes === apt.minutes;
  const samePrice = apt.price == null || Number(mission.price ?? 0) === Number(apt.price);
  return !(sameMinutes && samePrice);
}
