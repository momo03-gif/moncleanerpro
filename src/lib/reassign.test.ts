import { describe, it, expect } from 'vitest';
import {
  missionsTransferables, apercuTransfert, refusTransfert, type MissionTransferable,
} from './reassign';

const AUJ = '2026-09-23';

const m = (id: string, extra: Partial<MissionTransferable> = {}): MissionTransferable =>
  ({ id, cleanerId: 'c1', status: 'assigned', date: '2026-09-25', ...extra });

describe('Ce qu’un transfert déplace', () => {
  it('prend les missions à venir attribuées à l’intervenant', () => {
    const r = missionsTransferables([m('a'), m('b', { date: '2026-10-02' })], 'c1', AUJ);
    expect(r.map(x => x.id)).toEqual(['a', 'b']);
  });

  it('prend aussi celles du jour même — la journée n’est pas finie', () => {
    expect(missionsTransferables([m('a', { date: AUJ })], 'c1', AUJ)).toHaveLength(1);
  });

  it('ne touche pas aux missions d’un autre intervenant', () => {
    expect(missionsTransferables([m('a', { cleanerId: 'c2' })], 'c1', AUJ)).toHaveLength(0);
  });
});

describe('Ce qu’un transfert ne touche jamais', () => {
  it('laisse une mission TERMINÉE — elle est payée à celui qui l’a faite', () => {
    // La déplacer fausserait deux fiches de paie d'un coup.
    expect(missionsTransferables([m('a', { status: 'done' })], 'c1', AUJ)).toHaveLength(0);
  });

  it('laisse une mission EN COURS — quelqu’un est sur place', () => {
    expect(missionsTransferables([m('a', { status: 'inprogress' })], 'c1', AUJ)).toHaveLength(0);
  });

  it('laisse une mission ANNULÉE', () => {
    expect(missionsTransferables([m('a', { status: 'cancelled' })], 'c1', AUJ)).toHaveLength(0);
  });

  it('laisse le passé non fait — cela relève d’une décision, pas d’un transfert', () => {
    expect(missionsTransferables([m('a', { date: '2026-09-20' })], 'c1', AUJ)).toHaveLength(0);
  });

  it('laisse une mission sans date plutôt que de la déplacer à l’aveugle', () => {
    expect(missionsTransferables([m('a', { date: null })], 'c1', AUJ)).toHaveLength(0);
  });
});

describe('Ce qu’on annonce avant d’agir', () => {
  it('donne le nombre et l’étendue des dates', () => {
    const a = apercuTransfert(
      [m('a', { date: '2026-09-25' }), m('b', { date: '2026-10-08' }), m('c', { date: '2026-09-30' })],
      'c1', AUJ);
    expect(a).toEqual({ nombre: 3, premiere: '2026-09-25', derniere: '2026-10-08' });
  });

  it('annonce zéro sans inventer de dates', () => {
    expect(apercuTransfert([], 'c1', AUJ)).toEqual({ nombre: 0, premiere: undefined, derniere: undefined });
  });
});

describe('Quand le transfert n’a pas de sens', () => {
  it('exige un intervenant qui reprend', () => {
    expect(refusTransfert('c1', '', 3)).toContain('Choisissez');
  });

  it('refuse de transférer à soi-même', () => {
    expect(refusTransfert('c1', 'c1', 3)).toContain('déjà le même');
  });

  it('refuse un transfert vide', () => {
    expect(refusTransfert('c1', 'c2', 0)).toContain('Aucune mission');
  });

  it('laisse passer un transfert valable', () => {
    expect(refusTransfert('c1', 'c2', 3)).toBeNull();
  });
});

describe('Les deux vocabulaires de statut cohabitent', () => {
  it('accepte « assigned » (base) comme « accepted » (application)', () => {
    // On ne renomme jamais ces statuts : la règle doit donc comprendre les deux,
    // sinon l'aperçu affiché à l'écran et le transfert réel divergeraient.
    expect(missionsTransferables([m('a', { status: 'assigned' })], 'c1', AUJ)).toHaveLength(1);
    expect(missionsTransferables([m('b', { status: 'accepted' })], 'c1', AUJ)).toHaveLength(1);
  });

  it('refuse « inprogress » comme « in_progress »', () => {
    expect(missionsTransferables([m('a', { status: 'inprogress' })], 'c1', AUJ)).toHaveLength(0);
    expect(missionsTransferables([m('b', { status: 'in_progress' })], 'c1', AUJ)).toHaveLength(0);
  });

  it('refuse « done » comme « completed »', () => {
    expect(missionsTransferables([m('a', { status: 'done' })], 'c1', AUJ)).toHaveLength(0);
    expect(missionsTransferables([m('b', { status: 'completed' })], 'c1', AUJ)).toHaveLength(0);
  });
});
