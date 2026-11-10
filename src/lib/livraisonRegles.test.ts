import { describe, it, expect } from 'vitest';
import { livraisonsACreer, type MenagePourLivraison } from './livraisonRegles';
import { groupMissionsByCleaner } from './missionOrder';
import type { Mission } from './types';

const menage = (id: string, airbnb_id: string | null, date_from = '2026-11-11', extra: Partial<MenagePourLivraison> = {}): MenagePourLivraison =>
  ({ id, airbnb_id, date_from, service: 'cleaning', status: 'pending', ...extra });

describe('livraisonsACreer — une livraison par ménage qui en a besoin', () => {
  const avec = new Set(['baraban', 'partdieu']);

  it('crée la livraison d’un ménage sur un logement qui en a besoin', () => {
    expect(livraisonsACreer([menage('m1', 'baraban')], avec, []).map(m => m.id)).toEqual(['m1']);
  });

  it('rien pour un logement sans livraison', () => {
    expect(livraisonsACreer([menage('m1', 'confluence')], avec, [])).toHaveLength(0);
  });

  it('rien pour une mission sans logement (hôtel, adresse libre)', () => {
    expect(livraisonsACreer([menage('m1', null)], avec, [])).toHaveLength(0);
  });

  it('rien pour une livraison, une intervention, une course ou un ménage+livraison', () => {
    for (const service of ['delivery', 'repair', 'errand', 'both', 'appointment']) {
      expect(livraisonsACreer([menage('m1', 'baraban', '2026-11-11', { service })], avec, [])).toHaveLength(0);
    }
  });

  it('un ménage sans service renseigné reste un ménage', () => {
    expect(livraisonsACreer([menage('m1', 'baraban', '2026-11-11', { service: null })], avec, [])).toHaveLength(1);
  });

  it('pas de doublon avec une livraison déjà créée à la main ce jour-là', () => {
    const existantes = [{ airbnb_id: 'baraban', date_from: '2026-11-11', linked_mission_id: null }];
    expect(livraisonsACreer([menage('m1', 'baraban')], avec, existantes)).toHaveLength(0);
  });

  it('une autre date du même logement reçoit bien la sienne', () => {
    const existantes = [{ airbnb_id: 'baraban', date_from: '2026-11-10' }];
    expect(livraisonsACreer([menage('m1', 'baraban')], avec, existantes)).toHaveLength(1);
  });

  it('une seule livraison par logement et par jour, même avec deux ménages', () => {
    const r = livraisonsACreer([menage('m1', 'baraban'), menage('m2', 'baraban')], avec, []);
    expect(r.map(m => m.id)).toEqual(['m1']);
  });

  it('rien pour un ménage annulé', () => {
    expect(livraisonsACreer([menage('m1', 'baraban', '2026-11-11', { status: 'cancelled' })], avec, [])).toHaveLength(0);
  });

  it('un ménage dont la livraison existe déjà (même déplacée) n’en reçoit pas une 2e', () => {
    const existantes = [{ airbnb_id: 'baraban', date_from: '2026-11-12', linked_mission_id: 'm1' }];
    expect(livraisonsACreer([menage('m1', 'baraban')], avec, existantes)).toHaveLength(0);
  });
});

describe('Liste admin — les livraisons à assigner à part, tout en bas', () => {
  const m = (id: string, extra: Partial<Mission>): Mission =>
    ({ id, date: '2026-11-11', time: '11:00', status: 'pending', service: 'cleaning', ...extra } as Mission);

  it('sépare les livraisons sans livreur des ménages non assignés', () => {
    const groupes = groupMissionsByCleaner([
      m('liv1', { service: 'delivery' }),
      m('men1', {}),
      m('awa1', { cleanerId: 'awa', cleanerName: 'Awa', status: 'accepted' }),
      m('liv2', { service: 'delivery' }),
    ]);
    expect(groupes.map(g => g.key)).toEqual(['awa', '__unassigned__', '__livraisons__']);
    expect(groupes[2].livraisons).toBe(true);
    expect(groupes[2].missions.map(x => x.id).sort()).toEqual(['liv1', 'liv2']);
  });

  it('une livraison assignée rejoint son livreur', () => {
    const groupes = groupMissionsByCleaner([m('liv1', { service: 'delivery', cleanerId: 'moussa', cleanerName: 'Moussa' })]);
    expect(groupes.map(g => g.key)).toEqual(['moussa']);
  });
});
