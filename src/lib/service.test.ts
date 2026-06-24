import { describe, it, expect } from 'vitest';
import { serviceParts, canCleanerDoService, capabilitiesLabel } from './service';

describe('serviceParts — décompose une prestation', () => {
  it('ménage', () => expect(serviceParts('cleaning')).toEqual({ cleaning: true, delivery: false }));
  it('livraison', () => expect(serviceParts('delivery')).toEqual({ cleaning: false, delivery: true }));
  it('ménage + livraison', () => expect(serviceParts('cleaning_delivery')).toEqual({ cleaning: true, delivery: true }));
  it('non précisé = ménage par défaut', () => {
    expect(serviceParts(undefined)).toEqual({ cleaning: true, delivery: false });
    expect(serviceParts(null)).toEqual({ cleaning: true, delivery: false });
  });
});

describe('Règle métier : facturation client', () => {
  // La facturation client se base sur serviceParts(...).cleaning :
  // une livraison seule n'est JAMAIS facturée au client (à la charge de l'entreprise).
  const estFacturable = (s: Parameters<typeof serviceParts>[0]) => serviceParts(s).cleaning;
  it('un ménage est facturable au client', () => expect(estFacturable('cleaning')).toBe(true));
  it('une livraison seule N’EST PAS facturable au client', () => expect(estFacturable('delivery')).toBe(false));
  it('un legacy ménage+livraison garde sa part ménage facturable', () => expect(estFacturable('cleaning_delivery')).toBe(true));
});

describe('canCleanerDoService — éligibilité cleaner ↔ mission', () => {
  const nettoyeur = { can_clean: true, can_deliver: false };
  const livreur = { can_clean: false, can_deliver: true };
  const polyvalent = { can_clean: true, can_deliver: true };

  it('un nettoyeur peut faire le ménage, pas la livraison', () => {
    expect(canCleanerDoService(nettoyeur, 'cleaning')).toBe(true);
    expect(canCleanerDoService(nettoyeur, 'delivery')).toBe(false);
    expect(canCleanerDoService(nettoyeur, 'cleaning_delivery')).toBe(false);
  });
  it('un livreur peut livrer, pas nettoyer', () => {
    expect(canCleanerDoService(livreur, 'delivery')).toBe(true);
    expect(canCleanerDoService(livreur, 'cleaning')).toBe(false);
  });
  it('un polyvalent peut tout faire', () => {
    expect(canCleanerDoService(polyvalent, 'cleaning_delivery')).toBe(true);
  });
  it('capacités par défaut : ménage oui, livraison non', () => {
    expect(canCleanerDoService({}, 'cleaning')).toBe(true);
    expect(canCleanerDoService({}, 'delivery')).toBe(false);
  });
  it('aucun cleaner → false', () => {
    expect(canCleanerDoService(null, 'cleaning')).toBe(false);
    expect(canCleanerDoService(undefined, 'cleaning')).toBe(false);
  });
});

describe('capabilitiesLabel', () => {
  it('nettoyage + livraison', () => expect(capabilitiesLabel({ can_clean: true, can_deliver: true })).toBe('Nettoyage + livraison'));
  it('livraison seule', () => expect(capabilitiesLabel({ can_clean: false, can_deliver: true })).toBe('Livraison'));
  it('nettoyage par défaut', () => expect(capabilitiesLabel({})).toBe('Nettoyage'));
});
