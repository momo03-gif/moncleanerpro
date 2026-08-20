import { describe, it, expect } from 'vitest';
import {
  relanceUrgency, relanceLabel, filterAndSort, computeStats, isClosed, inDays,
  type Prospect,
} from './prospectsCompute';

const TODAY = '2026-08-20';

const p = (over: Partial<Prospect> & { id: string; nom: string }): Prospect => ({
  nature: 'autre', statut: 'attente', source: 'manuel', ...over,
});

describe('relanceUrgency — ce qui doit remonter en premier', () => {
  it('signale une relance dépassée', () => {
    expect(relanceUrgency({ statut: 'envoye', relance: '2026-08-18' }, TODAY)).toBe('overdue');
  });

  it('reconnaît le jour même', () => {
    expect(relanceUrgency({ statut: 'envoye', relance: TODAY }, TODAY)).toBe('today');
  });

  it('distingue « bientôt » (3 jours) de « plus tard »', () => {
    expect(relanceUrgency({ statut: 'attente', relance: '2026-08-23' }, TODAY)).toBe('soon');
    expect(relanceUrgency({ statut: 'attente', relance: '2026-08-24' }, TODAY)).toBe('upcoming');
  });

  it('ne relance pas une affaire close, même si une date traîne', () => {
    expect(relanceUrgency({ statut: 'accepte', relance: '2026-08-01' }, TODAY)).toBe('closed');
    expect(relanceUrgency({ statut: 'refuse', relance: '2026-08-01' }, TODAY)).toBe('closed');
  });

  it('distingue une relance non planifiée d’une relance dépassée', () => {
    expect(relanceUrgency({ statut: 'attente', relance: null }, TODAY)).toBe('none');
  });
});

describe('relanceLabel', () => {
  it('dit « Aujourd’hui » plutôt qu’une date', () => {
    expect(relanceLabel({ statut: 'envoye', relance: TODAY }, TODAY)).toBe("Aujourd'hui");
  });
  it('annonce clairement un retard', () => {
    expect(relanceLabel({ statut: 'envoye', relance: '2026-08-18' }, TODAY)).toMatch(/^En retard/);
  });
  it('reste discret sur une affaire close', () => {
    expect(relanceLabel({ statut: 'accepte', relance: '2026-08-18' }, TODAY)).toBe('—');
  });
  it('signale une relance jamais planifiée', () => {
    expect(relanceLabel({ statut: 'attente', relance: null }, TODAY)).toBe('Non planifiée');
  });
});

describe('filterAndSort — l’ordre fait tout l’intérêt de l’écran', () => {
  const list: Prospect[] = [
    p({ id: '1', nom: 'Zoé Martin', statut: 'attente', relance: '2026-08-28', createdAt: '2026-08-01' }),
    p({ id: '2', nom: 'Alain Bernard', statut: 'envoye', relance: '2026-08-18', createdAt: '2026-08-05' }),
    p({ id: '3', nom: 'Chloé Petit', statut: 'accepte', relance: null, createdAt: '2026-08-10' }),
    p({ id: '4', nom: 'Bruno Dubois', statut: 'envoye', relance: TODAY, createdAt: '2026-08-12' }),
    p({ id: '5', nom: 'Emma Roy', statut: 'attente', relance: null, createdAt: '2026-08-15' }),
  ];

  it('remonte les retards, puis le jour même, et rejette les affaires closes à la fin', () => {
    const out = filterAndSort(list, { statut: 'tous', search: '', sort: 'relance', today: TODAY });
    expect(out.map(x => x.id)).toEqual(['2', '4', '1', '5', '3']);
  });

  it('à urgence égale, la demande la plus ancienne passe devant', () => {
    const deux = [
      p({ id: 'recent', nom: 'B', statut: 'attente', relance: null, createdAt: '2026-08-15' }),
      p({ id: 'vieux', nom: 'A', statut: 'attente', relance: null, createdAt: '2026-07-01' }),
    ];
    const out = filterAndSort(deux, { statut: 'tous', search: '', sort: 'relance', today: TODAY });
    expect(out[0].id).toBe('vieux');
  });

  it('filtre par statut', () => {
    const out = filterAndSort(list, { statut: 'envoye', search: '', sort: 'relance', today: TODAY });
    expect(out.map(x => x.id)).toEqual(['2', '4']);
  });

  it('cherche dans le nom, l’entreprise, l’email et le téléphone', () => {
    const avec = [
      p({ id: 'a', nom: 'Sophie', entreprise: 'Hôtel Le Verdier' }),
      p({ id: 'b', nom: 'Marc', email: 'marc@conciergerie.fr' }),
      p({ id: 'c', nom: 'Léa', telephone: '06 12 34 56 78' }),
    ];
    const q = (s: string) => filterAndSort(avec, { statut: 'tous', search: s, sort: 'nom', today: TODAY }).map(x => x.id);
    expect(q('verdier')).toEqual(['a']);
    expect(q('CONCIERGERIE')).toEqual(['b']);
    expect(q('06 12')).toEqual(['c']);
  });

  it('trie par nom et par date de création', () => {
    const parNom = filterAndSort(list, { statut: 'tous', search: '', sort: 'nom', today: TODAY });
    expect(parNom[0].nom).toBe('Alain Bernard');
    const parDate = filterAndSort(list, { statut: 'tous', search: '', sort: 'recent', today: TODAY });
    expect(parDate[0].id).toBe('5');
  });
});

describe('computeStats', () => {
  const list: Prospect[] = [
    p({ id: '1', nom: 'A', statut: 'attente', relance: '2026-08-18', montant: 500 }),
    p({ id: '2', nom: 'B', statut: 'envoye', relance: TODAY, montant: 1000 }),
    p({ id: '3', nom: 'C', statut: 'accepte', montant: 300 }),
    p({ id: '4', nom: 'D', statut: 'refuse', montant: 2000 }),
    p({ id: '5', nom: 'E', statut: 'envoye', relance: '2026-09-30', montant: 250 }),
  ];

  it('compte par statut', () => {
    const s = computeStats(list, TODAY);
    expect(s.total).toBe(5);
    expect(s.counts).toEqual({ attente: 1, envoye: 2, accepte: 1, refuse: 1 });
  });

  it('calcule le taux d’acceptation sur les seules affaires tranchées', () => {
    expect(computeStats(list, TODAY).tauxAcceptation).toBe(50);
  });

  it('n’invente pas de taux quand rien n’est tranché', () => {
    expect(computeStats([p({ id: '1', nom: 'A', statut: 'attente' })], TODAY).tauxAcceptation).toBeNull();
  });

  it('compte les relances urgentes (en retard + aujourd’hui)', () => {
    expect(computeStats(list, TODAY).urgents).toBe(2);
  });

  it('ne compte dans le potentiel que les affaires encore ouvertes', () => {
    // 500 + 1000 + 250 ; ni l'accepté ni le refusé.
    expect(computeStats(list, TODAY).potentiel).toBe(1750);
  });
});

describe('utilitaires', () => {
  it('isClosed', () => {
    expect(isClosed('accepte')).toBe(true);
    expect(isClosed('refuse')).toBe(true);
    expect(isClosed('attente')).toBe(false);
  });

  it('inDays calcule une date de relance', () => {
    expect(inDays(3, new Date('2026-08-20T12:00:00'))).toBe('2026-08-23');
  });
});
