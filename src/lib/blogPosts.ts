// ════════════════════════════════════════════════════════════════════════════
//  Articles de blog (SEO longue traîne). Contenu UNIQUE et utile par article.
//  Consommé par src/app/blog/page.tsx (index) et src/app/blog/[slug]/page.tsx.
//  Le corps est une suite de blocs typés (titre, paragraphe, liste) pour un
//  rendu maîtrisé et sémantique.
// ════════════════════════════════════════════════════════════════════════════

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }
  // Encart de liens internes : l'ancre porte le mot-clé de la page cible, ce qui
  // vaut bien mieux qu'un « cliquez ici » pour le référencement de la page visée.
  | { type: 'links'; intro?: string; items: { label: string; href: string }[] };

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
      { type: 'links', intro: 'Pour aller plus loin :', items: [
        { label: 'Nettoyage de fin de chantier à Lyon', href: '/nettoyage-fin-de-chantier-lyon' },
        { label: 'Prix d’un nettoyage de fin de chantier', href: '/prix-nettoyage-fin-de-chantier-lyon' },
        { label: 'Nettoyage après travaux à Lyon', href: '/nettoyage-apres-travaux-lyon' },
      ] },
    ],
  },
  {
    slug: 'poussiere-de-chantier-eliminer',
    title: 'Poussière de chantier : pourquoi elle revient et comment l’éliminer vraiment',
    metaTitle: 'Poussière de chantier : pourquoi elle revient — MonCleanerPro Lyon',
    description: "La poussière de travaux réapparaît quelques jours après le ménage : voici d’où elle vient, les points qu’on oublie systématiquement et la méthode pour s’en débarrasser pour de bon.",
    keyword: 'poussière de chantier',
    date: '2026-07-29',
    readingMinutes: 6,
    body: [
      { type: 'p', text: "Vous avez passé un week-end à nettoyer après vos travaux. Trois jours plus tard, une pellicule grise recouvre à nouveau les meubles. Ce n’est ni une illusion ni un manque de rigueur : c’est le comportement normal de la poussière de chantier quand on la traite comme de la poussière ordinaire." },
      { type: 'h2', text: 'Pourquoi elle n’est pas une poussière comme les autres' },
      { type: 'p', text: "La poussière domestique est composée de fibres, de cheveux et de particules relativement lourdes qui retombent vite. La poussière de chantier, elle, mélange plâtre, ciment, enduit et bois poncé. Ses particules sont beaucoup plus fines et plus légères : elles restent en suspension dans l’air pendant des heures, parfois plus d’une journée." },
      { type: 'p', text: "Conséquence directe : chaque geste un peu brusque la remet en vol. Un coup de balai, un aspirateur sans filtration adaptée qui la rejette par la sortie d’air, un chiffon sec passé sur une étagère — et elle repart pour se redéposer ailleurs, souvent sur ce que vous venez de nettoyer." },
      { type: 'h2', text: 'Les six endroits que tout le monde oublie' },
      { type: 'p', text: "Si la poussière revient, c’est presque toujours qu’un réservoir en hauteur n’a pas été traité. Elle en redescend au moindre courant d’air, à chaque ouverture de porte ou de fenêtre." },
      { type: 'ul', items: [
        "Le dessus des portes et des encadrements — invisible depuis le sol, systématiquement chargé",
        "Les rails et les gorges de placards coulissants, où elle s’accumule en épaisseur",
        "Les grilles de ventilation et les bouches d’aération, qui la rediffusent activement",
        "Le dessus des luminaires, des étagères hautes et des tringles à rideaux",
        "Les gorges de moulures, les corniches et les plinthes à profil creux",
        "L’intérieur des placards et des meubles neufs, ouverts pendant le chantier",
      ] },
      { type: 'h2', text: 'La méthode qui fonctionne' },
      { type: 'p', text: "Le principe est simple : ne jamais faire voler la poussière, et toujours travailler de haut en bas. Voici l’ordre à respecter." },
      { type: 'ul', items: [
        "Aérer largement avant de commencer, pour évacuer ce qui est encore en suspension",
        "Ne jamais balayer à sec : on aspire, avec un aspirateur à filtration fine",
        "Commencer par les points hauts, puis descendre — plafonds, luminaires, dessus de portes, placards, menuiseries, plinthes",
        "Essuyer à l’humide, jamais au chiffon sec : le sec déplace la poussière au lieu de la capturer",
        "Rincer ou changer souvent le support, sinon on étale un voile gris sur les surfaces",
        "Traiter les sols en dernier, une fois toute la poussière retombée",
        "Attendre un jour, puis repasser rapidement sur les surfaces : ce second passage capte ce qui est redescendu",
      ] },
      { type: 'h2', text: 'Le second passage n’est pas facultatif' },
      { type: 'p', text: "C’est le point que les particuliers sautent presque toujours, et c’est précisément celui qui règle le problème. Même en travaillant proprement, une partie des particules les plus fines reste en l’air pendant votre intervention et se dépose ensuite. Un passage léger vingt-quatre à quarante-huit heures plus tard suffit à casser le cycle — sans lui, vous recommencerez chaque semaine pendant un mois." },
      { type: 'h2', text: 'Les erreurs qui aggravent la situation' },
      { type: 'ul', items: [
        "Passer l’aspirateur domestique sur du plâtre en quantité : il sature, puis rejette les fines par la sortie d’air",
        "Utiliser un produit trop mouillé sur un parquet ou une tomette, qui garde une auréole",
        "Frotter une projection de peinture sèche à sec, ce qui raye le support neuf",
        "Installer les meubles et le linge avant le nettoyage — ils captent tout et deviennent une source secondaire",
        "Nettoyer avant que le dernier artisan soit passé : la retouche de peinture relance tout",
      ] },
      { type: 'h2', text: 'Quand passer la main' },
      { type: 'p', text: "Une pièce ou deux se traitent en un week-end si vous suivez l’ordre ci-dessus. Un logement entier après une rénovation lourde, en revanche, représente facilement plusieurs jours de travail — avec du matériel que l’on n’a généralement pas chez soi, et un vrai risque d’abîmer des matériaux qui viennent d’être posés." },
      { type: 'p', text: "C’est là que faire appel à une entreprise devient rentable, surtout si une date vous contraint : état des lieux, livraison, emménagement ou mise en vente." },
      { type: 'links', intro: 'Nos prestations sur ce sujet :', items: [
        { label: 'Nettoyage après travaux à Lyon', href: '/nettoyage-apres-travaux-lyon' },
        { label: 'Nettoyage de fin de chantier à Lyon', href: '/nettoyage-fin-de-chantier-lyon' },
        { label: 'Prix d’un nettoyage de fin de chantier', href: '/prix-nettoyage-fin-de-chantier-lyon' },
      ] },
    ],
  },
  {
    slug: 'difference-fin-de-chantier-apres-travaux',
    title: 'Fin de chantier ou après travaux : quelle prestation demander ?',
    metaTitle: 'Fin de chantier ou après travaux : la différence — MonCleanerPro',
    description: "Nettoyage de fin de chantier et nettoyage après travaux désignent souvent la même chose — mais pas toujours le même contexte. Comment savoir quoi demander, et ce que ça change au devis.",
    keyword: 'différence fin de chantier après travaux',
    date: '2026-07-29',
    readingMinutes: 4,
    body: [
      { type: 'p', text: "C’est une question qui revient à chaque premier appel : « je ne sais pas si c’est du nettoyage de fin de chantier ou du nettoyage après travaux ». Bonne nouvelle — dans la grande majorité des cas, c’est le même travail. Mais les deux expressions renvoient à des contextes différents, et ça change des choses concrètes sur le devis." },
      { type: 'h2', text: 'La méthode est identique' },
      { type: 'p', text: "Dans les deux cas, on retire les protections et les résidus, on dépoussière de haut en bas, on élimine les projections de peinture et de colle, on fait les vitres, on détaille la cuisine et les sanitaires, puis on traite les sols. Aucune entreprise sérieuse ne vous proposera deux méthodes différentes." },
      { type: 'h2', text: 'Ce qui change, c’est le contexte' },
      { type: 'p', text: "On parle plutôt de nettoyage de fin de chantier quand il y a une entreprise du bâtiment, un maître d’ouvrage et une date de livraison contractuelle. Le nettoyage fait partie du processus de réception : il est là pour éviter des réserves." },
      { type: 'p', text: "On parle plutôt de nettoyage après travaux quand un particulier a fait rénover sa cuisine, sa salle de bains ou son logement. L’objectif n’est pas une réception, c’est de pouvoir réoccuper les lieux." },
      { type: 'h2', text: 'Les conséquences pratiques' },
      { type: 'ul', items: [
        "Le volume : un chantier professionnel porte souvent sur plusieurs lots, un chantier de particulier sur une ou deux pièces",
        "Le délai : sur du professionnel, la date est contrainte par la réception ; chez un particulier, elle est souvent plus souple",
        "L’interlocuteur : conducteur de travaux ou promoteur d’un côté, occupant du logement de l’autre",
        "Le niveau d’exigence : sur du neuf, on cible ce qui déclenche des réserves (étiquettes, voile de ciment, silicone)",
        "La facturation : professionnelle et parfois multi-lots d’un côté, prestation unique de l’autre",
      ] },
      { type: 'h2', text: 'Et les autres appellations ?' },
      { type: 'p', text: "Vous croiserez aussi « remise en état après travaux », « nettoyage après rénovation » ou « nettoyage de réception ». Ce sont des variantes des deux mêmes prestations. Un dernier cas se distingue vraiment : le nettoyage intermédiaire, réalisé en cours de chantier pour que les corps de métier suivants travaillent dans un environnement praticable. Celui-là ne remplace pas la remise en état finale." },
      { type: 'h2', text: 'Que demander, concrètement' },
      { type: 'p', text: "Ne vous arrêtez pas au vocabulaire : décrivez votre situation. Le type de bien, la surface, la nature des travaux, l’état dans lequel les artisans ont laissé les lieux et la date qui vous contraint. Ces cinq éléments suffisent à cadrer un devis juste, quelle que soit l’étiquette qu’on met dessus." },
      { type: 'links', intro: 'Selon votre situation :', items: [
        { label: 'Nettoyage de fin de chantier à Lyon (professionnels)', href: '/nettoyage-fin-de-chantier-lyon' },
        { label: 'Nettoyage après travaux à Lyon (particuliers)', href: '/nettoyage-apres-travaux-lyon' },
        { label: 'Comment est calculé le prix', href: '/prix-nettoyage-fin-de-chantier-lyon' },
      ] },
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
