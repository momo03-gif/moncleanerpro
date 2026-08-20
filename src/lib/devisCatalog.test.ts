import { describe, it, expect } from 'vitest';
import { classify, buildCatalog, MACRO_DEF } from './devisCatalog';
import type { Tarif } from './devis';

const t = (nom: string): Tarif => ({ id: nom, nom, unite: 'forfait', prix: 100, actif: true } as Tarif);
const macroOf = (nom: string) => classify(t(nom)).macro;
const sectionOf = (nom: string) => classify(t(nom)).section;

describe('Airbnb & Conciergerie — une carte à part entière', () => {
  it('figure parmi les macro-catégories, distincte du résidentiel', () => {
    const ids = MACRO_DEF.map(m => m.id);
    expect(ids).toContain('airbnb');
    expect(ids).toContain('residentiel');
    // Le résidentiel ne doit plus s'annoncer comme couvrant l'Airbnb.
    expect(MACRO_DEF.find(m => m.id === 'residentiel')!.title).not.toMatch(/airbnb/i);
  });

  it('y range le ménage de location courte durée', () => {
    expect(macroOf('Nettoyage Hébergement')).toBe('airbnb');
    expect(macroOf('Ménage Airbnb')).toBe('airbnb');
    expect(macroOf('Ménage courte durée')).toBe('airbnb');
    expect(macroOf('Prestation conciergerie')).toBe('airbnb');
  });

  it('sépare le linge et les consommables du ménage lui-même', () => {
    expect(sectionOf('Gestion du linge')).toBe('Linge & consommables');
    expect(sectionOf('Kit consommables')).toBe('Linge & consommables');
    expect(sectionOf('Nettoyage Hébergement')).toBe('Ménage entre deux voyageurs');
  });
});

describe('Le résidentiel garde ce qui lui revient', () => {
  it('entretien, ponctuel et colocation restent en résidentiel', () => {
    expect(macroOf('Entretien classique T3')).toBe('residentiel');
    expect(macroOf('Grand ménage ponctuel')).toBe('residentiel');
    expect(macroOf('Ménage colocation')).toBe('residentiel');
  });

  it('une colocation n’est pas rangée dans Airbnb malgré la location', () => {
    expect(macroOf('Coliving 6 chambres')).toBe('residentiel');
  });

  it('l’état des lieux est un moment du logement, pas un chantier', () => {
    expect(macroOf('État des lieux de sortie')).toBe('residentiel');
    expect(sectionOf('État des lieux de sortie')).toBe('États des lieux');
  });

  it('mais un état des lieux de fin de chantier reste côté chantier', () => {
    expect(macroOf('État des lieux fin de chantier')).toBe('remise');
  });
});

describe('buildCatalog — ce que le visiteur voit', () => {
  it('produit deux cartes distinctes quand les deux existent', () => {
    const catalog = buildCatalog([t('Entretien classique T2'), t('Nettoyage Hébergement'), t('Gestion du linge')]);
    const ids = catalog.map(c => c.id);
    expect(ids).toContain('residentiel');
    expect(ids).toContain('airbnb');

    const airbnb = catalog.find(c => c.id === 'airbnb')!;
    expect(airbnb.sections.map(s => s.title)).toEqual(['Ménage entre deux voyageurs', 'Linge & consommables']);
  });

  it('n’affiche pas une carte vide', () => {
    const catalog = buildCatalog([t('Entretien classique T2')]);
    expect(catalog.map(c => c.id)).not.toContain('airbnb');
  });

  it('place le résidentiel puis l’Airbnb en tête, avant le professionnel', () => {
    const catalog = buildCatalog([t('Nettoyage bureaux'), t('Nettoyage Hébergement'), t('Entretien classique T2')]);
    expect(catalog.map(c => c.id)).toEqual(['residentiel', 'airbnb', 'pro']);
  });
});
