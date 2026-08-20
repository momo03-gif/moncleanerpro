import { describe, it, expect } from 'vitest';
import {
  computeQuote, tierFor, bathroomFee, optionFee, initialState, zoneForCommune,
  type SimulatorConfig, type SimulatorState,
} from './devisSimulator';

const CONFIG: SimulatorConfig = {
  tiers: [
    { maxM2: 30, label: 'Studio', capText: '1–2 pers.', basePrice: 25, priceMax: 30 },
    { maxM2: 45, label: 'T2', capText: '2–4 pers.', basePrice: 30, priceMax: 35 },
    { maxM2: 90, label: 'T3', capText: '4–6 pers.', basePrice: 40, priceMax: 50 },
    { maxM2: 9999, label: 'Sur mesure', basePrice: null, priceMax: null },
  ],
  zones: [
    { id: 'z1', name: 'Lyon intramuros', fee: 0, communes: ['Lyon 1er', 'Lyon 7e'] },
    { id: 'z2', name: 'Proche périphérie', fee: 5, communes: ['Villeurbanne', 'Écully'] },
  ],
  options: [
    { key: 'linen', label: 'Linge fourni & lavé', fee: 0, perCapacity: true, tiers: [{ max: 2, fee: 12 }, { max: 4, fee: 20 }], defaultOn: true },
    { key: 'windows', label: 'Vitres accessibles', fee: 25, perCapacity: false, defaultOn: false },
  ],
  capacitySurcharge: [{ max: 2, fee: 0 }, { max: 4, fee: 5 }, { max: 6, fee: 10 }],
  bathroomSurcharge: [{ from: 2, fee: 10 }, { from: 3, fee: 20 }],
  urgency: [{ id: 'standard', label: 'Standard', fee: 0 }, { id: 'h24', label: 'Sous 24 h', fee: 15 }],
  minM2: 12,
  maxM2: 230,
};

const base: SimulatorState = { surface: 40, travelers: 2, bathrooms: 1, zoneId: 'z1', options: [], urgencyId: 'standard' };

describe('tierFor — le bon palier de surface', () => {
  it('prend le premier palier dont le plafond couvre la surface', () => {
    expect(tierFor(CONFIG.tiers, 25)?.label).toBe('Studio');
    expect(tierFor(CONFIG.tiers, 40)?.label).toBe('T2');
    expect(tierFor(CONFIG.tiers, 45)?.label).toBe('T2');
    expect(tierFor(CONFIG.tiers, 46)?.label).toBe('T3');
  });

  it('ne dépend pas de l’ordre de saisie des paliers', () => {
    const melange = [...CONFIG.tiers].reverse();
    expect(tierFor(melange, 40)?.label).toBe('T2');
  });
});

describe('bathroomFee — la première est comprise', () => {
  it('ne facture rien pour une seule salle de bain', () => {
    expect(bathroomFee(CONFIG.bathroomSurcharge, 1)).toBe(0);
  });

  it('applique le palier correspondant', () => {
    expect(bathroomFee(CONFIG.bathroomSurcharge, 2)).toBe(10);
    expect(bathroomFee(CONFIG.bathroomSurcharge, 3)).toBe(20);
  });

  it('prolonge le barème au-delà du dernier palier au lieu de plafonner', () => {
    // Derniers paliers : 2→10, 3→20, donc +10 par salle de bain supplémentaire.
    expect(bathroomFee(CONFIG.bathroomSurcharge, 5)).toBe(40);
  });

  it('ne facture rien si le barème est vide', () => {
    expect(bathroomFee([], 4)).toBe(0);
  });
});

describe('optionFee', () => {
  it('rend le forfait d’une option simple', () => {
    expect(optionFee(CONFIG.options[1], 8)).toBe(25);
  });

  it('indexe sur la capacité quand c’est prévu', () => {
    expect(optionFee(CONFIG.options[0], 2)).toBe(12);
    expect(optionFee(CONFIG.options[0], 4)).toBe(20);
  });

  it('REFUSE de deviner au-delà du barème de l’option', () => {
    expect(optionFee(CONFIG.options[0], 10)).toBeNull();
  });
});

