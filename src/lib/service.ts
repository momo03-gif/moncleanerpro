// ── Service de mission (nettoyage / livraison) ──────────────────────────────────
// Source unique pour les libellés et la logique d'éligibilité cleaner ↔ mission.
// Le nettoyage est le défaut : une mission sans service explicite = 'cleaning'.

import type { MissionService } from './types';

export const SERVICE_LABEL: Record<MissionService, string> = {
  cleaning: 'Nettoyage',
  delivery: 'Livraison',
  cleaning_delivery: 'Nettoyage + livraison',
  appointment: 'Rendez-vous',
};

// Couleurs des badges (cohérentes avec la charte sobre de l'app).
export const SERVICE_BADGE: Record<MissionService, { color: string; bg: string }> = {
  cleaning:          { color: '#5B6EF5', bg: '#5B6EF518' },
  delivery:          { color: '#C48A2A', bg: '#C48A2A15' },
  cleaning_delivery: { color: '#5A8A6A', bg: '#5A8A6A15' },
  appointment:       { color: '#7C5CBF', bg: '#7C5CBF15' },
};

export function serviceLabel(service?: MissionService | null): string {
  return SERVICE_LABEL[service ?? 'cleaning'];
}

// Décompose un service en ses prestations élémentaires.
export function serviceParts(service?: MissionService | null): { cleaning: boolean; delivery: boolean } {
  const s = service ?? 'cleaning';
  return { cleaning: s === 'cleaning' || s === 'cleaning_delivery', delivery: s === 'delivery' || s === 'cleaning_delivery' };
}

// Un cleaner peut-il réaliser une mission de ce service ? Il doit savoir faire
// CHACUNE des prestations requises. Capacités par défaut : nettoyage seul.
export function canCleanerDoService(
  cleaner: { can_clean?: boolean; can_deliver?: boolean } | null | undefined,
  service?: MissionService | null,
): boolean {
  if (!cleaner) return false;
  const canClean = cleaner.can_clean ?? true;
  const canDeliver = cleaner.can_deliver ?? false;
  const need = serviceParts(service);
  if (need.cleaning && !canClean) return false;
  if (need.delivery && !canDeliver) return false;
  return true;
}

// Libellé court des capacités d'un cleaner (pour les badges admin).
export function capabilitiesLabel(cleaner: { can_clean?: boolean; can_deliver?: boolean }): string {
  const canClean = cleaner.can_clean ?? true;
  const canDeliver = cleaner.can_deliver ?? false;
  if (canClean && canDeliver) return 'Nettoyage + livraison';
  if (canDeliver) return 'Livraison';
  return 'Nettoyage';
}
