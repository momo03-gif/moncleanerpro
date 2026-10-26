import { describe, it, expect } from 'vitest';
import { gainPrestataire, attribuable, releveDuMois, peutConfier, etatVigilance, specialitesValides, specialitesPourMission, metierValide, correspondSpecialite } from './prestataireRegles';

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

describe('prestataires — crédit d’impôt', () => {
  it('ne confie le domicile d’un particulier qu’à un prestataire déclaré SAP', () => {
    expect(peutConfier({ creditImpot: false, sapDeclare: false })).toBe(true);
    expect(peutConfier({ creditImpot: true, sapDeclare: false })).toBe(false);
    expect(peutConfier({ creditImpot: true, sapDeclare: true })).toBe(true);
    expect(peutConfier({})).toBe(true);
  });
});

describe('prestataires — vigilance', () => {
  it('signale les documents manquants', () => {
    const r = etatVigilance([], '2026-10-19');
    expect(r.aJour).toBe(false);
    expect(r.details.map(d => d.etat)).toEqual(['manquant', 'manquant']);
  });

  it('attestation URSSAF valable 6 mois, Kbis 12 mois, on garde la plus récente', () => {
    const r = etatVigilance([
      { kind: 'urssaf', delivered_on: '2026-01-10' },
      { kind: 'urssaf', delivered_on: '2026-05-02' },
      { kind: 'kbis', delivered_on: '2026-02-01' },
    ], '2026-10-19');
    expect(r.details).toEqual([
      { kind: 'urssaf', etat: 'ok', jusqu: '2026-11-02' },
      { kind: 'kbis', etat: 'ok', jusqu: '2027-02-01' },
    ]);
    expect(r.aJour).toBe(true);
  });

  it('expire le lendemain de la fin de validité', () => {
    const r = etatVigilance([{ kind: 'urssaf', delivered_on: '2026-04-01' }, { kind: 'kbis', uploaded_at: '2026-04-01T10:00:00Z' }], '2026-10-02');
    expect(r.details[0]).toEqual({ kind: 'urssaf', etat: 'expire', jusqu: '2026-10-01' });
    expect(r.aJour).toBe(false);
  });

  it('ne garde que les spécialités connues, sans doublon', () => {
    expect(specialitesValides(['vitrerie', 'bureaux', 'vitrerie', 'pirate'])).toEqual(['bureaux', 'vitrerie']);
    expect(specialitesValides('bureaux')).toEqual([]);
    expect(specialitesValides(undefined)).toEqual([]);
  });

  it('déduit les spécialités utiles d’une mission', () => {
    expect(specialitesPourMission({ source: 'hotel', service: 'cleaning' })).toEqual(['hotellerie']);
    expect(specialitesPourMission({ source: 'airbnb', siteType: 'office' })).toEqual(['bureaux']);
    expect(specialitesPourMission({ source: 'airbnb', siteType: 'apartment' })).toEqual(['location_courte']);
    expect(specialitesPourMission({ source: 'airbnb', service: 'delivery' })).toEqual(['livraison', 'linge']);
    expect(correspondSpecialite(['vitrerie', 'hotellerie'], ['hotellerie'])).toBe(true);
    expect(correspondSpecialite(['vitrerie'], [])).toBe(false);
    expect(correspondSpecialite(undefined, ['hotellerie'])).toBe(false);
  });

  it('sépare nettoyage et artisans', () => {
    expect(metierValide('artisan')).toBe('artisan');
    expect(metierValide('pirate')).toBe('nettoyage');
    expect(specialitesValides(['peinture', 'vitrerie'], 'artisan')).toEqual(['peinture']);
    expect(specialitesValides(['peinture', 'vitrerie'], 'nettoyage')).toEqual(['vitrerie']);
  });

  it('propose les artisans pour une intervention', () => {
    expect(specialitesPourMission({ service: 'repair', repairSpecialite: 'serrurerie' })).toEqual(['serrurerie']);
    // Spécialité absente ou pas artisan : tous les artisans conviennent.
    const tous = specialitesPourMission({ service: 'repair' });
    expect(tous).toContain('peinture');
    expect(tous).not.toContain('vitrerie');
    expect(specialitesPourMission({ service: 'repair', repairSpecialite: 'vitrerie' })).toEqual(tous);
  });
});
