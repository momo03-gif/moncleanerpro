import { describe, it, expect } from 'vitest';
import { sortMissionsForCleaner, sortMissionsByPriority, fusionnerMissions } from './missionOrder';
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

describe('fusionnerMissions — mise à jour ciblée du planning', () => {
  const a = { id: 'a', date: '2026-10-04' } as Mission;
  const b = { id: 'b', date: '2026-10-04' } as Mission;

  it('remplace une mission modifiée, sans toucher aux autres', () => {
    const a2 = { ...a, status: 'completed' } as Mission;
    const r = fusionnerMissions([a, b], ['a'], [{ mission: a2 }]);
    expect(r).toEqual([a2, b]);
  });

  it('ajoute une mission qui vient d’apparaître (nouvelle assignation)', () => {
    const c = { id: 'c', date: '2026-10-05' } as Mission;
    expect(fusionnerMissions([a], ['c'], [{ mission: c }]).map(m => m.id)).toEqual(['a', 'c']);
  });

  it('retire une mission qui n’existe plus pour nous', () => {
    expect(fusionnerMissions([a, b], ['a'], [{ mission: null }]).map(m => m.id)).toEqual(['b']);
  });

  it('ne retire RIEN quand la relecture est incertaine (réseau)', () => {
    expect(fusionnerMissions([a, b], ['a'], [null]).map(m => m.id)).toEqual(['a', 'b']);
  });

  it('ignore une mission d’un autre qui ne nous concerne pas', () => {
    expect(fusionnerMissions([a], ['zz'], [{ mission: null }]).map(m => m.id)).toEqual(['a']);
  });
});
