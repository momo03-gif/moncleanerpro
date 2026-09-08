import { describe, it, expect } from 'vitest';
import { resolveOrigin, originLabel } from './origin';

const HOST = 'moncleanerpro.fr';

describe('resolveOrigin', () => {
  it('navigation interne → le chemin de la page d’origine', () => {
    expect(resolveOrigin('https://moncleanerpro.fr/femme-de-menage-lyon', HOST)).toBe('/femme-de-menage-lyon');
  });
  it('le sous-domaine www est traité comme interne', () => {
    expect(resolveOrigin('https://www.moncleanerpro.fr/grand-menage-lyon', HOST)).toBe('/grand-menage-lyon');
  });
  it('la page d’accueil donne « / »', () => {
    expect(resolveOrigin('https://moncleanerpro.fr/', HOST)).toBe('/');
  });
  it('la barre finale est retirée, pour ne pas dédoubler les statistiques', () => {
    expect(resolveOrigin('https://moncleanerpro.fr/menage-domicile-lyon/', HOST)).toBe('/menage-domicile-lyon');
  });

  // Vie privée : un référent peut transporter n'importe quoi en paramètre.
  it('la requête est retirée du chemin', () => {
    expect(resolveOrigin('https://moncleanerpro.fr/blog/x?email=jean@exemple.fr', HOST)).toBe('/blog/x');
  });

  it('référent externe → le domaine seul', () => {
    expect(resolveOrigin('https://www.google.com/search?q=femme+de+menage', HOST)).toBe('google.com');
    expect(resolveOrigin('https://l.facebook.com/', HOST)).toBe('l.facebook.com');
  });

  it('sans référent → accès direct', () => {
    expect(resolveOrigin('', HOST)).toBe('direct');
    expect(resolveOrigin(null, HOST)).toBe('direct');
    expect(resolveOrigin(undefined, HOST)).toBe('direct');
  });
  it('référent illisible → accès direct plutôt qu’une valeur douteuse', () => {
    expect(resolveOrigin('pas une url', HOST)).toBe('direct');
  });

  it('un ?src explicite l’emporte : c’est le seul moyen de tracer le hors-ligne', () => {
    expect(resolveOrigin('https://moncleanerpro.fr/accueil', HOST, 'flyer-villeurbanne')).toBe('flyer-villeurbanne');
  });
  it('un ?src vide ne masque pas le référent', () => {
    expect(resolveOrigin('https://moncleanerpro.fr/prix-menage-domicile-lyon', HOST, '  ')).toBe('/prix-menage-domicile-lyon');
  });

  it('une valeur démesurée est tronquée', () => {
    expect(resolveOrigin(null, HOST, 'x'.repeat(400)).length).toBe(120);
  });
});

describe('originLabel', () => {
  it('rend les valeurs lisibles pour l’admin', () => {
    expect(originLabel('/femme-de-menage-lyon')).toBe('Page /femme-de-menage-lyon');
    expect(originLabel('/')).toBe('Page d’accueil');
    expect(originLabel('direct')).toBe('Accès direct');
    expect(originLabel('google.com')).toBe('Depuis google.com');
  });
  it('les demandes antérieures n’ont pas d’origine', () => {
    expect(originLabel(null)).toBe('Non renseignée');
    expect(originLabel('')).toBe('Non renseignée');
  });
});
