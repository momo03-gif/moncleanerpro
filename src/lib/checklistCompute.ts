// ── Checklists de ménage — logique PURE (sans I/O) ────────────────────────────
// Isolé de checklists.ts (qui importe supabase) pour rester testable.

import type { MissionChecklistLine } from './types';

export interface ChecklistProgress {
  /** Points requis cochés. */
  done: number;
  /** Points requis au total. */
  total: number;
  /** Points optionnels cochés (bonus, hors conformité). */
  extras: number;
  /** 0–100. 100 quand il n'y a aucun point requis (rien à prouver, rien à reprocher). */
  percent: number;
  complete: boolean;
}

/**
 * Conformité d'un ménage à son standard. Seuls les points REQUIS comptent :
 * un point optionnel non fait ne doit pas afficher « ménage non conforme ».
 */
export function checklistProgress(lines: MissionChecklistLine[]): ChecklistProgress {
  const required = lines.filter(l => l.item.required);
  const done = required.filter(l => l.check).length;
  const extras = lines.filter(l => !l.item.required && l.check).length;
  const total = required.length;
  const percent = total === 0 ? 100 : Math.round((done / total) * 100);
  return { done, total, extras, percent, complete: done === total };
}

/** Regroupe par pièce, en gardant l'ordre des positions. Les points sans pièce vont dans « Général ». */
export function groupByRoom(lines: MissionChecklistLine[]): { room: string; lines: MissionChecklistLine[] }[] {
  const order: string[] = [];
  const map = new Map<string, MissionChecklistLine[]>();
  for (const l of [...lines].sort((a, b) => a.item.position - b.item.position)) {
    const room = l.item.room?.trim() || 'Général';
    if (!map.has(room)) { map.set(room, []); order.push(room); }
    map.get(room)!.push(l);
  }
  return order.map(room => ({ room, lines: map.get(room)! }));
}

// ── Modèle de démarrage ───────────────────────────────────────────────────────
// Un standard vide n'aide personne : on propose une base de ménage de location
// courte durée, que la conciergerie ajuste ensuite.
export const STARTER_CHECKLIST: { room: string; label: string; required?: boolean }[] = [
  { room: 'Général',        label: 'Aérer le logement' },
  { room: 'Général',        label: 'Sortir les poubelles' },
  { room: 'Général',        label: 'Aspirer et laver les sols' },
  { room: 'Général',        label: 'Dépoussiérer les surfaces et meubles' },
  { room: 'Chambre',        label: 'Changer les draps et refaire les lits' },
  { room: 'Chambre',        label: 'Vérifier sous les lits (objets oubliés)' },
  { room: 'Salle de bain',  label: 'Nettoyer douche, lavabo et WC' },
  { room: 'Salle de bain',  label: 'Remettre serviettes propres' },
  { room: 'Salle de bain',  label: 'Réapprovisionner papier toilette et savon' },
  { room: 'Cuisine',        label: 'Vider et nettoyer le réfrigérateur' },
  { room: 'Cuisine',        label: 'Nettoyer plaques, évier et plan de travail' },
  { room: 'Cuisine',        label: 'Lancer / vider le lave-vaisselle' },
  { room: 'Finitions',      label: 'Vérifier l’état général et signaler tout dégât' },
  { room: 'Finitions',      label: 'Photos après ménage', required: false },
];
