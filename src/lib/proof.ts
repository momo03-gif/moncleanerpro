// ════════════════════════════════════════════════════════════════════════════
//  Preuve sociale et réassurance de la vitrine — source unique.
//  Regroupé ici pour qu'un chiffre qui change (nombre d'avis, note) se mette à
//  jour partout en une seule édition, au lieu d'être recopié dans chaque page.
// ════════════════════════════════════════════════════════════════════════════

// ⚠️ PAS de balisage `aggregateRating` sur le site à partir de ces valeurs.
// Google interdit les avis « auto-promotionnels » : une entreprise ne peut pas
// baliser ses propres avis sur son propre site pour obtenir des étoiles dans les
// résultats (règle applicable à LocalBusiness / Organization, et l'agrégation
// d'avis provenant d'une autre plateforme est également exclue). Le risque est
// une action manuelle, pas un gain.
// Les étoiles visibles dans Google viennent de la FICHE Google Business, pas
// d'un balisage du site. Ici, les avis servent uniquement à convaincre le
// visiteur une fois qu'il est sur la page — ce qui est déjà beaucoup.
export const REVIEWS = {
  count: 36,
  // Note moyenne affichée. `null` tant qu'elle n'est pas confirmée : mieux vaut
  // n'afficher que le nombre d'avis qu'une note approximative.
  rating: 5 as number | null,
  // Lien affiché sur le site : ouvre la FICHE Google, où les avis se lisent.
  // Ne PAS mettre ici la variante `/review` : elle ouvre le formulaire de
  // rédaction d'un avis, ce qui n'a aucun sens pour un prospect qui veut
  // seulement vérifier la note avant de demander un devis.
  url: 'https://g.page/r/CSxSeubqgq0zEBM',
  // Variante « laisser un avis » — à utiliser dans les sollicitations envoyées
  // aux clients après une intervention (email, SMS), jamais sur la vitrine.
  askUrl: 'https://g.page/r/CSxSeubqgq0zEBM/review',
};

// Année de début d'activité, affichée en pied de page. L'ancienneté est un
// signal de confiance bien plus utile qu'un « © 2026 » qui ne dit rien —
// et qui, généré depuis la date du jour, donnait l'impression d'un site créé
// cette année.
export const SINCE = 2018;

export interface TrustItem { title: string; text: string }

// Réassurance : uniquement des faits vérifiables. Aucune promesse vague type
// « qualité premium » — c'est ce qui décrédibilise une page de prestataire.
export const TRUST: TrustItem[] = [
  { title: 'Devis gratuit sous 24h', text: "Une réponse écrite et détaillée, sans engagement de votre part." },
  { title: 'Entreprise assurée', text: "Responsabilité civile professionnelle et intervenants déclarés." },
  { title: 'Intervention garantie', text: "Un point ne convient pas ? Nous repassons sous 48h, sans frais." },
  { title: 'Un interlocuteur unique', text: "La même personne du devis au suivi, pas un standard différent à chaque appel." },
];

// Engagement de reprise — formulé de façon vérifiable et tenable. Le délai est
// volontairement à 48h (et non 24h) : un engagement que l'on tient vaut mieux
// qu'un engagement affiché plus court et raté une fois sur trois.
export const GUARANTEE = {
  title: 'Notre engagement',
  text:
    "Si un point de l’intervention ne vous convient pas, signalez-le dans les 48 heures : " +
    "nous repassons sur la zone concernée sans frais supplémentaires. Sans discussion et sans " +
    "condition cachée — c’est la contrepartie normale d’un travail que vous ne voyez pas être fait.",
};

// Provenance de la demande, posée dans le formulaire. Sert à savoir ce qui
// génère réellement des devis : sans cette question, l'analytics dit d'où vient
// le TRAFIC, jamais d'où viennent les CLIENTS.
export const SOURCES = [
  'Recherche Google',
  'Fiche Google Business',
  'Bouche-à-oreille / recommandation',
  'Réseaux sociaux',
  'Déjà client',
  'Autre',
];
