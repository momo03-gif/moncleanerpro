// ════════════════════════════════════════════════════════════════════════════
//  Articles de blog (SEO longue traîne). Contenu UNIQUE et utile par article.
//  Consommé par src/app/blog/page.tsx (index) et src/app/blog/[slug]/page.tsx.
//  Le corps est une suite de blocs typés (titre, paragraphe, liste) pour un
//  rendu maîtrisé et sémantique.
// ════════════════════════════════════════════════════════════════════════════

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] };

export interface BlogPost {
  slug: string;
  title: string;          // titre affiché (H1)
  metaTitle: string;      // balise <title>
  description: string;    // meta description + extrait
  keyword: string;        // requête cible
  date: string;           // ISO (publication)
  readingMinutes: number;
  body: Block[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'checklist-menage-airbnb-entre-voyageurs',
    title: 'Checklist ménage Airbnb : la remise en état parfaite entre deux voyageurs',
    metaTitle: 'Checklist ménage Airbnb entre voyageurs (à imprimer) — MonCleanerPro',
    description: "La checklist complète du ménage Airbnb entre deux voyageurs : pièces, linge, consommables et finitions pour une note 5 étoiles à Lyon.",
    keyword: 'checklist ménage Airbnb',
    date: '2026-07-08',
    readingMinutes: 5,
    body: [
      { type: 'p', text: "Sur une location courte durée, la propreté est le premier critère noté par les voyageurs. Un ménage rapide mais rigoureux entre deux séjours protège votre note, réduit les litiges et fidélise les hôtes. Voici la checklist que nos équipes appliquent à Lyon, pièce par pièce." },
      { type: 'h2', text: 'Avant de commencer' },
      { type: 'ul', items: [
        "Aérer le logement dès l’arrivée",
        "Vérifier l’absence d’objets oubliés par le voyageur précédent",
        "Repérer et signaler tout dégât ou consommable manquant",
      ] },
      { type: 'h2', text: 'Chambre et literie' },
      { type: 'ul', items: [
        "Changer draps, housses de couette et taies (linge propre à chaque départ)",
        "Aérer le matelas et vérifier les protège-matelas",
        "Dépoussiérer les surfaces, têtes de lit et interrupteurs",
        "Aspirer et laver les sols",
      ] },
      { type: 'h2', text: 'Salle de bains' },
      { type: 'ul', items: [
        "Détartrer et désinfecter douche, lavabo et WC",
        "Remplacer serviettes et tapis par du linge propre",
        "Réapprovisionner savon, papier toilette et petits consommables",
        "Faire briller miroirs et robinetterie (les traces se voient tout de suite)",
      ] },
      { type: 'h2', text: 'Cuisine' },
      { type: 'ul', items: [
        "Vider et nettoyer le réfrigérateur, contrôler les dates",
        "Dégraisser plaques, hotte et plan de travail",
        "Vérifier vaisselle propre et complète",
        "Sortir les poubelles et remettre un sac propre",
      ] },
      { type: 'h2', text: 'Pièces de vie et finitions' },
      { type: 'ul', items: [
        "Dépoussiérer, aspirer et laver les sols",
        "Nettoyer les traces sur vitres et surfaces vitrées",
        "Remettre la décoration et les équipements en place (mise en scène d’accueil)",
        "Contrôle final : rien ne doit trahir le passage précédent",
      ] },
      { type: 'h2', text: 'Le détail qui fait la différence' },
      { type: 'p', text: "Une mise en place soignée (linge plié, lumière douce, logement qui sent le propre) transforme la première impression du voyageur. C’est souvent ce qui déclenche un avis 5 étoiles — et donc plus de réservations." },
      { type: 'p', text: "Vous gérez plusieurs logements en courte durée à Lyon ? MonCleanerPro assure le ménage entre voyageurs avec cette rigueur, à chaque départ. Demandez un devis gratuit sous 24h." },
    ],
  },
  {
    slug: 'etapes-nettoyage-fin-de-chantier',
    title: 'Nettoyage de fin de chantier : les étapes pour un logement impeccable',
    metaTitle: 'Nettoyage fin de chantier : les étapes clés — MonCleanerPro Lyon',
    description: "Les étapes d’un nettoyage de fin de chantier réussi : poussières, résidus, vitres et finitions avant livraison ou mise en vente d’un bien à Lyon.",
    keyword: 'étapes nettoyage fin de chantier',
    date: '2026-07-08',
    readingMinutes: 4,
    body: [
      { type: 'p', text: "Après des travaux, la poussière fine s’infiltre partout et les résidus de construction restent tenaces. Un nettoyage de fin de chantier bien mené rend le bien présentable et livrable. Voici la méthode que nous suivons, dans le bon ordre." },
      { type: 'h2', text: '1. Évacuation et gros débris' },
      { type: 'p', text: "On commence par retirer les déchets restants, protections, adhésifs et étiquettes. Cette étape évite de déplacer la saleté d’une pièce à l’autre ensuite." },
      { type: 'h2', text: '2. Dépoussiérage de haut en bas' },
      { type: 'p', text: "La règle d’or : toujours nettoyer du haut vers le bas. Plafonds, luminaires, étagères, menuiseries, plinthes… la poussière retombe, on finit donc par les sols." },
      { type: 'h2', text: '3. Traces de peinture et résidus' },
      { type: 'ul', items: [
        "Élimination des projections de peinture, plâtre et colle",
        "Nettoyage des interrupteurs, prises et poignées",
        "Détachage des surfaces sans les abîmer (produits adaptés aux matériaux)",
      ] },
      { type: 'h2', text: '4. Vitres et encadrements' },
      { type: 'p', text: "Vitres, baies et encadrements concentrent les traces de chantier. Un nettoyage sans traces met immédiatement le bien en valeur, surtout pour des visites ou photos." },
      { type: 'h2', text: '5. Sanitaires et cuisine' },
      { type: 'p', text: "Détartrage, désinfection et dégraissage complet : ce sont les pièces les plus scrutées lors d’une livraison ou d’un état des lieux." },
      { type: 'h2', text: '6. Sols et finitions' },
      { type: 'p', text: "Aspiration puis lavage adapté au revêtement, et contrôle final pièce par pièce. Le bien doit être prêt à être remis, loué ou vendu dès la remise des clés." },
      { type: 'p', text: "Besoin d’un nettoyage de fin de chantier à Lyon avant une livraison ? MonCleanerPro intervient pour les particuliers comme pour les professionnels de l’immobilier. Devis gratuit sous 24h." },
    ],
  },
  {
    slug: 'choisir-societe-nettoyage-lyon',
    title: 'Comment choisir une société de nettoyage professionnelle à Lyon',
    metaTitle: 'Choisir sa société de nettoyage à Lyon : 6 critères — MonCleanerPro',
    description: "Les 6 critères pour bien choisir une société de nettoyage à Lyon : fiabilité, contrôle qualité, réactivité, assurances et transparence des devis.",
    keyword: 'société de nettoyage Lyon',
    date: '2026-07-08',
    readingMinutes: 5,
    body: [
      { type: 'p', text: "Hôtel, EHPAD, conciergerie ou particulier : confier son nettoyage à un prestataire, c’est lui confier son image et sa tranquillité. Voici les critères qui distinguent une société de nettoyage sérieuse à Lyon." },
      { type: 'h2', text: '1. La fiabilité et la régularité' },
      { type: 'p', text: "Un bon prestataire est présent au rendez-vous, à chaque intervention, avec un résultat constant. Demandez comment sont gérés les remplacements en cas d’absence : la continuité de service ne doit jamais dépendre d’une seule personne." },
      { type: 'h2', text: '2. Un contrôle qualité réel' },
      { type: 'p', text: "Check-list systématique, contrôle des finitions, rapport d’intervention : la qualité doit être vérifiable, pas seulement promise. C’est ce qui garantit un standard identique dans le temps." },
      { type: 'h2', text: '3. La réactivité' },
      { type: 'p', text: "Un devis renvoyé sous 24h et une capacité à s’adapter aux cadences (hôtellerie, rotations Airbnb) sont de bons signaux. La lenteur au premier contact annonce souvent la lenteur ensuite." },
      { type: 'h2', text: '4. Des équipes formées et déclarées' },
      { type: 'p', text: "Assurez-vous que les intervenants sont formés, encadrés et déclarés. C’est un gage de qualité, mais aussi de sécurité juridique pour vous." },
      { type: 'h2', text: '5. La transparence du devis' },
      { type: 'p', text: "Un devis clair, détaillé et sans surprise vaut mieux qu’un prix d’appel flou. Méfiez-vous des tarifs anormalement bas : ils cachent souvent des prestations réduites." },
      { type: 'h2', text: '6. La connaissance du terrain local' },
      { type: 'p', text: "Un prestataire implanté sur Lyon et sa métropole connaît les contraintes locales et intervient plus vite. La proximité, c’est de la réactivité en plus." },
      { type: 'p', text: "MonCleanerPro coche ces six cases pour les professionnels et les particuliers de Lyon et du Rhône-Alpes. Demandez votre devis gratuit et transparent sous 24h." },
    ],
  },
];

export const BLOG_SLUGS = BLOG_POSTS.map(p => p.slug);
export const getBlogPost = (slug: string) => BLOG_POSTS.find(p => p.slug === slug);
