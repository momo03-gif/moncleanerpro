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
  count: 50,
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

// Identifiant unique de l'entreprise dans les données structurées. Toutes les
// pages y renvoient : Google et les assistants IA comprennent qu'il s'agit d'UNE
// entité, décrite à plusieurs endroits, et pas de quarante homonymes.
export const ENTITY_ID = 'https://moncleanerpro.fr/#entreprise';

// Profils officiels de l'entreprise ailleurs sur le web (`sameAs`). C'est par là
// qu'un assistant IA recoupe ce que le site dit de lui-même avec ce qu'en disent
// les autres. N'ajouter QUE des profils réels et actifs, au nom exact
// « MonCleanerPro » : Facebook, Instagram, LinkedIn, PagesJaunes, Bing Places…
export const PROFILES: string[] = [
  REVIEWS.url,
  'https://www.instagram.com/moncleanerpro_nettoyage_lyon/',
];

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

// ── Chiffres clés de la vitrine ───────────────────────────────────────────────
// Uniquement des faits vérifiables, tirés de la plateforme (11/11/2026 :
// 2 153 ménages terminés, 65 logements). Arrondis VERS LE BAS (« 2 000+ »)
// pour rester vrais longtemps sans mise à jour. `anime` : compteur animé à
// l'apparition — jamais pour une année, ça n'aurait aucun sens.
export const CHIFFRES: { valeur: string; libelle: string; anime?: boolean }[] = [
  { valeur: '2 000+', libelle: 'ménages réalisés' },
  { valeur: '60+', libelle: 'logements suivis', anime: true },
  { valeur: '5,0/5', libelle: `sur ${REVIEWS.count} avis Google` },
  { valeur: String(SINCE), libelle: 'année de création' },
];

// ── Avis clients affichés sur la vitrine ─────────────────────────────────────
// De VRAIS avis Google (fiche MonCleanerPro), extraits mot pour mot — seules
// quelques fautes de frappe évidentes sont corrigées. Nom abrégé (prénom +
// initiale) : l'avis est public, mais inutile d'exposer le nom complet.
// Le contexte (« Conciergerie Airbnb »…) est déduit du texte de l'avis.
// Ils remplacent des témoignages anonymes non vérifiables : présenter comme
// réels des avis qui ne le sont pas est une pratique commerciale trompeuse.
// Pour en changer : relire les avis via le bot (Desktop/mon-cleaner-bo).
export interface AvisClient { nom: string; date: string; contexte: string; texte: string }
export const AVIS_CHOISIS: AvisClient[] = [
  { nom: 'Benjamin L.', date: 'novembre 2026', contexte: 'Conciergerie Airbnb',
    texte: "Le ménage est bien fait et l'équipe est sérieuse. Leur application apporte un énorme plus car tu es au courant de tout. […] Ils sont très fiables et jamais de ménage raté, tout est fait à temps." },
  { nom: 'Meyo R.', date: 'novembre 2025', contexte: 'Hôte Airbnb',
    texte: "Les ménages sont toujours faits à l’heure, les draps parfaitement pliés et les consommables bien remis. Depuis que je travaille avec MONCLEANERPRO, mes notes Airbnb ont remonté." },
  { nom: 'Noam L.', date: 'mai 2026', contexte: 'État des lieux de sortie',
    texte: "Mon appartement était très sale, avec énormément de graisse et de saletés partout, et ils ont réussi à tout remettre parfaitement propre. Grâce à leur travail, j’ai pu récupérer ma caution." },
  { nom: 'Discophil E.', date: 'novembre 2026', contexte: 'Nettoyage de bureau',
    texte: "Depuis 1 an il me gère le nettoyage de mon bureau, jamais eu de problème. Travail sérieux et propre. Équipe ponctuelle, agréable et disponible." },
  { nom: 'Eve L.', date: 'juin 2026', contexte: 'Salle de réception, Vaulx-en-Velin',
    texte: "Plusieurs boissons avaient été renversées et le sol collait vraiment partout. […] Le lendemain, la salle était impeccable, propre et prête à être réutilisée." },
  { nom: 'Pauline M.', date: 'mai 2026', contexte: 'Ménage complet',
    texte: "Mon appartement était impeccable après leur passage, avec une vraie attention aux détails. Le personnel est également très agréable et à l’écoute des demandes." },
];
