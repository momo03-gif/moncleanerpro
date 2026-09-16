import { describe, it, expect } from 'vitest';
import { PMS_LIST, findPms, pmsWithApi, supportsApi, pmsSelectable, platformLabel, detectableSources } from './registry';

describe('Registre des logiciels de gestion', () => {
  it('propose tous les logiciels courants, au moins en iCal', () => {
    const ids = PMS_LIST.map(p => p.id);
    for (const expected of [
      'smoobu', 'beds24', 'hostaway', 'hostify', 'superhote', 'lodgify', 'guesty',
      'amenitiz', 'avantio', 'smily', 'hospitable', 'hostfully', 'uplisting',
      'ownerrez', 'octorate', 'eviivo', 'elloha', 'rentalsunited', 'zeevou', 'tokeet',
    ]) {
      expect(ids).toContain(expected);
    }
  });

  it('couvre aussi les places de marché, qui n’ouvrent leur API à personne', () => {
    for (const id of ['airbnb', 'booking', 'vrbo', 'expedia']) {
      expect(findPms(id)?.kind).toBe('marketplace');
      expect(supportsApi(id)).toBe(false);
    }
  });

  it('laisse toujours une porte ouverte à un logiciel inconnu', () => {
    // Le filet de sécurité : un lien .ics quelconque reste connectable.
    expect(findPms('ical')?.kind).toBe('generic');
    expect(findPms('other')?.kind).toBe('generic');
  });

  it('donne un nom lisible à chaque source, et ne rend jamais une case vide', () => {
    for (const p of PMS_LIST) expect(p.label.trim().length).toBeGreaterThan(1);
    expect(platformLabel('hostify')).toBe('Hostify');
    expect(platformLabel('inconnu')).toBe('inconnu');
    expect(platformLabel(null)).toBe('—');
  });

  it('ne propose au choix « Votre logiciel » que des logiciels, API en tête', () => {
    const selectable = pmsSelectable();
    // Aucune place de marché : on ne fait pas espérer une clé qui n'existe pas.
    expect(selectable.some(p => p.kind === 'marketplace')).toBe(false);
    // Ceux qu'on sait lire par API viennent d'abord.
    const firstWithoutApi = selectable.findIndex(p => p.api === false);
    expect(selectable.slice(0, firstWithoutApi).every(p => p.api !== false)).toBe(true);
    // Et « Autre logiciel » ferme la liste, pour les absents.
    expect(selectable[selectable.length - 1].id).toBe('other');
  });

  it('ne déclare des hôtes que pour des sources réellement reconnaissables', () => {
    const sources = detectableSources();
    expect(sources.length).toBeGreaterThan(15);
    // Les filets génériques ne se détectent pas : ils sont le défaut.
    expect(sources.some(s => s.platform === 'ical' || s.platform === 'other')).toBe(false);
    for (const s of sources) expect(s.hosts.length).toBeGreaterThan(0);
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
    // Connecteurs bâtis sur le socle REST commun (cf. catalog.ts) : proposés,
    // mais annoncés comme non confirmés tant qu'aucune vraie clé n'est passée.
    for (const id of ['hostify', 'hospitable', 'ownerrez', 'hostfully', 'uplisting', 'guesty']) {
      expect(supportsApi(id)).toBe(true);
      const api = findPms(id)!.api;
      expect(api !== false && api.verified).toBe(false);
    }
    // Ceux-là n'ont toujours aucune voie API praticable (OAuth partenaire, SOAP,
    // ou accès fermé) : l'iCal reste la seule réponse honnête.
    expect(supportsApi('superhote')).toBe(false);
    expect(supportsApi('amenitiz')).toBe(false);
    expect(supportsApi('avantio')).toBe(false);
  });

  it('dit la vérité sur ce qui est confirmé, et l’aligne sur les descripteurs', async () => {
    // Le registre est lu par le navigateur, le catalogue par le serveur. Les deux
    // portent le drapeau « confirmé » : s'ils divergent, l'écran ment.
    const { REST_CONNECTORS } = await import('./catalog');
    for (const pms of pmsWithApi()) {
      if (pms.api === false) continue;
      const connector = REST_CONNECTORS[pms.id];
      if (!connector) {
        // Connecteur dédié (Smoobu, Hostaway, Beds24, Lodgify) : écrit contre la
        // documentation de l'éditeur, donc confirmé par construction.
        expect(pms.api.verified ?? true).toBe(true);
        continue;
      }
      expect(pms.api.verified).toBe(connector.descriptor.verified);
    }
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