describe('computeQuote — l’estimation ligne par ligne', () => {
  it('chiffre une configuration simple, en fourchette', () => {
    const q = computeQuote(CONFIG, base);
    expect(q.onRequest).toBe(false);
    expect(q.total).toBe(30);
    expect(q.totalMax).toBe(35);
    expect(q.lines).toEqual([{ label: 'Ménage T2', amount: 30, amountMax: 35 }]);
  });

  it('additionne capacité, salles de bain, zone, options et délai', () => {
    const q = computeQuote(CONFIG, {
      surface: 40, travelers: 4, bathrooms: 2, zoneId: 'z2',
      options: ['linen', 'windows'], urgencyId: 'h24',
    });
    // Les suppléments sont fermes : ils décalent les DEUX bornes de 80 €.
    // Bas : 30 + 80 = 110. Haut : 35 + 80 = 115.
    expect(q.total).toBe(110);
    expect(q.totalMax).toBe(115);
    expect(q.lines.map(l => l.label)).toEqual([
      'Ménage T2', 'Capacité 4 voyageurs', '2 salles de bain',
      'Zone — Proche périphérie', 'Linge fourni & lavé', 'Vitres accessibles', 'Délai — sous 24 h',
    ]);
  });

  it('n’affiche pas les lignes à zéro', () => {
    const q = computeQuote(CONFIG, { ...base, zoneId: 'z1', urgencyId: 'standard' });
    expect(q.lines.some(l => l.amount === 0)).toBe(false);
  });

  it('bascule en « sur devis » au-delà de la grille de surface', () => {
    const q = computeQuote(CONFIG, { ...base, surface: 500 });
    expect(q.onRequest).toBe(true);
    expect(q.total).toBe(0);
    expect(q.totalMax).toBe(0);
    expect(q.reason).toMatch(/surface/i);
  });

  it('bascule en « sur devis » au-delà du barème de capacité', () => {
    const q = computeQuote(CONFIG, { ...base, travelers: 12 });
    expect(q.onRequest).toBe(true);
    expect(q.reason).toMatch(/capacité/i);
  });

  it('bascule en « sur devis » plutôt que d’ignorer une option non chiffrable', () => {
    const q = computeQuote(CONFIG, { ...base, travelers: 6, options: ['linen'] });
    expect(q.onRequest).toBe(true);
    expect(q.reason).toMatch(/linge/i);
  });

  it('ignore une zone inconnue sans planter', () => {
    const q = computeQuote(CONFIG, { ...base, zoneId: 'inexistante' });
    expect(q.onRequest).toBe(false);
    expect(q.total).toBe(30);
  });

  it('rend un prix ferme quand le palier n’a pas de borne haute', () => {
    const ferme: SimulatorConfig = { ...CONFIG, tiers: [{ maxM2: 45, label: 'T2', basePrice: 62 }] };
    const q = computeQuote(ferme, base);
    expect(q.total).toBe(62);
    expect(q.totalMax).toBe(62);
    expect(q.lines[0].amountMax).toBeUndefined();
  });
});

describe('initialState', () => {
  it('coche les options prévues par défaut et prend la première zone', () => {
    const s = initialState(CONFIG);
    expect(s.options).toEqual(['linen']);
    expect(s.zoneId).toBe('z1');
    expect(s.urgencyId).toBe('standard');
  });

  it('reste dans les bornes de surface', () => {
    const s = initialState(CONFIG);
    expect(s.surface).toBeGreaterThanOrEqual(CONFIG.minM2);
    expect(s.surface).toBeLessThanOrEqual(CONFIG.maxM2);
  });
});

describe('zoneForCommune — trouver sa zone en tapant sa ville', () => {
  it('reconnaît une commune exacte', () => {
    expect(zoneForCommune(CONFIG.zones, 'Villeurbanne')?.id).toBe('z2');
  });

  it('ignore la casse et les accents', () => {
    expect(zoneForCommune(CONFIG.zones, 'ECULLY')?.id).toBe('z2');
    expect(zoneForCommune(CONFIG.zones, 'lyon 7e')?.id).toBe('z1');
  });

  it('ne renvoie rien pour une commune non couverte', () => {
    expect(zoneForCommune(CONFIG.zones, 'Marseille')).toBeUndefined();
    expect(zoneForCommune(CONFIG.zones, '')).toBeUndefined();
  });
});
