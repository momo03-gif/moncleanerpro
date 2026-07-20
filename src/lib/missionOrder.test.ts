import { describe, it, expect } from 'vitest';
import { sortMissionsForCleaner, sortMissionsByPriority } from './missionOrder';
import type { Mission } from './types';

// Fabrique une mission minimale : seuls les champs de tri nous intéressent ici.
function m(id: string, over: Partial<Mission> = {}): Mission {
  return { id, date: '2026-07-21', time: '09:00', status: 'pending', ...over } as Mission;
}

describe('sortMissionsForCleaner — la mission terminée descend en bas', () => {
  it('remonte la prochaine mission à faire en tête', () => {
    const list = [
      m('a', { createdAt: '2026-07-01T08:00:00Z', status: 'completed' }),
      m('b', { createdAt: '2026-07-01T09:00:00Z' }),
      m('c', { createdAt: '2026-07-01T10:00:00Z' }),
    ];
    expect(sortMissionsForCleaner(list).map(x => x.id)).toEqual(['b', 'c', 'a']);
  });

  it('conserve la priorité habituelle entre missions à faire', () => {
    const list = [
      m('tard', { createdAt: '2026-07-01T10:00:00Z' }),
      m('turnover', { createdAt: '2026-07-01T11:00:00Z', nextArrival: '2026-07-21' }),
    ];
    // La relocation du jour même reste prioritaire malgré son createdAt plus tardif.
    expect(sortMissionsForCleaner(list).map(x => x.id)).toEqual(['turnover', 'tard']);
  });

  it('classe les terminées entre elles selon la priorité commune', () => {
    const list = [
      m('d2', { createdAt: '2026-07-01T11:00:00Z', status: 'completed' }),
      m('d1', { createdAt: '2026-07-01T09:00:00Z', status: 'completed' }),
      m('todo', { createdAt: '2026-07-01T12:00:00Z' }),
    ];
    expect(sortMissionsForCleaner(list).map(x => x.id)).toEqual(['todo', 'd1', 'd2']);
  });

  it("n'altère pas le tri admin (sortMissionsByPriority ignore le statut)", () => {
    const list = [
      m('done', { createdAt: '2026-07-01T08:00:00Z', status: 'completed' }),
      m('todo', { createdAt: '2026-07-01T09:00:00Z' }),
    ];
    expect(sortMissionsByPriority(list).map(x => x.id)).toEqual(['done', 'todo']);
  });
});
