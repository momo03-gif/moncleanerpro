import { describe, it, expect } from 'vitest';
import { supplyNeeds, urgentNeeds, type SupplyReport } from './suppliesCompute';

const report = (date: string, items: string[], note?: string): SupplyReport =>
  ({ date, items, missionId: `m-${date}`, note });

describe('supplyNeeds — la liste de courses se déduit des comptes-rendus', () => {
  it('remonte ce qui a été signalé manquant', () => {
    const needs = supplyNeeds([report('2026-08-10', ['Papier toilette', 'Éponges'])], []);
    expect(needs.map(n => n.item).sort()).toEqual(['Papier toilette', 'Éponges']);
  });

  it('oublie ce qui a été racheté depuis', () => {
    const needs = supplyNeeds(
      [report('2026-08-10', ['Papier toilette'])],
      [{ item: 'Papier toilette', restockedAt: '2026-08-11T09:00:00' }],
    );
    expect(needs).toEqual([]);
  });

  it('ressort un article re-signalé APRÈS le rachat', () => {
    const needs = supplyNeeds(
      [report('2026-08-10', ['Papier toilette']), report('2026-08-14', ['Papier toilette'])],
      [{ item: 'Papier toilette', restockedAt: '2026-08-11T09:00:00' }],
    );
    expect(needs).toHaveLength(1);
    expect(needs[0].timesReported).toBe(1);
    expect(needs[0].lastReportedOn).toBe('2026-08-14');
  });

  it('compte les signalements répétés et garde le plus récent', () => {
    const needs = supplyNeeds([
      report('2026-08-05', ['Café / thé']),
      report('2026-08-09', ['Café / thé']),
      report('2026-08-13', ['Café / thé']),
    ], []);
    expect(needs[0]).toMatchObject({ timesReported: 3, lastReportedOn: '2026-08-13', missionId: 'm-2026-08-13' });
  });

  it('classe le plus signalé en premier', () => {
    const needs = supplyNeeds([
      report('2026-08-05', ['Éponges']),
      report('2026-08-09', ['Papier toilette']),
      report('2026-08-13', ['Papier toilette']),
    ], []);
    expect(needs.map(n => n.item)).toEqual(['Papier toilette', 'Éponges']);
  });

  it('rassemble les précisions du cleaner sans les dupliquer', () => {
    const needs = supplyNeeds([
      report('2026-08-09', ['Pastilles lave-vaisselle'], 'il n’en reste qu’une'),
      report('2026-08-13', ['Pastilles lave-vaisselle'], 'il n’en reste qu’une'),
      report('2026-08-14', ['Pastilles lave-vaisselle'], 'boîte vide'),
    ], []);
    expect(needs[0].notes).toEqual(['il n’en reste qu’une', 'boîte vide']);
  });

  it('ne renvoie rien quand aucun consommable n’a été signalé', () => {
    expect(supplyNeeds([report('2026-08-10', [])], [])).toEqual([]);
  });
});

describe('urgentNeeds — signalé plusieurs fois = personne ne l’a racheté', () => {
  it('retient les articles signalés au moins deux fois', () => {
    const needs = supplyNeeds([
      report('2026-08-09', ['Ampoule', 'Éponges']),
      report('2026-08-13', ['Ampoule']),
    ], []);
    expect(urgentNeeds(needs).map(n => n.item)).toEqual(['Ampoule']);
  });
});
