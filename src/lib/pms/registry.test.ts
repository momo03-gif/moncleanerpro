import { describe, it, expect } from 'vitest';
import { PMS_LIST, findPms, pmsWithApi, supportsApi } from './registry';

describe('Registre des logiciels de gestion', () => {
  it('propose tous les logiciels courants, au moins en iCal', () => {
    const ids = PMS_LIST.map(p => p.id);
    for (const expected of ['smoobu', 'beds24', 'hostaway', 'hostify', 'superhote', 'lodgify']) {
      expect(ids).toContain(expected);
    }
  });

  it('donne toujours une aide pour trouver le lien iCal — c’est la voie universelle', () => {
    expect(PMS_LIST.every(p => p.icalHelp.trim().length > 10)).toBe(true);
  });

  it('n’annonce une API que pour les logiciels réellement branchés', () => {
    // Connecteurs écrits (cf. PMS_FETCHERS dans reservationSync et PMS_LISTERS
    // dans la route) : toute entrée `api` ici doit avoir son pendant là-bas.
    expect(supportsApi('smoobu')).toBe(true);
    expect(supportsApi('hostaway')).toBe(true);
    expect(supportsApi('beds24')).toBe(true);
    expect(supportsApi('lodgify')).toBe(true);
    // Aucune documentation publique : l'iCal reste la seule voie honnête.
    expect(supportsApi('hostify')).toBe(false);
    expect(supportsApi('superhote')).toBe(false);
    expect(supportsApi('guesty')).toBe(false);
  });

  it('refuse un logiciel inconnu', () => {
    expect(supportsApi('logiciel-invente')).toBe(false);
    expect(findPms('logiciel-invente')).toBeUndefined();
  });

  it('chaque connecteur annoncé décrit les champs à saisir', () => {
    for (const pms of pmsWithApi()) {
      expect(pms.api).not.toBe(false);
      if (pms.api === false) continue;
      expect(pms.api.fields.length).toBeGreaterThan(0);
      expect(pms.api.help.trim().length).toBeGreaterThan(10);
    }
  });

  it('n’a pas d’identifiant en double', () => {
    const ids = PMS_LIST.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
