import { describe, it, expect } from 'vitest';
import { noShowPossible, patchNoShow, patchAnnulerNoShow, motifNoShow, titreNoShow } from './noShow';

const AT = '2026-10-25T10:00:00.000Z';

describe('no show — règles', () => {
  it('ne concerne que le ménage', () => {
    expect(noShowPossible('cleaning')).toBe(true);
    expect(noShowPossible('both')).toBe(true);
    expect(noShowPossible(undefined)).toBe(true);
    expect(noShowPossible('delivery')).toBe(false);
    expect(noShowPossible('appointment')).toBe(false);
  });

  it('clôture la mission et remplace prix et gain par les forfaits', () => {
    const p = patchNoShow({ price: 65, cleaner_gain: 28.5 }, { client: 25, cleaner: 12 }, { at: AT, by: 'cleaner', note: '  Lits intacts ' });
    expect(p).toMatchObject({
      status: 'done', ended_at: AT, no_show: true, no_show_by: 'cleaner', no_show_note: 'Lits intacts',
      price: 25, cleaner_gain: 12, no_show_prev_price: 65, no_show_prev_gain: 28.5,
    });
    expect(p).not.toHaveProperty('prestataire_gain');
  });

  it('paie un prestataire au forfait cleaner, et garde ce qu’on lui devait', () => {
    const p = patchNoShow({ price: 65, cleaner_gain: 0, prestataire_id: 'p1', prestataire_gain: 30 }, { client: 25, cleaner: 12 }, { at: AT, by: 'admin' });
    expect(p.prestataire_gain).toBe(12);
    expect(p.no_show_prev_prestataire_gain).toBe(30);
    expect(p.no_show_note).toBeNull();
  });

  it('ne laisse passer ni montant négatif ni demi-centime', () => {
    const p = patchNoShow({}, { client: -5, cleaner: 10.006 }, { at: AT, by: 'admin' });
    expect(p.price).toBe(0);
    expect(p.cleaner_gain).toBe(10.01);
  });

  it('annuler rend les montants d’avant et efface les marques', () => {
    const p = patchAnnulerNoShow({ no_show_prev_price: 65, no_show_prev_gain: 28.5, prestataire_id: 'p1', no_show_prev_prestataire_gain: 30 });
    expect(p).toMatchObject({ no_show: false, no_show_at: null, price: 65, cleaner_gain: 28.5, prestataire_gain: 30 });
  });
});

describe('No show / prolongation — le motif', () => {
  const AT2 = '2026-10-31T10:00:00.000Z';
  it('enregistre le motif, « no show » par défaut', () => {
    expect(patchNoShow({ price: 65 }, { client: 25, cleaner: 12 }, { at: AT2, by: 'cleaner' }).no_show_reason).toBe('no_show');
    expect(patchNoShow({ price: 65 }, { client: 25, cleaner: 12 }, { at: AT2, by: 'cleaner', motif: 'prolongation' }).no_show_reason).toBe('prolongation');
  });
  it('efface le motif quand on annule', () => {
    expect(patchAnnulerNoShow({ no_show_prev_price: 65 }).no_show_reason).toBeNull();
  });
  it('lit les anciens no show (sans motif) comme « logement non utilisé »', () => {
    expect(motifNoShow(null)).toBe('no_show');
    expect(motifNoShow('n’importe quoi')).toBe('no_show');
    expect(titreNoShow(undefined)).toBe('Logement non utilisé');
    expect(titreNoShow('prolongation')).toBe('Prolongation du voyageur');
  });
});
