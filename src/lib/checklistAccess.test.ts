import { describe, it, expect } from 'vitest';
import { canEditChecklist, canCheckChecklist } from './checklistAccess';

const admin = { id: 'u-admin', role: 'admin' };
const partenaire = { id: 'u-gaia', role: 'airbnb' };
const autre = { id: 'u-autre', role: 'airbnb' };
const cleaner = { id: 'u-cleaner', role: 'cleaner' };

describe('canEditChecklist — le standard d’un logement', () => {
  it('laisse le partenaire définir le standard de SES logements', () => {
    expect(canEditChecklist(partenaire, { partnerId: 'u-gaia' })).toBe(true);
  });

  it('refuse le standard du voisin', () => {
    // Le cas qui compte : les écritures passent par une route, l'appelant
    // pourrait prétendre n'importe quel logement.
    expect(canEditChecklist(partenaire, { partnerId: 'u-autre' })).toBe(false);
    expect(canEditChecklist(autre, { partnerId: 'u-gaia' })).toBe(false);
  });

  it('laisse l’admin passer partout', () => {
    expect(canEditChecklist(admin, { partnerId: 'u-gaia' })).toBe(true);
    expect(canEditChecklist(admin, { partnerId: null })).toBe(true);
  });

  it('refuse un logement géré en direct à un partenaire', () => {
    expect(canEditChecklist(partenaire, { partnerId: null })).toBe(false);
  });

  it('refuse sans session ou sans logement', () => {
    expect(canEditChecklist(null, { partnerId: 'u-gaia' })).toBe(false);
    expect(canEditChecklist(partenaire, null)).toBe(false);
  });

  it('ne coche pas : un cleaner ne modifie pas le standard', () => {
    expect(canEditChecklist(cleaner, { partnerId: 'u-gaia' })).toBe(false);
  });
});

describe('canCheckChecklist — cocher pendant le ménage', () => {
  it('autorise le cleaner assigné', () => {
    expect(canCheckChecklist(cleaner, { cleanerUserId: 'u-cleaner' })).toBe(true);
  });

  it('refuse un cleaner qui n’a pas la mission', () => {
    expect(canCheckChecklist(cleaner, { cleanerUserId: 'u-quelquun' })).toBe(false);
    expect(canCheckChecklist(cleaner, { cleanerUserId: null })).toBe(false);
  });

  it('refuse au partenaire de cocher à la place du cleaner', () => {
    // Sinon la checklist ne prouve plus que le travail a été fait.
    expect(canCheckChecklist(partenaire, { cleanerUserId: 'u-cleaner' })).toBe(false);
  });

  it('laisse l’admin rattraper un oubli', () => {
    expect(canCheckChecklist(admin, { cleanerUserId: 'u-cleaner' })).toBe(true);
    expect(canCheckChecklist(admin, { cleanerUserId: null })).toBe(true);
  });
});
