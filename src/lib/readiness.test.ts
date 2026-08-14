import { describe, it, expect } from 'vitest';
import { missionReadiness } from './readiness';

// `now` est injecté pour que les tests ne dépendent ni de l'heure d'exécution
// ni du fuseau de la machine.
const at = (iso: string) => new Date(iso);

describe('missionReadiness — ménage terminé', () => {
  it('annonce que le logement est prêt, sans jamais donner d’horaire de ménage', () => {
    const r = missionReadiness({ status: 'completed', date: '2026-08-14' }, at('2026-08-14T14:00:00'));
    expect(r).toEqual({ tone: 'ready', label: 'Logement prêt', detail: 'ménage terminé', turnover: false });
  });

  it('précise le jour d’arrivée sur un turnover', () => {
    const r = missionReadiness(
      { status: 'completed', date: '2026-08-14', nextArrival: '2026-08-14', nextArrivalTime: '15:00' },
      at('2026-08-14T16:00:00'),
    );
    expect(r?.tone).toBe('ready');
    expect(r?.turnover).toBe(true);
    // Aucune heure de ménage ne doit apparaître : ni début, ni fin, ni durée.
    expect(`${r?.label} ${r?.detail}`).not.toMatch(/\d+h\d*/);
  });
});

describe('missionReadiness — ménage pas encore terminé', () => {
  it('devient urgent quand l’arrivée est dans moins de 3 h', () => {
    const r = missionReadiness(
      { status: 'pending', date: '2026-08-14', nextArrival: '2026-08-14', nextArrivalTime: '15:00' },
      at('2026-08-14T13:00:00'),
    );
    expect(r?.tone).toBe('urgent');
    expect(r?.label).toBe('Arrivée à 15h');
    expect(r?.detail).toBe('2h pour faire le ménage');
  });

  it('reste calme quand il y a encore de la marge', () => {
    const r = missionReadiness(
      { status: 'pending', date: '2026-08-14', nextArrival: '2026-08-14', nextArrivalTime: '15:00' },
      at('2026-08-14T08:00:00'),
    );
    expect(r?.tone).toBe('planned');
  });

  it('passe en rouge quand l’heure d’arrivée est dépassée', () => {
    const r = missionReadiness(
      { status: 'accepted', date: '2026-08-14', nextArrival: '2026-08-14', nextArrivalTime: '15:00' },
      at('2026-08-14T16:30:00'),
    );
    expect(r?.tone).toBe('late');
    expect(r?.label).toBe('Arrivée dépassée (15h)');
  });

  it('alerte sur un turnover sans heure d’arrivée connue', () => {
    const r = missionReadiness(
      { status: 'pending', date: '2026-08-14', nextArrival: '2026-08-14' },
      at('2026-08-14T09:00:00'),
    );
    expect(r?.tone).toBe('urgent');
  });

  it('signale un ménage en cours et le temps restant avant l’arrivée', () => {
    const r = missionReadiness(
      { status: 'in_progress', date: '2026-08-14', nextArrival: '2026-08-14', nextArrivalTime: '15:00' },
      at('2026-08-14T14:15:00'),
    );
    expect(r?.tone).toBe('progress');
    expect(r?.detail).toBe("45 min avant l'arrivée de 15h");
  });

  it('signale un ménage en cours alors que l’arrivée est passée', () => {
    const r = missionReadiness(
      { status: 'in_progress', date: '2026-08-14', nextArrival: '2026-08-14', nextArrivalTime: '15:00' },
      at('2026-08-14T15:30:00'),
    );
    expect(r?.tone).toBe('late');
  });

  it('ne dit rien du temps passé sur un ménage en cours hors turnover', () => {
    const r = missionReadiness({ status: 'in_progress', date: '2026-08-14' }, at('2026-08-14T14:15:00'));
    expect(r).toEqual({ tone: 'progress', label: 'Ménage en cours', turnover: false });
  });

  it('signale un ménage de la veille jamais effectué', () => {
    const r = missionReadiness({ status: 'pending', date: '2026-08-13' }, at('2026-08-14T09:00:00'));
    expect(r?.tone).toBe('late');
    expect(r?.label).toBe('Ménage non effectué');
  });

  it('annonce un turnover à venir', () => {
    const r = missionReadiness(
      { status: 'pending', date: '2026-08-16', nextArrival: '2026-08-16', nextArrivalTime: '16:00' },
      at('2026-08-14T09:00:00'),
    );
    expect(r?.tone).toBe('planned');
    expect(r?.label).toBe('Turnover');
    expect(r?.detail).toBe('arrivée à 16h');
  });
});

describe('missionReadiness — cas neutres', () => {
  it('ne dit rien d’une mission annulée', () => {
    expect(missionReadiness({ status: 'cancelled', date: '2026-08-14' }, at('2026-08-14T09:00:00'))).toBeNull();
  });

  it('reste sobre pour un ménage futur sans arrivée', () => {
    const r = missionReadiness({ status: 'pending', date: '2026-08-20' }, at('2026-08-14T09:00:00'));
    expect(r).toEqual({ tone: 'planned', label: 'Ménage prévu', turnover: false });
  });
});
