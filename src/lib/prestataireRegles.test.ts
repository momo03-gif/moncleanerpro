import { describe, it, expect } from 'vitest';
import { gainPrestataire, attribuable, releveDuMois } from './prestataireRegles';

describe('prestataires — règles', () => {
  it('doit au prestataire son taux × durée, au centime', () => {
    expect(gainPrestataire(18, 90)).toBe(27);
    expect(gainPrestataire(17.5, 50)).toBe(14.58);
    expect(gainPrestataire(0, 60)).toBe(0);
  });

  it('ne laisse changer d’agent qu’avant le démarrage', () => {
    expect(attribuable('pending')).toBe(true);
    expect(attribuable('assigned')).toBe(true);
    expect(attribuable('inprogress')).toBe(false);
    expect(attribuable('done')).toBe(false);
    expect(attribuable('cancelled')).toBe(false);
    expect(attribuable(null)).toBe(false);
  });

  it('relevé du mois : seulement les missions terminées de ce mois', () => {
    const r = releveDuMois([
      { status: 'done', date_from: '2026-10-03', prestataire_gain: 27, mission_duration_minutes: 90 },
      { status: 'done', date_from: '2026-10-20', prestataire_gain: '14.58', mission_duration_minutes: '50' },
      { status: 'cancelled', date_from: '2026-10-05', prestataire_gain: 30 },
      { status: 'assigned', date_from: '2026-10-25', prestataire_gain: 30 },
      { status: 'done', date_from: '2026-09-30', prestataire_gain: 30 },
    ], '2026-10');
    expect(r).toEqual({ missions: 2, minutes: 140, montant: 41.58 });
  });
});
