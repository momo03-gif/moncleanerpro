import { describe, it, expect } from 'vitest';
import { shouldRealign } from './missionDefaults';

// Le cas vécu : on branche le calendrier, les ménages se créent avec les
// valeurs par défaut (1 h, 0 €), PUIS on renseigne la fiche (1 h 30, 50 €).
// Sans réalignement, des dizaines de dates restaient fausses.
describe('shouldRealign — un ménage en attente suit la fiche, pas l’inverse', () => {
  const fiche = { minutes: 90, price: 50 };

  it('réaligne un ménage resté sur les valeurs par défaut', () => {
    expect(shouldRealign({ minutes: 60, snapshot: 60, price: 0 }, fiche)).toBe(true);
  });

  it('ne touche à rien quand tout correspond déjà', () => {
    expect(shouldRealign({ minutes: 90, snapshot: 90, price: 50 }, fiche)).toBe(false);
  });

  it('réaligne aussi quand seul le prix a changé', () => {
    expect(shouldRealign({ minutes: 90, snapshot: 90, price: 0 }, fiche)).toBe(true);
  });

  it('RESPECTE une durée ajustée à la main', () => {
    // 120 min alors que la fiche en disait 90 au moment de la création : un
    // humain est passé par là. On ne réécrit jamais sa décision.
    expect(shouldRealign({ minutes: 120, snapshot: 90, price: 50 }, fiche)).toBe(false);
    // Et on ne profite pas non plus du passage pour remettre le prix.
    expect(shouldRealign({ minutes: 120, snapshot: 90, price: 0 }, fiche)).toBe(false);
  });

  it('ne fait rien si la fiche ne dit rien', () => {
    expect(shouldRealign({ minutes: 60, snapshot: 60, price: 0 }, { minutes: null, price: null })).toBe(false);
  });

  it('accepte un ménage sans instantané (créé avant la colonne)', () => {
    expect(shouldRealign({ minutes: 60, snapshot: null, price: 0 }, fiche)).toBe(true);
  });
});
