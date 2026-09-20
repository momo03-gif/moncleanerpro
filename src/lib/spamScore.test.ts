import { describe, it, expect } from 'vitest';
import { evaluerSpam, telephoneFrancais } from './spamScore';

// Les vrais messages reçus sur /accueil en septembre 2026, raccourcis.
const SPAMS = [
  {
    clientName: 'Lina Lina Rose', clientEmail: 'babita23020@gmail.com', clientPhone: '+8801832843130',
    description: 'Besoin : "Bonjour! Je suis une professionnelle de la d\'avis. Je fournis des avis positifs Google pour booster votre visibilité. '.padEnd(340, 'x'),
    total: 0, lignes: 0,
  },
  {
    clientName: 'john', clientEmail: 'johnsellers294@gmail.com', clientPhone: '+8801730460843',
    description: 'Hello business owner! Are you looking for a reliable marketing agency for your business? We offer SEO and web development. '.padEnd(320, 'x'),
    total: 0, lignes: 0,
  },
];

// De vraies demandes, elles aussi reçues.
const VRAIS = [
  {
    clientName: 'Lina Martin', clientEmail: 'lina.martinpv@outlook.fr', clientPhone: '0695969152',
    clientAddress: 'Venissieux', description: 'T3 · 65 m² · 4 voyageurs · 1 salle de bain · zone Proche périphérie',
    total: 40, lignes: 1,
  },
  {
    clientName: 'Lucas ouillon', clientEmail: 'lcimmobilier.contact@gmail.com', clientPhone: '0667284784',
    clientAddress: 'Lyon 3', description: 'Bonjour, il y a entrée automatique pour le logement (via lien internet). Il y a en moyenne deux départs par semaine.',
    total: 83, lignes: 2,
  },
  // Le client maladroit : deux mots, pas d'adresse. Il doit passer.
  { clientName: 'M. Bernard', clientEmail: 'bernard@free.fr', clientPhone: '0612345678', description: 'ménage appartement', total: 0, lignes: 0 },
];

describe('evaluerSpam — écarter les robots sans perdre un client', () => {
  it('écarte les démarchages réellement reçus', () => {
    for (const s of SPAMS) expect(evaluerSpam(s).issue).toBe('spam');
  });

  it('laisse passer les vraies demandes', () => {
    for (const v of VRAIS) expect(evaluerSpam(v).issue).toBe('ok');
  });

  it('le champ piège ne pardonne pas', () => {
    const v = evaluerSpam({ ...VRAIS[0], honeypot: 'https://spam.example' });
    expect(v.issue).toBe('spam');
    expect(v.motifs).toContain('champ piège rempli');
  });

  it('un formulaire rempli en moins de 3 secondes est un robot', () => {
    expect(evaluerSpam({ ...VRAIS[0], dureeSaisieMs: 900 }).issue).toBe('spam');
    // Un humain rapide mais réel : on ne le bloque pas.
    expect(evaluerSpam({ ...VRAIS[0], dureeSaisieMs: 12000 }).issue).toBe('ok');
  });

  it('met en doute sans écarter quand un seul indice ressort', () => {
    // Un lien dans le message, mais tout le reste est normal : la demande passe,
    // simplement sans réveiller l'admin.
    const v = evaluerSpam({ ...VRAIS[1], description: 'Voici le logement : https://airbnb.fr/rooms/123' });
    expect(v.issue).toBe('doute');
  });

  it('donne toujours le motif, pour qu’un faux positif se diagnostique', () => {
    const v = evaluerSpam(SPAMS[0]);
    expect(v.motifs.length).toBeGreaterThan(0);
    expect(v.score).toBeGreaterThanOrEqual(60);
  });
});

describe('telephoneFrancais', () => {
  it('reconnaît les formes utilisées en France', () => {
    expect(telephoneFrancais('06 95 96 91 52')).toBe(true);
    expect(telephoneFrancais('+33695969152')).toBe(true);
    expect(telephoneFrancais('0033695969152')).toBe(true);
  });
  it('refuse le reste', () => {
    expect(telephoneFrancais('+8801832843130')).toBe(false);
    expect(telephoneFrancais('123')).toBe(false);
  });
});
