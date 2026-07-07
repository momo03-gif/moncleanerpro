// ════════════════════════════════════════════════════════════════════════════
//  Pages d'atterrissage SEO (service × Lyon). Contenu UNIQUE par page — pas de
//  pages « doublon » (Google pénalise le contenu mince/dupliqué). Chaque page
//  cible une requête précise, avec son propre H1, meta, intro, points et FAQ.
//  Consommé par src/app/[slug]/page.tsx (rendu statique).
// ════════════════════════════════════════════════════════════════════════════

export interface SeoPage {
  slug: string;
  keyword: string;          // requête cible principale
  eyebrow: string;          // petit libellé au-dessus du H1
  h1: string;
  title: string;            // balise <title>
  description: string;      // meta description
  intro: string;            // paragraphe d'introduction (unique)
  highlights: { title: string; text: string }[];
  includes: string[];       // « ce qui est inclus »
  faq: { q: string; a: string }[];
}

export const SEO_PAGES: SeoPage[] = [
  {
    slug: 'nettoyage-hotel-lyon',
    keyword: 'nettoyage hôtel Lyon',
    eyebrow: 'Hôtellerie',
    h1: 'Nettoyage d’hôtel à Lyon',
    title: 'Nettoyage d’hôtel à Lyon — MonCleanerPro | Chambres & parties communes',
    description: "Société de nettoyage hôtelier à Lyon : chambres, parties communes, remise en état entre séjours. Cadence soutenue, standing hôtelier, équipe formée. Devis gratuit sous 24h.",
    intro:
      "MonCleanerPro accompagne les hôtels, résidences hôtelières et hôtels de tourisme de Lyon et de la métropole dans l’entretien quotidien de leurs espaces. Nous tenons la cadence propre à l’hôtellerie — rotations rapides des chambres, exigence de finitions et régularité irréprochable — pour que vos clients trouvent toujours un établissement impeccable.",
    highlights: [
      { title: 'Cadence hôtelière tenue', text: "Rotation rapide des chambres entre deux clients, avec un standard constant même en forte occupation." },
      { title: 'Chambres & parties communes', text: "Salles de bains, literie, sols, accueil, couloirs et espaces communs : tout est couvert." },
      { title: 'Contrôle qualité', text: "Check-list systématique et suivi digital de chaque intervention, avec rapport à l’appui." },
    ],
    includes: [
      'Remise en état des chambres entre séjours',
      'Nettoyage et désinfection des salles de bains',
      'Entretien des parties communes et de l’accueil',
      'Gestion et changement du linge',
      'Interventions récurrentes planifiées',
    ],
    faq: [
      { q: 'Intervenez-vous tous les jours, week-ends compris ?', a: "Oui, nous adaptons la fréquence à votre taux d’occupation, y compris les week-ends et périodes de forte affluence." },
      { q: 'Pouvez-vous gérer le linge de l’hôtel ?', a: "Oui, le changement et la gestion du linge font partie de nos prestations hôtelières." },
    ],
  },
  {
    slug: 'menage-airbnb-lyon',
    keyword: 'ménage Airbnb Lyon',
    eyebrow: 'Conciergeries & Airbnb',
    h1: 'Ménage Airbnb à Lyon',
    title: 'Ménage Airbnb à Lyon — MonCleanerPro | Entre voyageurs & conciergeries',
    description: "Ménage Airbnb et locations courte durée à Lyon : remise en état entre voyageurs, gestion du linge, check-list de mise en place. Idéal conciergeries et propriétaires. Devis gratuit.",
    intro:
      "Pour les propriétaires de locations courte durée et les conciergeries de Lyon, MonCleanerPro assure le ménage entre voyageurs avec la régularité et la rigueur qu’exige une bonne note sur les plateformes. Draps changés, logement remis à neuf et check-list de mise en place : votre bien est prêt à accueillir, à chaque départ.",
    highlights: [
      { title: 'Entre deux voyageurs', text: "Remise en état complète après chaque départ, synchronisée avec vos arrivées." },
      { title: 'Linge & mise en place', text: "Changement des draps et serviettes, réassort et présentation soignée du logement." },
      { title: 'Pensé pour les conciergeries', text: "Volume, plannings serrés et multi-logements : notre organisation suit votre rythme." },
    ],
    includes: [
      'Ménage complet entre voyageurs',
      'Changement des draps et du linge de toilette',
      'Check-list de mise en place (accueil prêt)',
      'Signalement des dégâts ou consommables manquants',
      'Coordination avec vos arrivées / départs',
    ],
    faq: [
      { q: 'Gérez-vous plusieurs logements pour une conciergerie ?', a: "Oui, nous travaillons régulièrement avec des conciergeries sur plusieurs logements, avec plannings synchronisés." },
      { q: 'Fournissez-vous le linge ?', a: "Nous gérons le changement du linge ; la fourniture peut être organisée selon votre fonctionnement." },
    ],
  },
  {
    slug: 'nettoyage-ehpad-lyon',
    keyword: 'nettoyage EHPAD Lyon',
    eyebrow: 'EHPAD & résidences',
    h1: 'Nettoyage d’EHPAD et de résidences à Lyon',
    title: 'Nettoyage EHPAD à Lyon — MonCleanerPro | Hygiène & protocoles stricts',
    description: "Nettoyage d’EHPAD et de résidences à Lyon : protocoles d’hygiène stricts, régularité, discrétion auprès d’un public sensible. Équipe formée et encadrée. Devis gratuit sous 24h.",
    intro:
      "Les établissements accueillant des personnes âgées ou du public sensible demandent une rigueur particulière. MonCleanerPro intervient dans les EHPAD et résidences de Lyon avec des protocoles d’hygiène stricts, une grande régularité et la discrétion indispensable dans ces lieux de vie.",
    highlights: [
      { title: 'Protocoles d’hygiène stricts', text: "Des procédures adaptées aux environnements sensibles, appliquées avec méthode." },
      { title: 'Régularité & discrétion', text: "Des passages réguliers, réalisés dans le respect des résidents et du personnel." },
      { title: 'Équipe encadrée', text: "Intervenants formés, encadrés et suivis, pour une qualité constante dans la durée." },
    ],
    includes: [
      'Entretien des chambres et espaces de vie',
      'Désinfection des sanitaires et surfaces de contact',
      'Nettoyage des parties communes et circulations',
      'Fréquence adaptée à l’établissement',
      'Traçabilité et suivi des interventions',
    ],
    faq: [
      { q: 'Respectez-vous des protocoles d’hygiène spécifiques ?', a: "Oui, nous appliquons des protocoles stricts adaptés aux établissements accueillant du public sensible." },
      { q: 'Vos équipes sont-elles formées à ces environnements ?', a: "Nos intervenants sont formés et encadrés, avec un souci constant de discrétion et de régularité." },
    ],
  },
  {
    slug: 'nettoyage-fin-de-chantier-lyon',
    keyword: 'nettoyage fin de chantier Lyon',
    eyebrow: 'Fin de chantier',
    h1: 'Nettoyage de fin de chantier à Lyon',
    title: 'Nettoyage fin de chantier à Lyon — MonCleanerPro | Finitions avant livraison',
    description: "Nettoyage de fin de chantier à Lyon : élimination des poussières et résidus de travaux, finitions avant livraison ou mise en vente. Rendu impeccable dès la remise des clés. Devis gratuit.",
    intro:
      "Après des travaux, un bien a besoin d’un nettoyage en profondeur avant d’être livré, loué ou vendu. MonCleanerPro prend en charge le nettoyage de fin de chantier à Lyon : poussières fines, traces de peinture, résidus de construction et finitions — pour un logement ou un local impeccable dès la remise des clés.",
    highlights: [
      { title: 'Poussières & résidus', text: "Élimination des poussières fines de chantier, traces et salissures liées aux travaux." },
      { title: 'Finitions avant livraison', text: "Un rendu net et prêt à présenter pour une livraison, une mise en location ou une vente." },
      { title: 'Particuliers & pros', text: "Nous intervenons pour les particuliers comme pour les professionnels de l’immobilier et du bâtiment." },
    ],
    includes: [
      'Dépoussiérage complet (sols, surfaces, menuiseries)',
      'Nettoyage des vitres et encadrements',
      'Élimination des traces de peinture et résidus',
      'Nettoyage des sanitaires et cuisines',
      'Finitions avant remise des clés',
    ],
    faq: [
      { q: 'Intervenez-vous juste avant une livraison ou une visite ?', a: "Oui, nous calons l’intervention au plus près de la livraison, de la mise en vente ou de la première visite." },
      { q: 'Travaillez-vous avec les entreprises du bâtiment ?', a: "Oui, nous accompagnons régulièrement les professionnels de l’immobilier et de la construction." },
    ],
  },
  {
    slug: 'grand-menage-lyon',
    keyword: 'grand ménage Lyon',
    eyebrow: 'Particuliers',
    h1: 'Grand ménage à Lyon',
    title: 'Grand ménage à Lyon — MonCleanerPro | Nettoyage en profondeur',
    description: "Grand ménage et nettoyage en profondeur à Lyon pour les particuliers : remise à neuf, ponctuel ou avant/après un événement. Intervenants soignés, devis clair et gratuit sous 24h.",
    intro:
      "Besoin d’une remise à neuf complète de votre logement ? MonCleanerPro réalise le grand ménage à Lyon et dans la métropole : un nettoyage en profondeur, pièce par pièce, ponctuel ou avant/après un déménagement, une location ou un événement. Un intérieur qui respire le propre, sans que vous ayez à lever le petit doigt.",
    highlights: [
      { title: 'Nettoyage en profondeur', text: "On ne fait pas qu’effleurer : recoins, sanitaires, cuisine et surfaces sont traités à fond." },
      { title: 'Ponctuel ou avant/après', text: "Idéal pour un déménagement, une entrée dans les lieux ou après une réception." },
      { title: 'Intervenants soignés', text: "Des personnes formées, respectueuses de votre intérieur et de vos affaires." },
    ],
    includes: [
      'Nettoyage en profondeur de toutes les pièces',
      'Cuisine et électroménager (extérieur)',
      'Sanitaires et salles de bains détartrés',
      'Sols, plinthes et surfaces',
      'Vitres intérieures sur demande',
    ],
    faq: [
      { q: 'Le grand ménage est-il ponctuel ou régulier ?', a: "Les deux : nous réalisons des grands ménages ponctuels comme des prestations récurrentes selon vos besoins." },
      { q: 'Puis-je le programmer avant un état des lieux ?', a: "Oui, c’est un cas fréquent : nous intervenons avant un état des lieux, une remise de clés ou une vente." },
    ],
  },
];

export const SEO_SLUGS = SEO_PAGES.map(p => p.slug);
export const getSeoPage = (slug: string) => SEO_PAGES.find(p => p.slug === slug);
