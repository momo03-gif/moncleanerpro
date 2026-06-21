// ════════════════════════════════════════════════════════════════════════════
//  Libellés & couleurs des MISSIONS — source unique pour toutes les pages.
//  Avant : chaque page redéfinissait ses propres tables (statuts, types) avec
//  des divergences (« regular » = « Ménage » ici, « Régulier » là). Ici on
//  garantit le même affichage partout (admin, cleaner, Airbnb, stats).
// ════════════════════════════════════════════════════════════════════════════

// Statuts de mission RÉELS (mappés depuis la base). Une mission ne peut être que
// pending / accepted / in_progress / completed / cancelled — jamais « validated »
// (ça, c'est les demandes hôtel, gérées à part).
export const MISSION_STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'À assigner', color: '#6B7280', bg: '#6B728018' },
  accepted:    { label: 'En attente', color: '#C48A2A', bg: '#C48A2A15' },
  in_progress: { label: 'En cours',   color: '#5B6EF5', bg: '#5B6EF518' },
  completed:   { label: 'Terminée',   color: '#5A8A6A', bg: '#5A8A6A15' },
  cancelled:   { label: 'Annulée',    color: '#B85A50', bg: '#B85A5015' },
};

export function missionStatusCfg(status: string) {
  return MISSION_STATUS_CFG[status] ?? MISSION_STATUS_CFG.pending;
}

// Types de mission (nature du ménage). `menage` / `grand_menage` sont des alias
// hérités de missions issues d'annonces hôtel.
export const MISSION_TYPE_LABEL: Record<string, string> = {
  checkout: 'Check-out',
  checkin: 'Check-in',
  deep_clean: 'Grand ménage',
  regular: 'Ménage',
  menage: 'Ménage',
  grand_menage: 'Grand ménage',
};

export function missionTypeLabel(type: string | undefined | null): string {
  if (!type) return '—';
  return MISSION_TYPE_LABEL[type] ?? type;
}

export const MISSION_SOURCE_LABEL: Record<string, string> = { hotel: 'Hôtel', airbnb: 'Airbnb' };
