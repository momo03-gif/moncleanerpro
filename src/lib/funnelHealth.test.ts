import { describe, it, expect } from 'vitest';
import {
  decideFunnelAlerts, daysSince,
  SILENCE_THRESHOLD_DAYS, BROKEN_COOLDOWN_HOURS, SILENT_COOLDOWN_HOURS,
} from './funnelHealth';

const base = { canaryOk: true, daysSinceLastDevis: 0, recentAlerts: [] as { kind: 'funnel_broken' | 'funnel_silent'; hoursAgo: number }[] };

describe('decideFunnelAlerts — le canari', () => {
  it('tout va bien → aucune alerte', () => {
    expect(decideFunnelAlerts(base)).toEqual([]);
  });

  // Le cas réel du 28 août : la colonne client_phone manquait en base.
  it('écriture impossible → alerte, avec le détail technique', () => {
    const a = decideFunnelAlerts({
      ...base, canaryOk: false,
      canaryError: "column devis.client_phone does not exist",
    });
    expect(a).toHaveLength(1);
    expect(a[0].kind).toBe('funnel_broken');
    expect(a[0].message).toContain('client_phone');
  });

  it('une panne avérée ne déclenche pas EN PLUS l’alerte de silence', () => {
    const a = decideFunnelAlerts({ ...base, canaryOk: false, daysSinceLastDevis: 30 });
    expect(a.map(x => x.kind)).toEqual(['funnel_broken']);
  });

  it('réalerte le lendemain : une panne doit insister', () => {
    const a = decideFunnelAlerts({
      ...base, canaryOk: false,
      recentAlerts: [{ kind: 'funnel_broken', hoursAgo: BROKEN_COOLDOWN_HOURS + 1 }],
    });
    expect(a).toHaveLength(1);
  });

  it('ne se répète pas dans la même journée', () => {
    const a = decideFunnelAlerts({
      ...base, canaryOk: false,
      recentAlerts: [{ kind: 'funnel_broken', hoursAgo: 3 }],
    });
    expect(a).toEqual([]);
  });
});

describe('decideFunnelAlerts — le silence', () => {
  it('sous le seuil → rien, un creux de quelques jours est normal', () => {
    expect(decideFunnelAlerts({ ...base, daysSinceLastDevis: SILENCE_THRESHOLD_DAYS - 1 })).toEqual([]);
  });

  it('au seuil → alerte', () => {
    const a = decideFunnelAlerts({ ...base, daysSinceLastDevis: SILENCE_THRESHOLD_DAYS });
    expect(a.map(x => x.kind)).toEqual(['funnel_silent']);
    expect(a[0].message).toContain(String(SILENCE_THRESHOLD_DAYS));
  });

  it('le message dit que l’enregistrement, lui, fonctionne', () => {
    const a = decideFunnelAlerts({ ...base, daysSinceLastDevis: 12 });
    expect(a[0].message).toMatch(/fonctionne/);
  });

  it('ne se répète pas avant trois jours', () => {
    const a = decideFunnelAlerts({
      ...base, daysSinceLastDevis: 12,
      recentAlerts: [{ kind: 'funnel_silent', hoursAgo: SILENT_COOLDOWN_HOURS - 1 }],
    });
    expect(a).toEqual([]);
  });

  it('réalerte passé trois jours', () => {
    const a = decideFunnelAlerts({
      ...base, daysSinceLastDevis: 12,
      recentAlerts: [{ kind: 'funnel_silent', hoursAgo: SILENT_COOLDOWN_HOURS + 1 }],
    });
    expect(a).toHaveLength(1);
  });

  it('aucun devis en base → pas d’alerte de silence (rien à comparer)', () => {
    expect(decideFunnelAlerts({ ...base, daysSinceLastDevis: null })).toEqual([]);
  });

  it('seuil ajustable', () => {
    expect(decideFunnelAlerts({ ...base, daysSinceLastDevis: 3, silenceThresholdDays: 3 })).toHaveLength(1);
  });
});

describe('daysSince', () => {
  const now = Date.parse('2026-09-08T12:00:00Z');
  it('compte les jours pleins', () => {
    expect(daysSince('2026-09-01T12:00:00Z', now)).toBe(7);
  });
  it('le jour même vaut zéro', () => {
    expect(daysSince('2026-09-08T08:00:00Z', now)).toBe(0);
  });
  it('valeur absente ou illisible', () => {
    expect(daysSince(null, now)).toBeNull();
    expect(daysSince('pas une date', now)).toBeNull();
  });
  // Le vrai trou observé : dernier devis le 27 août, contrôle le 8 septembre.
  it('reproduit le trou de dix jours qui n’a alerté personne', () => {
    expect(daysSince('2026-08-27T10:44:05Z', now)).toBe(12);
  });
});
