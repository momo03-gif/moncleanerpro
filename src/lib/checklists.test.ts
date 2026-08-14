import { describe, it, expect } from 'vitest';
import { checklistProgress, groupByRoom, STARTER_CHECKLIST } from './checklistCompute';
import type { MissionChecklistLine } from './types';

const line = (
  id: string,
  { required = true, checked = false, room, position = 0 }: { required?: boolean; checked?: boolean; room?: string; position?: number } = {},
): MissionChecklistLine => ({
  item: { id, airbnbId: 'apt', label: `Point ${id}`, room, position, required },
  check: checked ? { missionId: 'm', itemId: id, labelSnapshot: `Point ${id}`, checkedAt: '2026-08-14T11:00:00Z' } : undefined,
});

describe('checklistProgress — conformité au standard', () => {
  it('compte les points requis cochés', () => {
    const p = checklistProgress([line('a', { checked: true }), line('b'), line('c', { checked: true })]);
    expect(p).toMatchObject({ done: 2, total: 3, percent: 67, complete: false });
  });

  it('est complète quand tous les points requis sont cochés', () => {
    const p = checklistProgress([line('a', { checked: true }), line('b', { checked: true })]);
    expect(p).toMatchObject({ done: 2, total: 2, percent: 100, complete: true });
  });

  it('un point OPTIONNEL non fait ne rend pas le ménage non conforme', () => {
    const p = checklistProgress([line('a', { checked: true }), line('b', { required: false })]);
    expect(p.complete).toBe(true);
    expect(p.total).toBe(1);
    expect(p.extras).toBe(0);
  });

  it('compte les points optionnels cochés à part', () => {
    const p = checklistProgress([line('a', { checked: true }), line('b', { required: false, checked: true })]);
    expect(p.extras).toBe(1);
    expect(p.total).toBe(1);
  });

  it('sans standard défini, rien à reprocher', () => {
    expect(checklistProgress([])).toMatchObject({ done: 0, total: 0, percent: 100, complete: true });
  });
});

describe('groupByRoom — regroupement par pièce', () => {
  it('respecte l’ordre des positions et garde l’ordre d’apparition des pièces', () => {
    const groups = groupByRoom([
      line('c', { room: 'Cuisine', position: 2 }),
      line('a', { room: 'Chambre', position: 0 }),
      line('b', { room: 'Chambre', position: 1 }),
    ]);
    expect(groups.map(g => g.room)).toEqual(['Chambre', 'Cuisine']);
    expect(groups[0].lines.map(l => l.item.id)).toEqual(['a', 'b']);
  });

  it('range les points sans pièce dans « Général »', () => {
    const groups = groupByRoom([line('a')]);
    expect(groups[0].room).toBe('Général');
  });
});

describe('STARTER_CHECKLIST — modèle de démarrage', () => {
  it('couvre les pièces d’une location courte durée', () => {
    const rooms = new Set(STARTER_CHECKLIST.map(i => i.room));
    expect(rooms).toContain('Cuisine');
    expect(rooms).toContain('Salle de bain');
    expect(rooms).toContain('Chambre');
  });

  it('ne contient aucun intitulé vide', () => {
    expect(STARTER_CHECKLIST.every(i => i.label.trim().length > 0)).toBe(true);
  });
});
