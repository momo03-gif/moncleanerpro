import { describe, it, expect } from 'vitest';
import { serviceParts } from './service';
import { computeMissionGain } from './pay';
import { collapseGroups } from './missionOrder';
import type { Mission } from './types';

// Mission minimale pour les tests (champs non pertinents omis via cast).
const m = (over: Partial<Mission>): Mission => ({
  id: 'x', property: '', address: '', date: '2026-06-10', time: '', duration: 0,
  status: 'accepted', price: 0, type: 'regular', ...over,
} as Mission);

describe('Rendez-vous (service appointment) — interne', () => {
  it('ni ménage ni livraison', () => {
    expect(serviceParts('appointment')).toEqual({ cleaning: false, delivery: false });
  });
  it('gain cleaner = 0 (jamais payé au temps)', () => {
    expect(computeMissionGain({ service: 'appointment', hourlyRate: 20, deliveryRate: 5, durationMinutes: 120 })).toBe(0);
  });
});

describe('collapseGroups — interventions ponctuelles multi-cleaners', () => {
  it('regroupe les lignes d’un même group_id en une intervention', () => {
    const rows = [
      m({ id: 'a', groupId: 'G', cleanerName: 'Ana', price: 90 }),
      m({ id: 'b', groupId: 'G', cleanerName: 'Bob', price: 0 }),
      m({ id: 'c', groupId: 'G', cleanerName: 'Cleo', price: 0 }),
    ];
    const out = collapseGroups(rows);
    expect(out).toHaveLength(1);
    expect(out[0].groupSize).toBe(3);
    expect(out[0].assignees.sort()).toEqual(['Ana', 'Bob', 'Cleo']);
    // La ligne représentative porte le prix client (90).
    expect(out[0].mission.price).toBe(90);
  });

  it('laisse les missions sans group_id telles quelles', () => {
    const rows = [m({ id: 'a' }), m({ id: 'b' })];
    const out = collapseGroups(rows);
    expect(out).toHaveLength(2);
    expect(out.every(e => e.groupSize === 1)).toBe(true);
  });
});
