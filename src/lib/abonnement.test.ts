import { describe, it, expect } from 'vitest';
import { annulationSansFrais, limiteAnnulation, mensualite, frequence, FREQUENCES } from './abonnement';

describe('Annulation — 24 h avant, comme le marché', () => {
  const intervention = new Date('2026-10-06T09:00:00+02:00');

  it('laisse annuler librement plus de 24 h avant', () => {
    expect(annulationSansFrais(intervention, new Date('2026-10-04T09:00:00+02:00'))).toBe(true);
    expect(annulationSansFrais(intervention, new Date('2026-10-05T08:59:00+02:00'))).toBe(true);
  });

  it('facture en deçà de 24 h — le créneau ne se revend pas', () => {
    expect(annulationSansFrais(intervention, new Date('2026-10-05T18:00:00+02:00'))).toBe(false);
    expect(annulationSansFrais(intervention, new Date('2026-10-06T07:00:00+02:00'))).toBe(false);
  });

  it('compare des instants, pas des jours', () => {
    // Annuler « la veille » à 23 h n'est pas annuler la veille à 9 h.
    expect(annulationSansFrais(intervention, new Date('2026-10-05T23:00:00+02:00'))).toBe(false);
  });

  it('ne facture pas sur une date illisible', () => {
    expect(annulationSansFrais('pas une date')).toBe(true);
  });

  it('donne la limite exacte, à afficher au client', () => {
    expect(limiteAnnulation(intervention).toISOString())
      .toBe(new Date('2026-10-05T09:00:00+02:00').toISOString());
  });
});

describe('Mensualité — ce que le client compare avant de souscrire', () => {
  it('convertit un prix par passage en montant mensuel', () => {
    // 4,33 semaines par mois en moyenne : 12 mois de 4 semaines feraient 48
    // interventions au lieu de 52, et le client se sentirait floué en janvier.
    expect(mensualite(40, 'hebdomadaire').parMois).toBe(173.2);
    expect(mensualite(40, 'quinzaine').parMois).toBe(86.8);
    expect(mensualite(40, 'mensuel').parMois).toBe(43.2);
  });

  it('montre le reste à charge après avance immédiate', () => {
    // C'est l'argument décisif face aux plateformes : 50 % déduits tout de
    // suite, pas remboursés un an plus tard.
    const m = mensualite(40, 'hebdomadaire', 0.5);
    expect(m.parMois).toBe(173.2);
    expect(m.resteAChargeMois).toBe(86.6);
  });

  it('ne déduit rien pour un client non éligible', () => {
    expect(mensualite(40, 'quinzaine', 0).resteAChargeMois).toBe(86.8);
  });

  it('propose trois fréquences, de la plus dense à la plus espacée', () => {
    expect(FREQUENCES.map(f => f.semaines)).toEqual([1, 2, 4]);
    expect(frequence('quinzaine').libelle).toBe('Une semaine sur deux');
  });
});
