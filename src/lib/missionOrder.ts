import type { Mission } from './types';

// ── Ordre & regroupement des missions attribuées ──────────────────────────────
// Logique unique partagée entre l'admin et le cleaner pour garantir un affichage
// identique des deux côtés.
//
// Priorité de tri (à date égale) :
//   1. Relocation le jour même (nextArrival === date) → toujours en premier.
//   2. Plusieurs relocations le même jour → heure d'entrée croissante.
//   3. Sinon → ordre d'attribution (createdAt croissant).
//
// Le tri primaire reste la date (chronologique) : en vue multi-jours, les missions
// d'aujourd'hui passent avant celles de demain. Dans une vue d'une seule journée,
// les trois priorités ci-dessus s'appliquent telles quelles.

const LABEL_NON_ASSIGNE = 'Non assigné';

/** Une relocation le jour même : nouvelle arrivée client à la date du ménage. */
export function isSameDayTurnover(m: Mission): boolean {
  return !!m.nextArrival && m.nextArrival === m.date;
}

/** Comparateur de priorité commun admin / cleaner. */
export function compareMissionPriority(a: Mission, b: Mission): number {
  // Tri primaire : date croissante (chronologie).
  const byDate = (a.date ?? '').localeCompare(b.date ?? '');
  if (byDate !== 0) return byDate;

  // Priorité 0 : ordre MANUEL fixé par l'admin (à date égale). Prime sur tout le
  // reste — l'admin classe ses missions « comme il veut » et le cleaner voit le
  // même ordre. Les missions sans rang manuel passent après celles qui en ont un.
  const ma = a.manualOrder;
  const mb = b.manualOrder;
  if (ma != null && mb != null && ma !== mb) return ma - mb;
  if (ma != null && mb == null) return -1;
  if (ma == null && mb != null) return 1;

  // Priorité 1 : relocation le jour même en tête.
  const aTurn = isSameDayTurnover(a);
  const bTurn = isSameDayTurnover(b);
  if (aTurn !== bTurn) return aTurn ? -1 : 1;

  // Priorité 2 : entre relocations du même jour, heure d'entrée croissante.
  if (aTurn && bTurn) {
    const ta = a.nextArrivalTime ?? '';
    const tb = b.nextArrivalTime ?? '';
    if (ta && tb && ta !== tb) return ta.localeCompare(tb);
    if (ta && !tb) return -1;
    if (!ta && tb) return 1;
  }

  // Priorité 3 : ordre d'attribution (createdAt croissant).
  const ca = a.createdAt ?? '';
  const cb = b.createdAt ?? '';
  if (ca && cb && ca !== cb) return ca.localeCompare(cb);
  if (ca && !cb) return -1;
  if (!ca && cb) return 1;

  // Départage final : heure de la mission.
  return (a.time ?? '').localeCompare(b.time ?? '');
}

/** Renvoie une copie triée selon la priorité commune. */
export function sortMissionsByPriority(missions: Mission[]): Mission[] {
  return [...missions].sort(compareMissionPriority);
}

/**
 * Ordre d'exécution côté cleaner : une mission TERMINÉE bascule en bas de la
 * liste, et la suivante à faire remonte en tête. À l'intérieur de chaque bloc
 * (à faire / terminées), la priorité commune s'applique normalement.
 */
export function sortMissionsForCleaner(missions: Mission[]): Mission[] {
  return [...missions].sort((a, b) => {
    const aDone = a.status === 'completed';
    const bDone = b.status === 'completed';
    if (aDone !== bDone) return aDone ? 1 : -1;
    return compareMissionPriority(a, b);
  });
}

// ── Regroupement « intervention » (one-shot multi-cleaners) ──────────────────────
// Une intervention ponctuelle réalisée par plusieurs cleaners = N lignes mission
// partageant un group_id. Pour le PLANNING, on les présente comme UNE seule
// intervention listant ses intervenants. Les missions sans group_id restent seules.
export interface PlanningEntry {
  mission: Mission;        // ligne représentative (porteuse du prix client)
  assignees: string[];     // noms des intervenants (cleaners) de l'intervention
  groupSize: number;       // nombre de lignes regroupées
}

export function collapseGroups(missions: Mission[]): PlanningEntry[] {
  const byGroup = new Map<string, PlanningEntry>();
  const result: PlanningEntry[] = [];
  for (const m of missions) {
    if (m.groupId) {
      const existing = byGroup.get(m.groupId);
      if (existing) {
        if (m.cleanerName) existing.assignees.push(m.cleanerName);
        existing.groupSize++;
        // La ligne représentative est celle qui porte le prix client (> 0).
        if ((m.price ?? 0) > (existing.mission.price ?? 0)) existing.mission = m;
        continue;
      }
      const entry: PlanningEntry = { mission: m, assignees: m.cleanerName ? [m.cleanerName] : [], groupSize: 1 };
      byGroup.set(m.groupId, entry);
      result.push(entry);
    } else {
      result.push({ mission: m, assignees: m.cleanerName ? [m.cleanerName] : [], groupSize: 1 });
    }
  }
  return result;
}

export interface CleanerMissionGroup {
  cleanerId: string | null;
  cleanerName: string;
  missions: Mission[];
}

/**
 * Regroupe les missions par cleaner, chaque groupe trié par priorité.
 * Groupes ordonnés alphabétiquement, « Non assigné » toujours en dernier.
 */
export function groupMissionsByCleaner(missions: Mission[]): CleanerMissionGroup[] {
  const groups = new Map<string, CleanerMissionGroup>();

  for (const m of missions) {
    const key = m.cleanerId ?? '__unassigned__';
    let g = groups.get(key);
    if (!g) {
      g = {
        cleanerId: m.cleanerId ?? null,
        cleanerName: m.cleanerName?.trim() || LABEL_NON_ASSIGNE,
        missions: [],
      };
      groups.set(key, g);
    }
    g.missions.push(m);
  }

  const list = Array.from(groups.values());
  list.forEach(g => g.missions.sort(compareMissionPriority));
  list.sort((a, b) => {
    const aUn = a.cleanerId === null;
    const bUn = b.cleanerId === null;
    if (aUn !== bUn) return aUn ? 1 : -1; // « Non assigné » en dernier
    return a.cleanerName.localeCompare(b.cleanerName, 'fr', { sensitivity: 'base' });
  });
  return list;
}
