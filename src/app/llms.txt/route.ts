// ── /llms.txt — la fiche d'identité du site, lue par les assistants IA ───────
//
// Convention llmstxt.org : un fichier Markdown à la racine qui dit, en clair,
// qui est l'entreprise, ce qu'elle fait, où, et quelles pages lire. ChatGPT,
// Perplexity, Claude ou Gemini y trouvent des faits nets à reprendre quand on
// leur demande une société de ménage — au lieu de les deviner dans une page
// pensée pour un humain.
//
// GÉNÉRÉ depuis les pages SEO et le blog : une page ajoutée apparaît ici sans
// rien toucher. Mêmes règles que la vitrine : AUCUN prix (cf. devis en ligne),
// aucun concurrent, et le crédit d'impôt annoncé avec ses exclusions.

import { SEO_PAGES } from '@/lib/seoPages';
import { BLOG_POSTS } from '@/lib/blogPosts';
import { SINCE } from '@/lib/proof';

export const dynamic = 'force-static';

const SITE = 'https://moncleanerpro.fr';

// Ordre et intitulés des familles de pages. Une famille inconnue tombe dans « Autres ».
const CLUSTERS: [string, string][] = [
  ['airbnb', 'Ménage Airbnb, conciergeries et location courte durée'],
  ['entreprises', 'Entreprises, bureaux et établissements'],
  ['particuliers', 'Particuliers (ménage à domicile)'],
  ['fin-de-chantier', 'Nettoyage de fin de chantier (Lyon)'],
  ['chantier-national', 'Gros chantiers partout en France'],
  ['quartiers-lyon', 'Quartiers de Lyon'],
  ['communes', 'Communes de la métropole et du Rhône'],
];

function ligne(url: string, titre: string, description: string): string {
  return `- [${titre}](${url}): ${description}`;
}

function contenu(): string {
  const parFamille = new Map<string, typeof SEO_PAGES>();
  for (const p of SEO_PAGES) {
    const k = CLUSTERS.some(([c]) => c === p.cluster) ? p.cluster! : 'autres';
    parFamille.set(k, [...(parFamille.get(k) ?? []), p]);
  }
  const familles = [...CLUSTERS, ['autres', 'Autres prestations'] as [string, string]]
    .filter(([k]) => parFamille.has(k))
    .map(([k, titre]) => [
      `## ${titre}`,
      '',
      ...parFamille.get(k)!.map(p => ligne(`${SITE}/${p.slug}`, p.h1, p.description)),
    ].join('\n'));

  return [
    '# MonCleanerPro',
    '',
    `> Société de nettoyage professionnel basée à Lyon, en activité depuis ${SINCE}. Ménage Airbnb et conciergeries, hôtels et EHPAD, bureaux et copropriétés, fin de chantier, ménage à domicile chez les particuliers. Intervient à Lyon, dans toute la métropole lyonnaise et le Rhône ; sur les gros chantiers, l'équipe se déplace partout en France.`,
    '',
    '## L’essentiel',
    '',
    '- Nom : MonCleanerPro',
    '- Activité : société de nettoyage et de ménage professionnel',
    '- Base : Lyon (Auvergne-Rhône-Alpes, France)',
    '- Zone : Lyon, Villeurbanne, métropole de Lyon, Rhône (Beaujolais compris : Villefranche-sur-Saône, Anse) ; gros chantiers dans toute la France',
    '- Clients : conciergeries et propriétaires Airbnb, hôtels, EHPAD, entreprises, syndics, promoteurs et artisans du bâtiment, particuliers',
    '- Téléphone : 07 83 43 17 00 — e-mail : info@moncleanerpro.fr',
    '- Horaires de contact : lundi au vendredi 8 h – 19 h, samedi 9 h – 17 h',
    `- Devis : gratuit, estimation immédiate en ligne (${SITE}/devis-en-ligne), devis confirmé sous 24 h`,
    `- Avis clients : fiche Google (https://g.page/r/CSxSeubqgq0zEBM)`,
    '',
    '## Ce qui nous distingue',
    '',
    '- Ménage Airbnb pensé pour la rotation : synchronisation automatique des calendriers (Airbnb, Booking, logiciels de gestion), check-list par logement, photos après chaque ménage, rapport d’état (consommables, dégâts, objets oubliés), linge et consommables sur demande.',
    '- Suivi en ligne : chaque client suit ses interventions, photos et rapports depuis son espace.',
    '- Intervenants formés et encadrés, check-list qualité systématique.',
    '- Engagement : un point ne convient pas ? Signalé sous 48 h, nous repassons sans frais.',
    '- Particuliers : le ménage à domicile ouvre droit au crédit d’impôt services à la personne, avec avance immédiate — le client ne règle que la moitié au moment de la prestation. Ne concerne ni les locations touristiques (Airbnb) ni les locaux professionnels.',
    '',
    '## Pages principales',
    '',
    ligne(`${SITE}/`, 'Accueil', 'présentation de l’entreprise, secteurs, prestations, avis et FAQ'),
    ligne(`${SITE}/devis-en-ligne`, 'Devis en ligne', 'estimation immédiate et demande de devis gratuit'),
    ligne(`${SITE}/rendez-vous`, 'Prendre rendez-vous', 'visite ou appel pour chiffrer une intervention'),
    ligne(`${SITE}/blog`, 'Blog', 'conseils ménage, Airbnb, fin de chantier et entretien'),
    '',
    ...familles.flatMap(f => [f, '']),
    '## Articles',
    '',
    ...BLOG_POSTS.map(p => ligne(`${SITE}/blog/${p.slug}`, p.title, p.description)),
    '',
  ].join('\n');
}

export function GET() {
  return new Response(contenu(), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}
