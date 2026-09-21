import { describe, it, expect } from 'vitest';
import { articlesContrat, contratEnTexte, totalParPassage, type DonneesContrat } from './contrat';

// Intl met une espace INSÉCABLE avant le symbole € : on la ramène à une espace
// normale pour que les tests disent ce qu'ils ont l'air de dire.
const txt = (s: string) => s.replace(/[  ]/g, ' ');

const BASE: DonneesContrat = {
  prestataire: {
    raisonSociale: 'MonCleanerPro', adresse: '6 rue Jean Sarrazin, 69008 Lyon',
    siret: '000 000 000 00000', representant: 'M. Conde',
  },
  client: {
    raisonSociale: 'Les Cocons Lyonnais', adresse: '9 rue Saint-Eusèbe, 69003 Lyon',
    siret: '111 111 111 11111',
  },
  logements: [
    { nom: 'Le Heritage 1', adresse: '9 rue Saint-Eusèbe, Lyon 3e', prix: 20, minutes: 45 },
    { nom: 'Le Cocon Savoir', adresse: '5 cours Gambetta, Lyon 3e', prix: 50, minutes: 90,
      fourniture: { libelle: 'Linge — 2 kits', montant: 9 } },
  ],
  dateEffet: '2026-10-01',
  fraisDeplacement: 20,
};

describe('Contrat de prestation — conditions particulières', () => {
  it('nomme les deux parties avec ce qui les engage', () => {
    const a = articlesContrat(BASE)[0];
    expect(a.paragraphes[0]).toContain('MonCleanerPro');
    expect(a.paragraphes[0]).toContain('SIRET');
    expect(a.paragraphes[1]).toContain('Les Cocons Lyonnais');
  });

  it('renvoie aux CGV plutôt que de les recopier', () => {
    // Un contrat qui répète les CGV finit par les contredire.
    const objet = articlesContrat(BASE).find(a => a.titre.startsWith('Article 2'))!;
    expect(objet.paragraphes.join(' ')).toContain('conditions générales de vente');
    expect(objet.paragraphes.join(' ')).toContain('les présentes conditions particulières prévalent');
  });

  it('liste chaque logement avec son prix, et le linge à part', () => {
    const p = txt(articlesContrat(BASE).find(a => a.titre.startsWith('Article 3'))!.paragraphes.join(' '));
    expect(p).toContain('Le Heritage 1');
    expect(p).toContain('20,00 €');
    expect(p).toContain('Linge — 2 kits');
    expect(p).toContain('ligne distincte');
    // Le prix affiché au client est un prix HT : il doit le lire noir sur blanc.
    expect(p).toContain('hors taxes');
  });

  it('annonce un périmètre vide sans laisser de blanc', () => {
    const p = articlesContrat({ ...BASE, logements: [] })
      .find(a => a.titre.startsWith('Article 3'))!.paragraphes.join('\n');
    expect(p).toContain('arrêté par avenant');
  });

  it('laisse annuler librement, mais protège le déplacement effectué', () => {
    const a = txt(articlesContrat(BASE).find(x => x.titre.startsWith('Article 5'))!.paragraphes.join(' '));
    expect(a).toContain('à tout moment et sans frais');
    expect(a).toContain('20,00 €');
    expect(a).toContain('la prestation elle-même n’étant pas due');
  });

  it('porte les mentions de retard obligatoires entre professionnels', () => {
    const a = articlesContrat(BASE).find(x => x.titre.startsWith('Article 6'))!.paragraphes.join(' ');
    expect(a).toContain('trente (30) jours');
    expect(a).toContain('trois fois le taux d’intérêt légal');
    expect(a).toContain('quarante (40) euros');
  });

  it('fait du silence une acceptation de la hausse annuelle', () => {
    // Sans cette règle, une hausse annoncée et jamais répondue laisse dans le flou.
    const a = articlesContrat(BASE).find(x => x.titre.startsWith('Article 7'))!.paragraphes.join(' ');
    expect(a).toContain('1er janvier');
    expect(a).toContain('30 novembre');
    expect(a).toContain('À défaut de refus écrit');
  });

  it('dit la durée et le préavis en toutes lettres', () => {
    const a = articlesContrat(BASE).find(x => x.titre.startsWith('Article 8'))!.paragraphes.join(' ');
    expect(a).toContain('1 octobre 2026');
    expect(a).toContain('durée indéterminée');
    expect(a).toContain('trente (30) jours');
  });

  it('additionne prestation et fourniture pour un passage complet', () => {
    expect(totalParPassage(BASE.logements)).toBe(79);
  });

  it('produit un document lisible de bout en bout', () => {
    const t = contratEnTexte(BASE);
    expect(t.startsWith('CONTRAT DE PRESTATION DE SERVICES')).toBe(true);
    expect(t).toContain('Article 9');
    expect(t).toContain('Le Client (lu et approuvé)');
  });
});
