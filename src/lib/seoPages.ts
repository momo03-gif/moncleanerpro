// ════════════════════════════════════════════════════════════════════════════
//  Pages d'atterrissage SEO (service × Lyon). Contenu UNIQUE par page — pas de
//  pages « doublon » (Google pénalise le contenu mince/dupliqué). Chaque page
//  cible une requête précise, avec son propre H1, meta, intro, points et FAQ.
//  Consommé par src/app/[slug]/page.tsx (rendu statique).
// ════════════════════════════════════════════════════════════════════════════

// Bloc de contenu long. Sert aux pages qui doivent aller au-delà du gabarit court
// (mot-clé concurrentiel → Google attend de la profondeur, pas 250 mots).
export interface SeoSection {
  h2: string;
  paragraphs?: string[];
  list?: string[];
}

// RÈGLE PRODUIT : aucun tarif n'est affiché sur la vitrine ni sur les pages SEO.
// Le prix n'apparaît qu'à la fin du parcours d'estimation (/devis-en-ligne), une
// fois les prestations choisies. Les pages qui visent les requêtes « prix … »
// répondent donc à l'intention (ce qui fait varier le coût, comment est établi le
// devis) SANS jamais donner de chiffre — et renvoient vers l'estimation.
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

  // ── Optionnel : enrichissement des pages « pilier » ────────────────────────
  cluster?: string;            // regroupe les pages d'un même thème (maillage)
  sections?: SeoSection[];     // contenu long, unique à la page
  related?: string[];          // slugs SEO à mettre en avant (maillage curaté)
  relatedPosts?: string[];     // slugs d'articles de blog liés
  updatedAt?: string;          // ISO — dernière révision réelle du contenu
}

// Date de révision par défaut des pages SEO. Volontairement figée : un
// `lastModified: new Date()` dans le sitemap déclare toutes les pages modifiées
// à chaque déploiement, et Google finit par ignorer un signal de fraîcheur qui ment.
// À remonter quand le contenu est réellement retravaillé.
export const SEO_CONTENT_UPDATED = '2026-07-29';

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
  // ── PAGE PILIER du cluster « fin de chantier » ────────────────────────────
  {
    slug: 'nettoyage-fin-de-chantier-lyon',
    cluster: 'fin-de-chantier',
    keyword: 'nettoyage fin de chantier Lyon',
    eyebrow: 'Fin de chantier',
    h1: 'Nettoyage de fin de chantier à Lyon',
    title: 'Nettoyage fin de chantier à Lyon — MonCleanerPro | Remise en état après travaux',
    description: "Entreprise de nettoyage de fin de chantier à Lyon : poussières fines, traces de peinture, résidus de travaux, vitres et finitions avant livraison, état des lieux ou mise en vente. Équipe formée, devis gratuit sous 24h.",
    intro:
      "Un chantier qui se termine laisse toujours deux choses derrière lui : des résidus visibles, et une poussière fine qui s’est infiltrée partout — dans les rainures de parquet, sur les rails de placard, au-dessus des portes. Tant qu’elle n’est pas éliminée méthodiquement, elle continue de retomber pendant des semaines. MonCleanerPro réalise le nettoyage de fin de chantier à Lyon et dans la métropole pour les particuliers, les artisans, les promoteurs et les agences : un logement ou un local livrable, présentable et sain dès la remise des clés.",
    highlights: [
      { title: 'La poussière traitée à la source', text: "Dépoussiérage de haut en bas, points hauts et recoins compris — pas un simple passage d’aspirateur qui la remet en suspension." },
      { title: 'Traces, projections, adhésifs', text: "Peinture, plâtre, colle, silicone, étiquettes et films de protection retirés sans abîmer les supports neufs." },
      { title: 'Prêt à présenter', text: "Vitres sans traces, sanitaires et cuisine détaillés : le bien est photographiable et visitable en sortant." },
      { title: 'Cadré sur votre date', text: "Nous calons l’intervention au plus près de la livraison, de l’état des lieux ou de la première visite." },
      { title: 'Particuliers & professionnels', text: "Rénovation d’appartement comme livraison de programme neuf : même méthode, volumes différents." },
      { title: 'Équipe formée et assurée', text: "Intervenants encadrés, produits adaptés aux matériaux neufs, contrôle des finitions avant de rendre le bien." },
    ],
    includes: [
      'Retrait des protections, films, adhésifs et étiquettes',
      'Dépoussiérage de haut en bas (plafonds, luminaires, points hauts)',
      'Menuiseries, portes, plinthes, rails et rainures',
      'Élimination des projections de peinture, plâtre, colle et silicone',
      'Nettoyage des vitres, encadrements et rebords, sans traces',
      'Sanitaires détartrés et désinfectés, cuisine dégraissée',
      'Interrupteurs, prises, poignées et points de contact',
      'Aspiration puis lavage des sols selon le revêtement',
      'Contrôle final pièce par pièce avant remise des clés',
    ],
    sections: [
      {
        h2: 'Pourquoi le nettoyage de fin de chantier ne s’improvise pas',
        paragraphs: [
          "Beaucoup de maîtres d’ouvrage découvrent le problème le jour de la livraison : le bien a été « balayé » par l’entreprise de travaux, mais il n’est pas propre. La différence tient à la nature de la salissure. La poussière de chantier n’est pas de la poussière domestique : c’est un mélange abrasif de plâtre, de ciment et de bois, extrêmement fin et volatil. Un aspirateur classique la rejette en partie dans l’air, où elle retombe quelques heures plus tard sur les surfaces qu’on venait de nettoyer.",
          "S’ajoutent des salissures qui ne partent pas au chiffon : projections de peinture sèche, résidus de colle de carrelage, traces de silicone, voile de ciment sur les sols. Chacune demande un produit et un geste adaptés — et surtout adaptés à des matériaux neufs qu’on ne peut pas rayer ni ternir. C’est précisément là qu’un nettoyage improvisé coûte cher : une plaque de cuisson rayée ou un parquet terni au mauvais produit se répare rarement.",
        ],
      },
      {
        h2: 'Notre méthode : trois passages, dans le bon ordre',
        paragraphs: [
          "Nous ne faisons jamais un seul passage. L’ordre des opérations est ce qui garantit qu’on ne redéplace pas la saleté d’une pièce à l’autre — et c’est aussi ce qui distingue une remise en état professionnelle d’un grand ménage un peu poussé.",
        ],
        list: [
          "Premier passage — évacuation : gros résidus, protections, films, adhésifs et étiquettes sont retirés. Rien ne doit gêner l’accès aux surfaces.",
          "Deuxième passage — dépoussiérage descendant : plafonds, luminaires, points hauts, dessus de portes, menuiseries, rails, plinthes. On finit toujours par les sols, puisque la poussière retombe.",
          "Troisième passage — détail et finitions : traces de peinture et de colle, vitres et encadrements, sanitaires, cuisine, points de contact, puis lavage des sols et contrôle pièce par pièce.",
        ],
      },
      {
        h2: 'Quand programmer l’intervention',
        paragraphs: [
          "Le bon moment, c’est une fois tous les corps de métier sortis — y compris le dernier passage de retouche peinture, qui est souvent celui qu’on oublie. Intervenir avant, c’est nettoyer deux fois. Nous calons donc la date au plus près de l’échéance qui compte pour vous : livraison, état des lieux d’entrée, séance photo, première visite ou emménagement.",
          "Sur les chantiers de rénovation lourde, nous proposons aussi un nettoyage intermédiaire en cours de travaux, puis la remise en état finale. C’est utile quand le chantier s’étale et que les artisans doivent travailler dans un environnement praticable.",
        ],
      },
      {
        h2: 'Qui fait appel à nous à Lyon',
        list: [
          "Particuliers en fin de rénovation d’appartement ou de maison, avant emménagement",
          "Propriétaires bailleurs qui doivent livrer un bien avant un état des lieux d’entrée",
          "Agences immobilières et vendeurs qui veulent présenter un bien sous son meilleur jour",
          "Artisans et entreprises générales qui livrent un chantier clé en main",
          "Promoteurs et maîtres d’ouvrage sur des livraisons de programmes neufs",
          "Commerces et bureaux rouvrant après des travaux d’aménagement",
        ],
      },
      {
        h2: 'Fin de chantier ou nettoyage après travaux : le même besoin ?',
        paragraphs: [
          "Les deux expressions désignent souvent la même prestation, mais pas toujours le même contexte. On parle plutôt de nettoyage de fin de chantier sur un chantier professionnel, encadré par une entreprise du bâtiment, avec une livraison à date. On parle plutôt de nettoyage après travaux chez un particulier qui a fait rénover sa cuisine, sa salle de bains ou l’ensemble de son logement.",
          "La méthode reste la même ; ce qui change, c’est le volume, les délais et l’interlocuteur. Nous traitons les deux — et si vous hésitez sur la formulation, décrivez simplement votre situation dans l’estimation en ligne, nous saurons quoi proposer.",
        ],
      },
    ],
    faq: [
      { q: 'Combien de temps dure un nettoyage de fin de chantier ?', a: "Cela dépend de la surface et surtout de l’état après travaux. Un appartement de taille moyenne se traite généralement sur une journée ; une rénovation lourde ou un local professionnel peut demander plusieurs intervenants ou plusieurs jours. Nous vous donnons une durée estimée avec le devis." },
      { q: 'Intervenez-vous juste avant une livraison ou une visite ?', a: "Oui, c’est le cas le plus fréquent. Nous calons l’intervention au plus près de la livraison, de l’état des lieux, de la mise en vente ou de la première visite, pour que le bien soit à son meilleur au moment où il est vu." },
      { q: 'Faut-il que tous les artisans aient terminé ?', a: "Idéalement oui, y compris les retouches de peinture. Intervenir avant la fin réelle du chantier oblige à repasser. Si le planning l’impose, nous pouvons organiser un nettoyage intermédiaire puis la remise en état finale." },
      { q: 'Enlevez-vous les gravats et les déchets de chantier ?', a: "Nous retirons les résidus, protections, films et petits déchets liés aux finitions. L’évacuation de gravats en volume relève d’une benne et d’une entreprise spécialisée : dites-le nous en amont, nous cadrons ce qui est inclus." },
      { q: 'Vos produits sont-ils adaptés aux surfaces neuves ?', a: "Oui. Parquet, carrelage neuf, inox, vitrage, plans de travail et menuiseries n’appellent pas les mêmes produits ni les mêmes gestes. Nos intervenants sont formés à ne pas rayer, ternir ni marquer des matériaux qui viennent d’être posés." },
      { q: 'Travaillez-vous avec les entreprises du bâtiment ?', a: "Oui, nous accompagnons régulièrement artisans, entreprises générales, promoteurs et professionnels de l’immobilier, en prestation ponctuelle comme en partenariat régulier sur plusieurs chantiers." },
      { q: 'Comment obtenir un prix pour mon chantier ?', a: "Décrivez votre bien et vos besoins dans notre estimation en ligne : vous obtenez une estimation immédiate, puis un devis confirmé sous 24h. Le montant dépend surtout de la surface, de l’état après travaux et du délai souhaité." },
      { q: 'Intervenez-vous en dehors de Lyon ?', a: "Oui, nous couvrons toute la métropole lyonnaise et une large partie du Rhône-Alpes, notamment Villeurbanne, Vénissieux, Saint-Priest et Villefranche-sur-Saône." },
    ],
    related: [
      'nettoyage-apres-travaux-lyon',
      'prix-nettoyage-fin-de-chantier-lyon',
      'nettoyage-fin-de-chantier-villeurbanne',
      'nettoyage-fin-de-chantier-venissieux',
      'nettoyage-fin-de-chantier-saint-priest',
      'nettoyage-fin-de-chantier-villefranche-sur-saone',
    ],
    relatedPosts: [
      'etapes-nettoyage-fin-de-chantier',
      'poussiere-de-chantier-eliminer',
      'difference-fin-de-chantier-apres-travaux',
    ],
  },
  {
    slug: 'nettoyage-apres-travaux-lyon',
    cluster: 'fin-de-chantier',
    keyword: 'nettoyage après travaux Lyon',
    eyebrow: 'Après travaux',
    h1: 'Nettoyage après travaux à Lyon',
    title: 'Nettoyage après travaux à Lyon — MonCleanerPro | Logement habitable après rénovation',
    description: "Nettoyage après travaux à Lyon pour les particuliers : poussière de rénovation, traces de peinture, vitres et finitions après une cuisine, une salle de bains ou un logement entier. Devis gratuit sous 24h.",
    intro:
      "Vos travaux sont finis, l’artisan est parti — et le logement est inhabitable. C’est la situation la plus fréquente après une rénovation : le gros œuvre est terminé, mais la poussière recouvre chaque surface et les finitions portent encore les traces du chantier. MonCleanerPro réalise le nettoyage après travaux à Lyon pour les particuliers, afin que vous puissiez emménager, réemménager ou simplement réoccuper vos pièces sans y passer vos week-ends.",
    highlights: [
      { title: 'Pensé pour les particuliers', text: "Rénovation d’une pièce ou d’un logement entier : une intervention à taille humaine, chez vous, sans jargon de chantier." },
      { title: 'La poussière qui revient', text: "On traite les points hauts et les recoins où elle se loge, pour qu’elle cesse de retomber les jours suivants." },
      { title: 'Vous récupérez vos pièces', text: "Cuisine utilisable, salle de bains saine, sols lavés : le logement redevient habitable immédiatement." },
      { title: 'Sans risque pour le neuf', text: "Produits et gestes adaptés au carrelage, au parquet et aux plans de travail fraîchement posés." },
    ],
    includes: [
      'Dépoussiérage complet des pièces rénovées',
      'Nettoyage des menuiseries, portes, plinthes et radiateurs',
      'Élimination des projections de peinture et de colle',
      'Vitres, encadrements et rebords de fenêtres',
      'Cuisine dégraissée, électroménager nettoyé à l’extérieur',
      'Salle de bains et WC détartrés et désinfectés',
      'Aspiration et lavage des sols adaptés au revêtement',
      'Évacuation des petits résidus et emballages restants',
    ],
    sections: [
      {
        h2: 'Après une rénovation, le ménage habituel ne suffit pas',
        paragraphs: [
          "C’est la mauvaise surprise classique : on passe un week-end entier à nettoyer, et le lendemain tout est de nouveau gris. La raison est simple — la poussière de travaux est bien plus fine que la poussière domestique. Elle s’est déposée sur les dessus de portes, les rails de placard, les grilles de ventilation et les tringles à rideaux, d’où elle redescend au moindre courant d’air. Tant que ces points hauts ne sont pas traités, le cycle recommence.",
          "S’y ajoute tout ce qu’un chiffon ne retire pas : gouttes de peinture séchée sur un interrupteur, résidu de colle sur un plan de travail, voile blanchâtre de ciment sur un carrelage neuf. Ce sont ces détails qui font qu’un logement « nettoyé » ne donne toujours pas l’impression d’être fini.",
        ],
      },
      {
        h2: 'Les rénovations que nous traitons le plus souvent',
        list: [
          "Cuisine refaite : dégraissage, retrait des protections, nettoyage des façades et du plan de travail",
          "Salle de bains ou WC rénovés : voile de ciment, silicone, détartrage et désinfection complète",
          "Peinture et sols dans tout le logement : traces, projections et poussière de ponçage",
          "Ouverture de mur ou création d’espace : poussière de plâtre diffusée dans toutes les pièces",
          "Changement de fenêtres : étiquettes, films de protection, encadrements et rebords",
          "Rénovation complète avant emménagement ou mise en location",
        ],
      },
      {
        h2: 'Quand nous appeler',
        paragraphs: [
          "Attendez que le dernier artisan soit passé, retouches de peinture comprises. C’est le point que les particuliers sous-estiment le plus : une ultime reprise après notre passage, et il faut recommencer sur la zone concernée. Si vos travaux s’étalent, dites-le nous — nous pouvons intervenir en deux fois plutôt que de nettoyer pour rien.",
          "Si vous devez rendre un logement à un propriétaire ou le livrer à un locataire, prévenez-nous de la date d’état des lieux. Nous calons l’intervention juste avant, pour que le bien soit vu dans son meilleur état.",
        ],
      },
      {
        h2: 'Vous êtes un professionnel du bâtiment ?',
        paragraphs: [
          "Si vous livrez des chantiers pour le compte de clients, c’est plutôt notre prestation de fin de chantier qui correspond : mêmes gestes, mais organisée pour des volumes, des délais de livraison et une facturation professionnelle. Nous travaillons régulièrement avec des artisans et des entreprises générales sur la métropole lyonnaise.",
        ],
      },
    ],
    faq: [
      { q: 'Quelle différence avec un nettoyage de fin de chantier ?', a: "C’est la même méthode. On parle de « nettoyage après travaux » chez un particulier qui a fait rénover son logement, et de « fin de chantier » sur un chantier professionnel avec une livraison à date. Le volume, les délais et l’interlocuteur changent, pas le savoir-faire." },
      { q: 'Dois-je être présent pendant l’intervention ?', a: "Ce n’est pas obligatoire. Beaucoup de clients nous confient les clés ou organisent un accès avec l’artisan. Nous vous faisons un point à la fin, avec un rapport d’intervention." },
      { q: 'Puis-je emménager juste après ?', a: "Oui, c’est même l’objectif : le logement est rendu propre, sain et prêt à être occupé. Nous vous conseillons simplement de faire livrer les meubles après notre passage, pas avant." },
      { q: 'Nettoyez-vous aussi les placards et l’intérieur des meubles neufs ?', a: "Oui, l’intérieur des rangements et des meubles posés pendant les travaux est dépoussiéré : c’est un endroit où la poussière de chantier s’accumule sans qu’on y pense." },
      { q: 'Et si la poussière revient après votre passage ?', a: "Elle ne devrait pas, parce que nous traitons les points hauts et les recoins d’où elle retombe. Si une reprise de travaux a lieu après nous, en revanche, une nouvelle intervention sera nécessaire sur la zone concernée." },
      { q: 'Combien ça coûte ?', a: "Cela dépend de la surface, de l’ampleur des travaux et de l’état constaté. Décrivez votre situation dans notre estimation en ligne : vous obtenez une estimation immédiate, puis un devis confirmé sous 24h, sans engagement." },
    ],
    related: [
      'nettoyage-fin-de-chantier-lyon',
      'prix-nettoyage-fin-de-chantier-lyon',
      'grand-menage-lyon',
      'nettoyage-vitres-lyon',
    ],
    relatedPosts: ['poussiere-de-chantier-eliminer', 'difference-fin-de-chantier-apres-travaux', 'etapes-nettoyage-fin-de-chantier'],
  },
  {
    slug: 'prix-nettoyage-fin-de-chantier-lyon',
    cluster: 'fin-de-chantier',
    keyword: 'prix nettoyage fin de chantier',
    eyebrow: 'Prix & devis',
    h1: 'Prix d’un nettoyage de fin de chantier à Lyon',
    title: 'Prix nettoyage fin de chantier à Lyon — MonCleanerPro | Ce qui fait varier le devis',
    description: "Comment est calculé le prix d’un nettoyage de fin de chantier à Lyon : surface, état après travaux, délai, accessibilité, vitrage. Estimation immédiate en ligne et devis confirmé sous 24h.",
    intro:
      "« Combien coûte un nettoyage de fin de chantier ? » est la première question qu’on nous pose — et la seule à laquelle personne ne peut répondre honnêtement sans savoir de quel chantier il s’agit. Deux appartements de même surface peuvent demander du simple au double de travail selon l’ampleur des travaux et l’état dans lequel les entreprises ont laissé les lieux. Plutôt qu’un tarif affiché qui ne correspondrait à personne, voici précisément ce qui fait varier le devis — et comment obtenir votre chiffre en quelques minutes.",
    highlights: [
      { title: 'Estimation immédiate', text: "Décrivez votre bien et vos besoins en ligne : vous obtenez une fourchette tout de suite, sans attendre un rappel." },
      { title: 'Devis confirmé sous 24h', text: "Un devis écrit, détaillé et sans engagement, ajusté après vérification de votre situation réelle." },
      { title: 'Pas de surprise', text: "Ce qui est inclus et ce qui ne l’est pas est écrit noir sur blanc avant l’intervention." },
      { title: 'Chaque chantier est différent', text: "Nous ne pratiquons pas de tarif unique au m² : il pénaliserait les chantiers propres et sous-estimerait les autres." },
    ],
    includes: [
      'Une estimation immédiate à partir de votre description',
      'Un devis écrit confirmé sous 24h, sans engagement',
      'Le détail de ce qui est inclus dans la prestation',
      'La durée estimée et le nombre d’intervenants prévus',
      'Un interlocuteur pour ajuster le périmètre si besoin',
    ],
    sections: [
      {
        h2: 'Les six critères qui déterminent le prix',
        paragraphs: [
          "Un devis de fin de chantier sérieux repose sur une estimation du temps de travail réel, pas sur un simple calcul de surface. Voici ce que nous regardons.",
        ],
        list: [
          "La surface et le nombre de pièces — la base du calcul, mais jamais le seul critère.",
          "L’ampleur des travaux — un rafraîchissement de peinture n’a rien à voir avec une rénovation lourde avec démolition, où la poussière de plâtre a envahi le volume entier.",
          "L’état laissé par les entreprises — certains chantiers sont rendus balayés et rangés, d’autres avec protections, gravats et projections partout. C’est le facteur qui fait le plus varier le temps passé.",
          "La surface vitrée — baies, verrières et grandes fenêtres demandent un traitement spécifique, sans traces, qui pèse vite dans la durée.",
          "Le délai souhaité — une intervention à caler en urgence avant une livraison mobilise plus d’intervenants sur une journée.",
          "L’accessibilité — étage sans ascenseur, absence d’eau ou d’électricité sur place, stationnement difficile : autant de contraintes qui allongent le chantier.",
        ],
      },
      {
        h2: 'Pourquoi nous n’affichons pas de grille tarifaire',
        paragraphs: [
          "Un prix au m² affiché en ligne est rassurant, mais il est presque toujours faux. Soit il est calé sur le pire des cas, et vous payez pour un état de chantier qui n’est pas le vôtre. Soit il est calé sur le meilleur, et il sert de prix d’appel avant une révision à la hausse une fois l’intervenant sur place. Les deux nous paraissent malhonnêtes.",
          "Nous préférons une estimation construite sur votre situation réelle. Vous décrivez votre bien et vos besoins dans notre outil d’estimation, vous obtenez une fourchette immédiate, et nous confirmons par un devis écrit sous 24h. C’est plus rapide qu’un rappel commercial, et le chiffre correspond à votre chantier.",
        ],
      },
      {
        h2: 'Ce qui peut faire baisser la note',
        list: [
          "Faire évacuer les gravats et encombrants par l’entreprise de travaux avant notre passage",
          "Attendre que tous les corps de métier soient réellement sortis, retouches comprises",
          "Nous prévenir tôt : une date planifiée coûte moins cher qu’une intervention en urgence",
          "Regrouper plusieurs biens ou plusieurs lots sur une même intervention",
          "Cadrer précisément le périmètre : toutes les pièces n’ont pas toujours besoin du même niveau de traitement",
        ],
      },
      {
        h2: 'Comment obtenir votre chiffre',
        paragraphs: [
          "Notre estimation en ligne vous guide par catégories : vous cochez les prestations qui correspondent à votre chantier, vous précisez les surfaces, et l’estimation s’affiche une fois votre sélection terminée. Rien à installer, aucune obligation, et vous gardez la main pour ajuster.",
          "Si votre chantier sort de l’ordinaire — grande surface, local professionnel, programme neuf à livrer en plusieurs lots — appelez-nous directement. Ces cas se cadrent mieux en deux minutes de conversation qu’avec un formulaire.",
        ],
      },
    ],
    faq: [
      { q: 'Le nettoyage de fin de chantier se facture-t-il au m² ?', a: "C’est une base de calcul courante, mais elle est insuffisante seule. Deux logements de même surface peuvent demander un temps de travail très différent selon l’ampleur des travaux et l’état laissé par les entreprises. Notre devis part du temps réel estimé." },
      { q: 'Le devis est-il gratuit et sans engagement ?', a: "Oui. L’estimation en ligne est immédiate et gratuite, et le devis confirmé sous 24h ne vous engage à rien." },
      { q: 'Le prix annoncé peut-il changer après l’état des lieux ?', a: "Le devis est établi à partir de ce que vous décrivez. Si la réalité diffère nettement — surface plus grande, chantier bien plus encrassé que décrit — nous vous le signalons avant de commencer, jamais après. Aucune facturation surprise." },
      { q: 'L’évacuation des gravats est-elle comprise ?', a: "Nous retirons les résidus de finition et les petits déchets. L’évacuation de gravats en volume nécessite une benne et relève d’un prestataire spécialisé : ce point est cadré explicitement dans le devis." },
      { q: 'Facturez-vous plus cher en urgence ?', a: "Une intervention à caler dans un délai très court mobilise davantage d’intervenants sur une même journée, ce qui se répercute sur le devis. Anticiper de quelques jours suffit généralement à l’éviter." },
      { q: 'Proposez-vous des conditions pour les professionnels ?', a: "Oui. Artisans, entreprises générales, promoteurs et agences qui nous confient des chantiers réguliers bénéficient de conditions adaptées et d’un interlocuteur dédié. Contactez-nous pour en parler." },
    ],
    related: [
      'nettoyage-fin-de-chantier-lyon',
      'nettoyage-apres-travaux-lyon',
      'nettoyage-fin-de-chantier-villeurbanne',
    ],
    relatedPosts: ['etapes-nettoyage-fin-de-chantier', 'difference-fin-de-chantier-apres-travaux'],
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
  {
    slug: 'nettoyage-bureaux-lyon',
    keyword: 'nettoyage bureaux Lyon',
    eyebrow: 'Entreprises & bureaux',
    h1: 'Nettoyage de bureaux à Lyon',
    title: 'Nettoyage de bureaux à Lyon — MonCleanerPro | Entretien pro régulier',
    description: "Nettoyage de bureaux et locaux professionnels à Lyon : entretien régulier, postes de travail, sanitaires, espaces communs. Interventions hors présence, discrètes et fiables. Devis gratuit sous 24h.",
    intro:
      "Un bureau propre, c’est une image soignée pour vos clients et un cadre sain pour vos équipes. MonCleanerPro assure l’entretien des bureaux et locaux professionnels de Lyon et de la métropole : passages réguliers, tôt le matin ou en soirée pour ne pas gêner votre activité, avec la fiabilité et la discrétion qu’attend une entreprise.",
    highlights: [
      { title: 'Hors de vos horaires', text: "Interventions tôt le matin ou en soirée, sans perturber vos équipes ni vos rendez-vous." },
      { title: 'Contrat régulier', text: "Fréquence sur mesure (quotidienne, plusieurs fois par semaine) avec un interlocuteur dédié." },
      { title: 'Postes & espaces communs', text: "Bureaux, salles de réunion, sanitaires, cuisine et accueil : un standard constant partout." },
    ],
    includes: [
      'Entretien des postes de travail et surfaces',
      'Désinfection des sanitaires et points de contact',
      'Nettoyage des salles de réunion et de l’accueil',
      'Sols, vitres intérieures et espaces communs',
      'Gestion des corbeilles et réassort consommables',
    ],
    faq: [
      { q: 'Intervenez-vous en dehors des heures de bureau ?', a: "Oui, la plupart de nos prestations en entreprise se font tôt le matin ou en soirée, hors présence des équipes." },
      { q: 'Proposez-vous un contrat régulier ?', a: "Oui, nous mettons en place un planning régulier adapté à vos locaux, avec un interlocuteur dédié et un suivi qualité." },
    ],
  },
  {
    slug: 'nettoyage-copropriete-lyon',
    keyword: 'nettoyage copropriété Lyon',
    eyebrow: 'Copropriétés & syndics',
    h1: 'Nettoyage de copropriété à Lyon',
    title: 'Nettoyage de copropriété à Lyon — MonCleanerPro | Parties communes & syndics',
    description: "Nettoyage des parties communes de copropriété à Lyon : halls, escaliers, ascenseurs, local poubelles. Passages réguliers pour syndics et gestionnaires. Fiabilité et suivi. Devis gratuit.",
    intro:
      "L’entretien des parties communes est le premier signe visible d’une copropriété bien gérée. MonCleanerPro accompagne les syndics, gestionnaires et conseils syndicaux de Lyon dans le nettoyage régulier des immeubles : halls, cages d’escalier, ascenseurs et locaux techniques, avec des passages fiables et un suivi transparent que vous pouvez présenter aux copropriétaires.",
    highlights: [
      { title: 'Parties communes complètes', text: "Halls, escaliers, paliers, ascenseurs, local vélos et local poubelles : rien n’est laissé de côté." },
      { title: 'Passages réguliers fiables', text: "Une fréquence tenue dans la durée, sans oublis, avec un interlocuteur pour le syndic." },
      { title: 'Sortie / rentrée des bacs', text: "Gestion des conteneurs et entretien du local poubelles, selon le calendrier de collecte." },
    ],
    includes: [
      'Nettoyage des halls d’entrée et paliers',
      'Cages d’escalier et rampes',
      'Cabines d’ascenseur et miroirs',
      'Local poubelles et sortie / rentrée des bacs',
      'Vitres des parties communes et boîtes aux lettres',
    ],
    faq: [
      { q: 'Travaillez-vous avec les syndics et gestionnaires ?', a: "Oui, nous intervenons pour des syndics professionnels comme pour des copropriétés en gestion bénévole, avec un contrat régulier." },
      { q: 'Gérez-vous la sortie des poubelles ?', a: "Oui, la sortie et la rentrée des conteneurs ainsi que l’entretien du local poubelles peuvent être inclus dans la prestation." },
    ],
  },
  {
    slug: 'nettoyage-vitres-lyon',
    keyword: 'nettoyage vitres Lyon',
    eyebrow: 'Vitrerie',
    h1: 'Nettoyage de vitres à Lyon',
    title: 'Nettoyage de vitres à Lyon — MonCleanerPro | Vitres, baies & vitrines',
    description: "Nettoyage de vitres à Lyon pour professionnels et particuliers : vitrines, baies vitrées, fenêtres, sans traces. Ponctuel ou régulier, en intérieur comme en extérieur accessible. Devis gratuit.",
    intro:
      "Des vitres nettes changent tout : une vitrine qui attire, des bureaux lumineux, un logement qui respire. MonCleanerPro réalise le nettoyage de vitres à Lyon pour les commerces, les bureaux et les particuliers — vitrines, baies vitrées et fenêtres, sans traces, en ponctuel ou en passage régulier.",
    highlights: [
      { title: 'Résultat sans traces', text: "Vitres, encadrements et rebords traités pour un rendu net et lumineux." },
      { title: 'Commerces & particuliers', text: "Vitrines de magasins, façades vitrées de bureaux, fenêtres et baies de logements." },
      { title: 'Ponctuel ou régulier', text: "Un passage unique ou un entretien programmé pour garder des vitres toujours impeccables." },
    ],
    includes: [
      'Nettoyage des vitres intérieures et extérieures accessibles',
      'Vitrines et façades vitrées de commerces',
      'Baies vitrées et fenêtres de logements',
      'Encadrements, rebords et traces nettoyés',
      'Passage ponctuel ou récurrent programmé',
    ],
    faq: [
      { q: 'Nettoyez-vous les vitres en hauteur ?', a: "Nous traitons les vitres accessibles en sécurité ; pour les grandes hauteurs nécessitant du matériel spécifique, nous vous orientons vers la solution adaptée." },
      { q: 'Intervenez-vous pour les commerces ?', a: "Oui, nous nettoyons régulièrement les vitrines et façades vitrées de commerces et de bureaux, en ponctuel ou en contrat régulier." },
    ],
  },
  {
    slug: 'nettoyage-commerce-lyon',
    keyword: 'nettoyage commerce Lyon',
    eyebrow: 'Commerces & boutiques',
    h1: 'Nettoyage de commerce à Lyon',
    title: 'Nettoyage de commerce à Lyon — MonCleanerPro | Boutiques, vitrines & surfaces de vente',
    description: "Nettoyage de commerces et boutiques à Lyon : surface de vente, vitrine, cabines d’essayage, sanitaires et réserve. Passages avant ouverture ou après fermeture. Devis gratuit sous 24h.",
    intro:
      "Dans un commerce, la propreté se voit avant le produit. Une vitrine marquée, un sol terne ou une cabine d’essayage négligée coûtent des ventes sans qu’aucun client ne vous le dise. MonCleanerPro entretient les boutiques, surfaces de vente et locaux commerciaux de Lyon et de la métropole, avec des passages calés avant l’ouverture ou après la fermeture pour ne jamais croiser votre clientèle.",
    highlights: [
      { title: 'Avant ouverture, après fermeture', text: "Nous intervenons hors des heures d’affluence : votre équipe arrive dans un magasin prêt à recevoir." },
      { title: 'La vitrine en priorité', text: "C’est le premier contact avec le passant. Vitrage, encadrements et devanture traités sans traces." },
      { title: 'Les zones qui trahissent', text: "Cabines d’essayage, miroirs, comptoir de caisse et sanitaires clients : les points que les clients jugent en premier." },
      { title: 'Fréquence sur mesure', text: "Quotidien pour les fortes affluences, quelques passages par semaine sinon, avec un interlocuteur dédié." },
    ],
    includes: [
      'Sols de la surface de vente aspirés et lavés',
      'Vitrine, devanture et surfaces vitrées sans traces',
      'Comptoir de caisse, présentoirs et mobilier dépoussiérés',
      'Cabines d’essayage, miroirs et assises',
      'Sanitaires clients et personnel désinfectés',
      'Réserve, arrière-boutique et gestion des corbeilles',
    ],
    faq: [
      { q: 'Intervenez-vous avant l’ouverture du magasin ?', a: "Oui, c’est le cas le plus fréquent. Nous intervenons tôt le matin avant l’arrivée de votre équipe, ou le soir après la fermeture, selon ce qui vous arrange." },
      { q: 'Nettoyez-vous la vitrine extérieure ?', a: "Oui, la vitrine et la devanture accessibles en sécurité sont traitées. C’est souvent la prestation qui a le plus d’impact visible sur la fréquentation." },
      { q: 'Pouvez-vous gérer plusieurs boutiques d’une même enseigne ?', a: "Oui, nous organisons des tournées multi-sites avec un planning coordonné et un interlocuteur unique pour l’ensemble de vos points de vente." },
      { q: 'Quelle fréquence recommandez-vous ?', a: "Cela dépend de votre flux. Un commerce à forte fréquentation gagne à un passage quotidien ; deux à trois passages hebdomadaires suffisent souvent pour une boutique plus calme." },
    ],
    related: ['nettoyage-vitres-lyon', 'nettoyage-bureaux-lyon', 'nettoyage-restaurant-lyon'],
  },
  {
    slug: 'nettoyage-restaurant-lyon',
    keyword: 'nettoyage restaurant Lyon',
    eyebrow: 'Restauration',
    h1: 'Nettoyage de restaurant à Lyon',
    title: 'Nettoyage de restaurant à Lyon — MonCleanerPro | Salle, cuisine & sanitaires',
    description: "Nettoyage de restaurants, bars et brasseries à Lyon : salle, cuisine, plonge, sanitaires et vitrerie. Passages de nuit ou entre deux services, en appui de votre plan de maîtrise sanitaire. Devis gratuit.",
    intro:
      "En restauration, la propreté n’est pas qu’une question d’image : c’est une obligation quotidienne, contrôlée, et le premier motif d’avis négatif en ligne. MonCleanerPro accompagne restaurants, brasseries et bars de Lyon sur l’entretien de la salle, des sanitaires et des zones de production, en appui de votre plan de maîtrise sanitaire — avec des passages de nuit ou entre deux services pour ne jamais bloquer votre exploitation.",
    highlights: [
      { title: 'La nuit ou entre deux services', text: "Votre salle est rendue prête pour le service suivant, sans jamais empiéter sur vos heures d’ouverture." },
      { title: 'Salle et sanitaires', text: "Les deux zones que le client juge. Sols dégraissés, banquettes, sanitaires désinfectés et réapprovisionnés." },
      { title: 'Dégraissage en profondeur', text: "Sols de cuisine, plinthes, carrelages muraux et abords de plonge : la graisse s’accumule là où on ne regarde plus." },
      { title: 'En appui de votre PMS', text: "Nous intervenons en complément de votre plan de maîtrise sanitaire et de l’entretien réalisé par votre brigade, jamais à sa place." },
    ],
    includes: [
      'Salle : sols, tables, banquettes, bar et comptoir',
      'Sanitaires clients désinfectés et réapprovisionnés',
      'Dégraissage des sols et carrelages muraux de cuisine',
      'Abords de plonge, plinthes et siphons de sol',
      'Vitrerie intérieure, devanture et terrasse vitrée',
      'Sortie des déchets et entretien du local poubelles',
    ],
    faq: [
      { q: 'Intervenez-vous la nuit ou tôt le matin ?', a: "Oui, la restauration impose des créneaux décalés : nous intervenons après la fermeture ou très tôt le matin, selon votre organisation de service." },
      { q: 'Remplacez-vous le nettoyage fait par la brigade ?', a: "Non. L’entretien courant des équipements de production et le respect de votre plan de maîtrise sanitaire restent de votre responsabilité. Nous intervenons en complément, sur la salle, les sanitaires et le dégraissage en profondeur." },
      { q: 'Nettoyez-vous les hottes et conduits d’extraction ?', a: "Le dégraissage des conduits d’extraction relève d’une entreprise spécialisée et certifiée pour cette prestation. Nous traitons les surfaces accessibles et vous orientons pour le reste." },
      { q: 'Pouvez-vous intervenir avant une ouverture ou une réouverture ?', a: "Oui, la remise en état complète avant une ouverture, une reprise de fonds ou une réouverture après travaux fait partie de nos prestations." },
    ],
    related: ['nettoyage-commerce-lyon', 'nettoyage-vitres-lyon', 'nettoyage-fin-de-chantier-lyon'],
  },
  {
    slug: 'nettoyage-cabinet-medical-lyon',
    keyword: 'nettoyage cabinet médical Lyon',
    eyebrow: 'Santé & cabinets',
    h1: 'Nettoyage de cabinet médical à Lyon',
    title: 'Nettoyage de cabinet médical à Lyon — MonCleanerPro | Hygiène & discrétion',
    description: "Nettoyage de cabinets médicaux, dentaires et paramédicaux à Lyon : salle d’attente, salle de soins, points de contact, sanitaires. Protocoles rigoureux, passages hors consultation. Devis gratuit.",
    intro:
      "Un cabinet de santé accueille chaque jour des patients dont certains sont fragiles, dans des locaux où les surfaces sont touchées en permanence. L’entretien y demande plus de méthode qu’ailleurs : un ordre de nettoyage qui évite les transferts, une attention constante aux points de contact, et une discrétion absolue. MonCleanerPro entretient les cabinets médicaux, dentaires et paramédicaux de Lyon et de la métropole, hors des heures de consultation.",
    highlights: [
      { title: 'Points de contact systématiques', text: "Poignées, interrupteurs, accoudoirs, comptoir d’accueil, terminaux de paiement : traités à chaque passage, pas une fois par semaine." },
      { title: 'Du plus propre au plus sale', text: "Un ordre d’intervention strict et du matériel distinct par zone, pour ne jamais transférer de contamination d’une pièce à l’autre." },
      { title: 'Hors consultation', text: "Interventions tôt le matin ou en soirée : aucun croisement avec vos patients, aucune gêne pour votre planning." },
      { title: 'Discrétion et confidentialité', text: "Intervenants encadrés, formés à ne jamais déplacer ni consulter un document, et à respecter le secret des lieux." },
    ],
    includes: [
      'Salle d’attente : sièges, tables, sols et aération',
      'Salle de soins : surfaces, mobilier et sols',
      'Désinfection des points de contact à chaque passage',
      'Accueil, secrétariat et espaces administratifs',
      'Sanitaires désinfectés et réapprovisionnés',
      'Gestion des corbeilles et des déchets non médicaux',
    ],
    faq: [
      { q: 'Prenez-vous en charge les déchets de soins (DASRI) ?', a: "Non. Les déchets d’activités de soins à risques infectieux relèvent d’une filière réglementée et d’un prestataire agréé. Nous gérons uniquement les déchets non médicaux, et nos intervenants sont formés à ne jamais manipuler les contenants dédiés." },
      { q: 'Intervenez-vous en dehors des consultations ?', a: "Oui, systématiquement : tôt le matin avant l’ouverture ou en soirée après le dernier patient, selon vos horaires." },
      { q: 'Utilisez-vous du matériel distinct par zone ?', a: "Oui. Le matériel est différencié entre salle de soins, sanitaires et espaces communs, et nous respectons un ordre d’intervention du plus propre vers le plus sale." },
      { q: 'Vos intervenants sont-ils sensibilisés à la confidentialité ?', a: "Oui. Ils sont encadrés et formés à la discrétion propre à ces lieux : aucun document n’est déplacé ni consulté, et rien de ce qui est vu sur place n’est commenté à l’extérieur." },
    ],
    related: ['nettoyage-ehpad-lyon', 'nettoyage-bureaux-lyon', 'nettoyage-copropriete-lyon'],
  },
  {
    slug: 'menage-domicile-lyon',
    keyword: 'ménage à domicile Lyon',
    eyebrow: 'Ménage régulier',
    h1: 'Ménage à domicile à Lyon',
    title: 'Ménage à domicile à Lyon — MonCleanerPro | Entretien régulier de votre logement',
    description: "Ménage à domicile régulier à Lyon : entretien hebdomadaire ou bimensuel de votre appartement ou maison, par un intervenant attitré. Prestations cadrées, remplacement assuré. Devis gratuit sous 24h.",
    intro:
      "Le ménage régulier, ce n’est pas le même métier qu’un grand ménage ponctuel. Ce qui compte ici, c’est la constance : le même intervenant qui connaît votre logement, la même qualité chaque semaine, et surtout quelqu’un qui vient vraiment — y compris pendant les congés. MonCleanerPro assure l’entretien régulier des logements de particuliers à Lyon et dans la métropole, avec un intervenant attitré et une continuité de service qui ne repose jamais sur une seule personne.",
    highlights: [
      { title: 'Un intervenant attitré', text: "La même personne d’une fois sur l’autre : elle connaît votre logement, vos priorités et vos habitudes." },
      { title: 'La continuité assurée', text: "Absence ou congés : nous organisons le remplacement. Votre entretien ne s’arrête pas parce qu’une personne est indisponible." },
      { title: 'Une prestation cadrée', text: "Ce qui est fait à chaque passage est défini avec vous, pas laissé à l’appréciation du moment." },
      { title: 'Équipe déclarée et encadrée', text: "Des intervenants formés, déclarés et suivis — la tranquillité juridique en plus de la tranquillité domestique." },
    ],
    includes: [
      'Entretien des pièces de vie : sols, surfaces, poussière',
      'Cuisine : plan de travail, évier, extérieur des équipements',
      'Salle de bains et WC nettoyés et désinfectés',
      'Chambres : aération, sols et surfaces',
      'Changement des draps et du linge sur demande',
      'Repassage possible selon la formule retenue',
      'Fréquence hebdomadaire, bimensuelle ou sur mesure',
    ],
    faq: [
      { q: 'Quelle différence avec le grand ménage ?', a: "Le grand ménage est une remise à neuf ponctuelle et en profondeur, souvent avant ou après un événement. Le ménage à domicile est un entretien régulier qui maintient le logement en état dans la durée. Beaucoup de clients commencent par un grand ménage, puis passent au régulier." },
      { q: 'Aurai-je toujours la même personne ?', a: "Oui, c’est le principe : un intervenant attitré qui connaît votre logement. En cas d’absence ou de congés, nous organisons un remplacement pour que la prestation soit assurée." },
      { q: 'Dois-je être présent pendant l’intervention ?', a: "Non. La plupart de nos clients réguliers nous confient un accès. Vous pouvez évidemment être présent si vous le préférez." },
      { q: 'Fournissez-vous les produits et le matériel ?', a: "Cela se décide avec vous. Certains clients préfèrent que nous utilisions leurs produits, notamment pour des surfaces spécifiques ou par choix personnel. Nous cadrons ce point avant la première intervention." },
      { q: 'Puis-je modifier la fréquence en cours de route ?', a: "Oui. La fréquence s’ajuste selon vos besoins, et une prestation ponctuelle supplémentaire reste toujours possible en plus du passage régulier." },
    ],
    related: ['grand-menage-lyon', 'nettoyage-vitres-lyon', 'menage-airbnb-lyon'],
    relatedPosts: ['choisir-societe-nettoyage-lyon'],
  },
  {
    slug: 'nettoyage-villefranche-sur-saone',
    keyword: 'nettoyage Villefranche-sur-Saône',
    eyebrow: 'Villefranche-sur-Saône',
    h1: 'Entreprise de nettoyage à Villefranche-sur-Saône',
    title: 'Nettoyage à Villefranche-sur-Saône — MonCleanerPro | Pros & particuliers',
    description: "Entreprise de nettoyage à Villefranche-sur-Saône et dans le Beaujolais : bureaux, commerces, copropriétés, locations Airbnb, fin de chantier et grand ménage. Équipe formée, devis gratuit sous 24h.",
    intro:
      "MonCleanerPro étend son savoir-faire au-delà de Lyon jusqu’à Villefranche-sur-Saône et au Beaujolais. Bureaux, commerces, copropriétés, hôtels, locations courte durée ou logements de particuliers : nous assurons un nettoyage régulier ou ponctuel, avec des équipes formées, un contrôle qualité systématique et un suivi digital de chaque intervention. Un seul interlocuteur, la même exigence que sur la métropole lyonnaise.",
    highlights: [
      { title: 'Caladois de proximité', text: "Interventions à Villefranche-sur-Saône et communes voisines du Beaujolais, avec réactivité locale." },
      { title: 'Pros & particuliers', text: "Entreprises, commerces, syndics, conciergeries et particuliers : une solution pour chaque besoin." },
      { title: 'Régulier ou ponctuel', text: "Contrat d’entretien récurrent ou prestation unique (grand ménage, fin de chantier), selon vos attentes." },
    ],
    includes: [
      'Nettoyage de bureaux et locaux professionnels',
      'Entretien des parties communes de copropriété',
      'Ménage de locations courte durée (Airbnb)',
      'Nettoyage de fin de chantier et grand ménage',
      'Nettoyage de vitres et vitrines de commerces',
    ],
    faq: [
      { q: 'Intervenez-vous à Villefranche-sur-Saône et dans le Beaujolais ?', a: "Oui, nous couvrons Villefranche-sur-Saône et les communes voisines du Beaujolais, en plus de Lyon et de la métropole." },
      { q: 'Proposez-vous du régulier comme du ponctuel ?', a: "Oui : contrats d’entretien réguliers pour les pros et copropriétés, comme prestations ponctuelles (grand ménage, fin de chantier) pour les particuliers." },
    ],
  },
  {
    slug: 'nettoyage-caluire-et-cuire',
    keyword: 'nettoyage Caluire-et-Cuire',
    eyebrow: 'Caluire-et-Cuire',
    h1: 'Entreprise de nettoyage à Caluire-et-Cuire',
    title: 'Nettoyage à Caluire-et-Cuire — MonCleanerPro | Pros & particuliers',
    description: "Entreprise de nettoyage à Caluire-et-Cuire : bureaux, copropriétés, résidences, locations Airbnb et grand ménage chez les particuliers. Équipe formée, proximité lyonnaise, devis gratuit sous 24h.",
    intro:
      "Aux portes nord de Lyon, Caluire-et-Cuire mêle résidences soignées, copropriétés et petites entreprises. MonCleanerPro y assure l’entretien des bureaux, des parties communes d’immeubles et des logements — en récurrent ou en ponctuel. Grâce à notre proximité immédiate avec Lyon, nous intervenons vite et gardons partout le même standard : équipes formées, contrôle qualité et suivi digital de chaque passage.",
    highlights: [
      { title: 'Proximité immédiate de Lyon', text: "À deux pas de nos zones lyonnaises : réactivité et interventions faciles à planifier à Caluire-et-Cuire." },
      { title: 'Résidences & copropriétés', text: "Entretien régulier des parties communes et des logements, avec un interlocuteur dédié." },
      { title: 'Pros & particuliers', text: "Bureaux, commerces de quartier et particuliers : une réponse adaptée à chaque besoin." },
    ],
    includes: [
      'Entretien de bureaux et locaux professionnels',
      'Parties communes de copropriété (halls, escaliers)',
      'Ménage de locations courte durée (Airbnb)',
      'Grand ménage et remise en état de logements',
      'Nettoyage de vitres et surfaces vitrées',
    ],
    faq: [
      { q: 'Intervenez-vous rapidement à Caluire-et-Cuire ?', a: "Oui, la commune est limitrophe de nos zones lyonnaises : nous y planifions facilement des interventions régulières comme ponctuelles." },
      { q: 'Gérez-vous les copropriétés du secteur ?', a: "Oui, nous entretenons les parties communes pour les syndics et copropriétés de Caluire-et-Cuire, avec un suivi transparent." },
    ],
  },
  {
    slug: 'nettoyage-venissieux',
    keyword: 'nettoyage Vénissieux',
    eyebrow: 'Vénissieux',
    h1: 'Entreprise de nettoyage à Vénissieux',
    title: 'Nettoyage à Vénissieux — MonCleanerPro | Entreprises, copropriétés & particuliers',
    description: "Entreprise de nettoyage à Vénissieux : bureaux, locaux d’activité, copropriétés, commerces et logements. Interventions régulières hors horaires, équipe formée. Devis gratuit sous 24h.",
    intro:
      "Au sud-est de Lyon, Vénissieux conjugue zones d’activité, tertiaire, commerces et habitat collectif. MonCleanerPro y accompagne les entreprises, les syndics et les particuliers : entretien de bureaux et de locaux d’activité hors horaires, nettoyage des parties communes de copropriété et prestations ponctuelles à domicile. Une organisation pensée pour le volume et les plannings serrés, avec la régularité qui fait la différence.",
    highlights: [
      { title: 'Tertiaire & locaux d’activité', text: "Bureaux, plateformes et locaux professionnels entretenus tôt le matin ou en soirée, hors présence." },
      { title: 'Habitat collectif', text: "Nettoyage régulier des parties communes pour les copropriétés et bailleurs du secteur." },
      { title: 'Volume maîtrisé', text: "Multi-sites et plannings serrés : notre organisation suit la cadence sans perdre en qualité." },
    ],
    includes: [
      'Nettoyage de bureaux et locaux d’activité',
      'Entretien des parties communes d’immeubles',
      'Nettoyage de commerces et surfaces de vente',
      'Grand ménage et remise en état de logements',
      'Vitres, vitrines et points de contact',
    ],
    faq: [
      { q: 'Intervenez-vous en dehors des heures d’activité ?', a: "Oui, pour les entreprises de Vénissieux nous intervenons tôt le matin ou en soirée afin de ne pas perturber votre activité." },
      { q: 'Pouvez-vous gérer plusieurs sites ?', a: "Oui, nous organisons des tournées multi-sites avec plannings synchronisés et un interlocuteur unique." },
    ],
  },
  {
    slug: 'nettoyage-neuville-sur-saone',
    keyword: 'nettoyage Neuville-sur-Saône',
    eyebrow: 'Neuville-sur-Saône',
    h1: 'Entreprise de nettoyage à Neuville-sur-Saône',
    title: 'Nettoyage à Neuville-sur-Saône — MonCleanerPro | Commerces, copropriétés & particuliers',
    description: "Entreprise de nettoyage à Neuville-sur-Saône et au Val de Saône : commerces, bureaux, copropriétés, locations et grand ménage. Service de proximité, équipe formée. Devis gratuit sous 24h.",
    intro:
      "Au nord de la métropole, le long de la Saône, Neuville-sur-Saône et les communes du Val de Saône allient centre-bourg commerçant et habitat résidentiel. MonCleanerPro y propose un nettoyage de proximité : commerces et bureaux, parties communes de copropriété, locations courte durée et grand ménage chez les particuliers. Un service à taille humaine, régulier et soigné, avec le même contrôle qualité que sur Lyon.",
    highlights: [
      { title: 'Service de proximité', text: "Interventions à Neuville-sur-Saône et dans les communes du Val de Saône, avec réactivité locale." },
      { title: 'Commerces & centre-bourg', text: "Vitrines, boutiques et bureaux entretenus régulièrement pour une image toujours nette." },
      { title: 'Copropriétés & particuliers', text: "Parties communes d’immeubles et grands ménages ponctuels chez les particuliers." },
    ],
    includes: [
      'Nettoyage de commerces et vitrines',
      'Entretien de bureaux et locaux professionnels',
      'Parties communes de copropriété',
      'Ménage de locations courte durée (Airbnb)',
      'Grand ménage et remise en état de logements',
    ],
    faq: [
      { q: 'Couvrez-vous le Val de Saône autour de Neuville ?', a: "Oui, nous intervenons à Neuville-sur-Saône et dans les communes voisines du Val de Saône, en plus de Lyon et de la métropole." },
      { q: 'Travaillez-vous avec les commerces du centre ?', a: "Oui, nous entretenons régulièrement vitrines, boutiques et bureaux du centre-bourg, en ponctuel ou en contrat régulier." },
    ],
  },
  {
    slug: 'nettoyage-bron',
    keyword: 'nettoyage Bron',
    eyebrow: 'Bron',
    h1: 'Entreprise de nettoyage à Bron',
    title: 'Nettoyage à Bron — MonCleanerPro | Bureaux, santé, copropriétés',
    description: "Entreprise de nettoyage à Bron : bureaux, cabinets et établissements de santé, copropriétés, commerces et logements. Protocoles rigoureux, interventions régulières. Devis gratuit sous 24h.",
    intro:
      "À l’est de Lyon, Bron accueille pôles de santé, tertiaire et zones résidentielles à proximité de l’aéroport et des grands axes. MonCleanerPro y assure l’entretien des bureaux, cabinets médicaux, copropriétés et logements avec une exigence particulière sur l’hygiène et la régularité. Nos équipes formées et notre suivi digital garantissent un standard constant, même sur des sites à forte fréquentation.",
    highlights: [
      { title: 'Exigence santé & tertiaire', text: "Cabinets, bureaux et sites à forte fréquentation : protocoles d’hygiène et points de contact désinfectés." },
      { title: 'Accès faciles', text: "Proche de l’aéroport et des grands axes : interventions planifiées sans contrainte à Bron." },
      { title: 'Copropriétés & logements', text: "Entretien régulier des parties communes et grands ménages ponctuels chez les particuliers." },
    ],
    includes: [
      'Nettoyage de bureaux et cabinets',
      'Désinfection des points de contact et sanitaires',
      'Parties communes de copropriété',
      'Ménage de locations courte durée (Airbnb)',
      'Grand ménage et vitres',
    ],
    faq: [
      { q: 'Intervenez-vous dans les cabinets et bureaux de Bron ?', a: "Oui, nous entretenons bureaux et cabinets avec des protocoles d’hygiène adaptés, en passages réguliers hors présence." },
      { q: 'Gérez-vous les copropriétés ?', a: "Oui, nous assurons le nettoyage régulier des parties communes pour les syndics et copropriétés de Bron." },
    ],
  },
  {
    slug: 'nettoyage-saint-priest',
    keyword: 'nettoyage Saint-Priest',
    eyebrow: 'Saint-Priest',
    h1: 'Entreprise de nettoyage à Saint-Priest',
    title: 'Nettoyage à Saint-Priest — MonCleanerPro | Locaux d’activité & bureaux',
    description: "Entreprise de nettoyage à Saint-Priest : bureaux, locaux d’activité et logistiques, commerces, copropriétés et logements. Interventions multi-sites hors horaires. Devis gratuit sous 24h.",
    intro:
      "Au sud-est de la métropole, Saint-Priest est un pôle d’activité majeur : parc technologique, zones logistiques, tertiaire et habitat. MonCleanerPro y accompagne les entreprises et les copropriétés avec un entretien fiable, organisé pour les grands volumes et les plannings serrés. Bureaux nettoyés hors horaires, locaux d’activité entretenus régulièrement, parties communes suivies : un seul interlocuteur pour tous vos sites.",
    highlights: [
      { title: 'Zones d’activité & tertiaire', text: "Locaux logistiques, bureaux et parc technologique entretenus tôt le matin ou en soirée." },
      { title: 'Multi-sites', text: "Tournées organisées pour plusieurs sites, avec plannings synchronisés et suivi qualité." },
      { title: 'Copropriétés & particuliers', text: "Parties communes d’immeubles et prestations ponctuelles chez les particuliers." },
    ],
    includes: [
      'Nettoyage de bureaux et locaux d’activité',
      'Entretien de surfaces logistiques et industrielles légères',
      'Parties communes de copropriété',
      'Commerces et vitrines',
      'Grand ménage et remise en état de logements',
    ],
    faq: [
      { q: 'Pouvez-vous entretenir de grands locaux d’activité ?', a: "Oui, nous intervenons sur des locaux d’activité et bureaux à Saint-Priest, avec une organisation adaptée aux volumes et aux horaires décalés." },
      { q: 'Gérez-vous plusieurs sites d’entreprise ?', a: "Oui, nous mettons en place des tournées multi-sites avec un interlocuteur unique et un planning régulier." },
    ],
  },
  {
    slug: 'nettoyage-ecully',
    keyword: 'nettoyage Écully',
    eyebrow: 'Écully',
    h1: 'Entreprise de nettoyage à Écully',
    title: 'Nettoyage à Écully — MonCleanerPro | Bureaux, résidences & particuliers',
    description: "Entreprise de nettoyage à Écully : bureaux et écoles, résidences et copropriétés de standing, locations et grand ménage chez les particuliers. Finitions soignées. Devis gratuit sous 24h.",
    intro:
      "À l’ouest de Lyon, Écully est réputée pour son cadre résidentiel de standing, ses grandes écoles et ses sièges d’entreprise. MonCleanerPro y apporte un nettoyage haut de gamme, attentif aux finitions : bureaux et espaces d’accueil soignés, parties communes de résidences entretenues avec régularité, et grands ménages exigeants chez les particuliers. Des équipes formées, discrètes et respectueuses des lieux.",
    highlights: [
      { title: 'Finitions haut de gamme', text: "Un souci du détail adapté aux résidences de standing et aux espaces d’accueil d’entreprise." },
      { title: 'Bureaux & écoles', text: "Entretien régulier des bureaux, sièges et établissements, hors horaires de présence." },
      { title: 'Discrétion & régularité', text: "Des intervenants soignés et discrets, pour une qualité constante dans la durée." },
    ],
    includes: [
      'Nettoyage de bureaux et espaces d’accueil',
      'Parties communes de résidences et copropriétés',
      'Grand ménage et remise en état de logements',
      'Ménage de locations courte durée (Airbnb)',
      'Vitres et surfaces vitrées',
    ],
    faq: [
      { q: 'Proposez-vous un service soigné pour les résidences de standing ?', a: "Oui, à Écully nous portons une attention particulière aux finitions et à la discrétion, pour les résidences comme pour les entreprises." },
      { q: 'Intervenez-vous chez les particuliers ?', a: "Oui, nous réalisons grands ménages et prestations ponctuelles à domicile, en plus de nos contrats professionnels." },
    ],
  },
  {
    slug: 'nettoyage-tassin-la-demi-lune',
    keyword: 'nettoyage Tassin-la-Demi-Lune',
    eyebrow: 'Tassin-la-Demi-Lune',
    h1: 'Entreprise de nettoyage à Tassin-la-Demi-Lune',
    title: 'Nettoyage à Tassin-la-Demi-Lune — MonCleanerPro | Commerces, copropriétés & particuliers',
    description: "Entreprise de nettoyage à Tassin-la-Demi-Lune : commerces et bureaux, copropriétés, locations et grand ménage chez les particuliers. Service de proximité à l’ouest lyonnais. Devis gratuit sous 24h.",
    intro:
      "Aux portes ouest de Lyon, Tassin-la-Demi-Lune associe centre commerçant dynamique et quartiers résidentiels. MonCleanerPro y propose un nettoyage de proximité : vitrines et bureaux du centre entretenus régulièrement, parties communes de copropriété suivies, et grands ménages ponctuels chez les particuliers. Une intervention fiable et soignée, avec le même contrôle qualité que sur toute la métropole.",
    highlights: [
      { title: 'Commerces & centre-ville', text: "Vitrines, boutiques et bureaux du centre de Tassin entretenus pour une image toujours nette." },
      { title: 'Copropriétés résidentielles', text: "Nettoyage régulier des parties communes pour les immeubles et résidences du secteur." },
      { title: 'Proximité ouest lyonnais', text: "Interventions faciles à planifier, avec la réactivité d’un prestataire local." },
    ],
    includes: [
      'Nettoyage de commerces et vitrines',
      'Entretien de bureaux et locaux professionnels',
      'Parties communes de copropriété',
      'Grand ménage et remise en état de logements',
      'Ménage de locations courte durée (Airbnb)',
    ],
    faq: [
      { q: 'Entretenez-vous les commerces du centre de Tassin ?', a: "Oui, nous nettoyons régulièrement vitrines, boutiques et bureaux, en ponctuel ou en contrat régulier." },
      { q: 'Gérez-vous les copropriétés du secteur ?', a: "Oui, nous assurons l’entretien des parties communes pour les copropriétés et syndics de Tassin-la-Demi-Lune." },
    ],
  },
  {
    slug: 'nettoyage-rillieux-la-pape',
    keyword: 'nettoyage Rillieux-la-Pape',
    eyebrow: 'Rillieux-la-Pape',
    h1: 'Entreprise de nettoyage à Rillieux-la-Pape',
    title: 'Nettoyage à Rillieux-la-Pape — MonCleanerPro | Entreprises, copropriétés & particuliers',
    description: "Entreprise de nettoyage à Rillieux-la-Pape : bureaux et locaux d’activité, copropriétés et bailleurs, commerces et logements. Interventions régulières fiables. Devis gratuit sous 24h.",
    intro:
      "Au nord-est de Lyon, Rillieux-la-Pape mêle zones d’activité, habitat collectif et commerces. MonCleanerPro y accompagne les entreprises, les bailleurs et les copropriétés avec un entretien régulier et fiable : bureaux et locaux nettoyés hors horaires, parties communes d’immeubles suivies sans oublis, et prestations ponctuelles chez les particuliers. La régularité et la traçabilité qui rassurent gestionnaires et habitants.",
    highlights: [
      { title: 'Entreprises & locaux', text: "Bureaux et locaux d’activité entretenus tôt le matin ou en soirée, sans gêner l’activité." },
      { title: 'Bailleurs & copropriétés', text: "Parties communes suivies avec régularité et traçabilité, pour syndics et bailleurs sociaux." },
      { title: 'Fiabilité dans la durée', text: "Des passages tenus, un interlocuteur dédié et un suivi digital de chaque intervention." },
    ],
    includes: [
      'Nettoyage de bureaux et locaux d’activité',
      'Entretien des parties communes d’immeubles',
      'Commerces et surfaces de vente',
      'Grand ménage et remise en état de logements',
      'Vitres et points de contact',
    ],
    faq: [
      { q: 'Travaillez-vous avec les bailleurs et copropriétés ?', a: "Oui, nous entretenons les parties communes pour bailleurs et syndics à Rillieux-la-Pape, avec un suivi transparent." },
      { q: 'Intervenez-vous hors des heures d’activité ?', a: "Oui, pour les entreprises nous intervenons tôt le matin ou en soirée afin de ne pas perturber votre activité." },
    ],
  },

  {
    slug: 'nettoyage-villeurbanne',
    keyword: 'nettoyage Villeurbanne',
    eyebrow: 'Villeurbanne',
    h1: 'Entreprise de nettoyage à Villeurbanne',
    title: 'Nettoyage à Villeurbanne — MonCleanerPro | Entreprises, copropriétés & particuliers',
    description: "Entreprise de nettoyage à Villeurbanne : bureaux, commerces, copropriétés, locations étudiantes et Airbnb, grand ménage chez les particuliers. Équipe formée, réactivité locale. Devis gratuit sous 24h.",
    intro:
      "Deuxième ville de la métropole, Villeurbanne concentre à peu près tous les besoins d’entretien à la fois : sièges d’entreprise et bureaux vers Charpennes, commerces du centre et des Gratte-Ciel, copropriétés anciennes en pleine réhabilitation, et un parc locatif très mouvementé autour de la Doua et des campus. MonCleanerPro y intervient pour les professionnels comme pour les particuliers, avec l’avantage d’être immédiatement voisin de nos zones lyonnaises — donc capable de planifier vite.",
    highlights: [
      { title: 'Rotation locative soutenue', text: "Étudiants, jeunes actifs, courte durée : les logements villeurbannais changent souvent de mains. Nous tenons ce rythme de remises en état." },
      { title: 'Copropriétés anciennes', text: "Immeubles d’avant-guerre et résidences des années soixante : parties communes entretenues avec régularité, pour syndics comme pour conseils syndicaux." },
      { title: 'Tertiaire et commerces', text: "Bureaux, sièges et boutiques entretenus hors horaires, sans gêner ni vos équipes ni votre clientèle." },
    ],
    includes: [
      'Entretien de bureaux et locaux professionnels',
      'Parties communes de copropriété (halls, escaliers, ascenseurs)',
      'Ménage de locations courte durée et remises en état locatives',
      'Nettoyage de commerces, boutiques et vitrines',
      'Grand ménage et nettoyage en profondeur chez les particuliers',
      'Remise en état après travaux ou fin de chantier',
    ],
    faq: [
      { q: 'Intervenez-vous rapidement à Villeurbanne ?', a: "Oui. La commune est limitrophe de nos zones lyonnaises : nous y planifions facilement des interventions régulières comme ponctuelles, souvent à quelques jours." },
      { q: 'Gérez-vous les remises en état entre deux locataires ?', a: "Oui, c’est une demande fréquente à Villeurbanne compte tenu de la rotation locative. Nous calons l’intervention juste avant l’état des lieux d’entrée." },
      { q: 'Travaillez-vous avec les syndics du secteur ?', a: "Oui, nous entretenons les parties communes pour des syndics professionnels comme pour des copropriétés en gestion bénévole, avec un suivi transparent." },
      { q: 'Intervenez-vous après des travaux ?', a: "Oui, la remise en état après rénovation est l’un de nos savoir-faire à Villeurbanne, où le parc ancien est très rénové. Nous avons une page dédiée au nettoyage de fin de chantier sur la commune." },
    ],
    related: ['nettoyage-fin-de-chantier-villeurbanne', 'nettoyage-copropriete-lyon', 'menage-airbnb-lyon', 'nettoyage-bureaux-lyon'],
  },
  {
    slug: 'nettoyage-oullins-pierre-benite',
    keyword: 'nettoyage Oullins',
    eyebrow: 'Oullins-Pierre-Bénite',
    h1: 'Entreprise de nettoyage à Oullins-Pierre-Bénite',
    title: 'Nettoyage à Oullins-Pierre-Bénite — MonCleanerPro | Commerces, copropriétés & particuliers',
    description: "Entreprise de nettoyage à Oullins-Pierre-Bénite : commerces du centre, bureaux, copropriétés, cabinets et logements de particuliers. Service de proximité au sud-ouest lyonnais. Devis gratuit sous 24h.",
    intro:
      "Au sud-ouest de Lyon, Oullins-Pierre-Bénite associe un centre commerçant animé, un habitat mixte entre immeubles et maisons, et la proximité immédiate du pôle hospitalier Lyon Sud. MonCleanerPro y assure l’entretien des commerces, des bureaux, des cabinets et des parties communes d’immeubles, ainsi que les prestations ponctuelles chez les particuliers — avec la réactivité que permet la desserte directe par le métro et les grands axes.",
    highlights: [
      { title: 'Centre commerçant', text: "Boutiques, vitrines et locaux du centre entretenus avant ouverture, pour une devanture toujours nette." },
      { title: 'Cabinets et professions libérales', text: "La proximité du pôle Lyon Sud attire de nombreux praticiens : nous entretenons leurs cabinets hors consultation." },
      { title: 'Habitat mixte', text: "Copropriétés et maisons individuelles : parties communes régulières d’un côté, prestations ponctuelles de l’autre." },
    ],
    includes: [
      'Nettoyage de commerces, boutiques et vitrines',
      'Entretien de bureaux et de cabinets professionnels',
      'Parties communes de copropriété',
      'Grand ménage et remise en état de logements',
      'Ménage de locations courte durée (Airbnb)',
      'Nettoyage de vitres et surfaces vitrées',
    ],
    faq: [
      { q: 'La commune s’appelle-t-elle encore Oullins ?', a: "Oullins et Pierre-Bénite forment désormais la commune nouvelle d’Oullins-Pierre-Bénite. Nous intervenons sur l’ensemble du territoire, quel que soit le nom que vous utilisez." },
      { q: 'Entretenez-vous les cabinets médicaux et paramédicaux ?', a: "Oui, avec des protocoles adaptés et des passages hors consultation. C’est une demande fréquente du fait de la proximité du pôle hospitalier Lyon Sud." },
      { q: 'Intervenez-vous avant l’ouverture des commerces ?', a: "Oui, tôt le matin avant l’arrivée de vos équipes, ou en soirée après la fermeture, selon votre organisation." },
    ],
    related: ['nettoyage-commerce-lyon', 'nettoyage-cabinet-medical-lyon', 'nettoyage-copropriete-lyon', 'nettoyage-saint-genis-laval'],
  },
  {
    slug: 'nettoyage-vaulx-en-velin',
    keyword: 'nettoyage Vaulx-en-Velin',
    eyebrow: 'Vaulx-en-Velin',
    h1: 'Entreprise de nettoyage à Vaulx-en-Velin',
    title: 'Nettoyage à Vaulx-en-Velin — MonCleanerPro | Bailleurs, entreprises & commerces',
    description: "Entreprise de nettoyage à Vaulx-en-Velin : parties communes pour bailleurs et copropriétés, bureaux et locaux d’activité, commerces du Carré de Soie. Interventions régulières. Devis gratuit sous 24h.",
    intro:
      "Vaulx-en-Velin conjugue un habitat collectif important, un tissu d’activité dense et un secteur en pleine transformation autour du Carré de Soie. Les besoins d’entretien y sont d’abord des besoins de régularité : des parties communes suivies sans oubli, des locaux professionnels nettoyés hors exploitation, et une traçabilité que les bailleurs et gestionnaires puissent présenter. MonCleanerPro y intervient avec cette exigence de constance dans la durée.",
    highlights: [
      { title: 'Bailleurs et gestionnaires', text: "Parties communes entretenues à fréquence tenue, avec un rapport d’intervention qui documente chaque passage." },
      { title: 'Renouvellement urbain', text: "Secteur du Carré de Soie et programmes récents : remises en état après travaux et entretien des nouveaux ensembles." },
      { title: 'Locaux d’activité', text: "Ateliers, bureaux et surfaces professionnelles nettoyés tôt le matin ou en soirée, hors présence." },
    ],
    includes: [
      'Entretien des parties communes d’immeubles',
      'Sortie et rentrée des conteneurs, local poubelles',
      'Nettoyage de bureaux et locaux d’activité',
      'Commerces et surfaces de vente',
      'Remise en état de logements avant relocation',
      'Vitres des parties communes et points de contact',
    ],
    faq: [
      { q: 'Travaillez-vous avec les bailleurs sociaux ?', a: "Oui, nous entretenons les parties communes pour des bailleurs comme pour des syndics privés, avec un suivi documenté de chaque passage." },
      { q: 'Gérez-vous la sortie des poubelles ?', a: "Oui, la sortie et la rentrée des conteneurs ainsi que l’entretien du local poubelles peuvent être inclus dans la prestation, selon le calendrier de collecte." },
      { q: 'Intervenez-vous sur plusieurs immeubles à la fois ?', a: "Oui, nous organisons des tournées couvrant plusieurs adresses avec un planning coordonné et un interlocuteur unique." },
    ],
    related: ['nettoyage-copropriete-lyon', 'nettoyage-venissieux', 'nettoyage-bureaux-lyon'],
  },
  {
    slug: 'nettoyage-meyzieu',
    keyword: 'nettoyage Meyzieu',
    eyebrow: 'Meyzieu',
    h1: 'Entreprise de nettoyage à Meyzieu',
    title: 'Nettoyage à Meyzieu — MonCleanerPro | PME, zone industrielle & particuliers',
    description: "Entreprise de nettoyage à Meyzieu : bureaux et locaux de la zone industrielle, commerces, copropriétés et maisons de particuliers. Interventions hors horaires, équipe formée. Devis gratuit sous 24h.",
    intro:
      "À l’est de la métropole, Meyzieu combine une zone industrielle et artisanale importante avec un tissu pavillonnaire étendu. Le profil des demandes y est particulier : beaucoup de PME et d’artisans qui cherchent un prestataire fiable pour des locaux de taille moyenne, et des particuliers en maison individuelle plutôt qu’en appartement. MonCleanerPro s’adapte à ces deux réalités, avec la desserte facile qu’offre le tramway et la rocade est.",
    highlights: [
      { title: 'PME et artisans', text: "Locaux de taille moyenne, ateliers et bureaux : un entretien régulier proportionné, sans usine à gaz contractuelle." },
      { title: 'Maisons individuelles', text: "Volumes plus importants qu’en appartement : grand ménage, vitres et remise en état dimensionnés en conséquence." },
      { title: 'Hors horaires d’activité', text: "Interventions tôt le matin ou en soirée pour les entreprises de la zone, sans perturber la production." },
    ],
    includes: [
      'Nettoyage de bureaux, ateliers et locaux d’activité',
      'Entretien de commerces et de surfaces de vente',
      'Parties communes de copropriété et de résidences',
      'Grand ménage et nettoyage en profondeur de maisons',
      'Nettoyage de vitres, baies vitrées et vérandas',
      'Remise en état après travaux ou avant emménagement',
    ],
    faq: [
      { q: 'Intervenez-vous dans la zone industrielle de Meyzieu ?', a: "Oui, nous entretenons bureaux, ateliers et locaux d’activité du secteur, avec des passages calés hors horaires de production." },
      { q: 'Traitez-vous les maisons individuelles ?', a: "Oui, et nous dimensionnons l’équipe en conséquence : une maison représente souvent plus de surface et plus de vitrage qu’un appartement." },
      { q: 'Proposez-vous un contrat régulier pour une petite entreprise ?', a: "Oui, sans volume minimum démesuré. Nous calons la fréquence sur vos besoins réels, avec un interlocuteur dédié." },
    ],
    related: ['nettoyage-decines-charpieu', 'nettoyage-bureaux-lyon', 'nettoyage-vitres-lyon'],
  },
  {
    slug: 'nettoyage-decines-charpieu',
    keyword: 'nettoyage Décines-Charpieu',
    eyebrow: 'Décines-Charpieu',
    h1: 'Entreprise de nettoyage à Décines-Charpieu',
    title: 'Nettoyage à Décines-Charpieu — MonCleanerPro | Hébergement, commerces & particuliers',
    description: "Entreprise de nettoyage à Décines-Charpieu : hébergements et locations courte durée près du stade, commerces, bureaux, copropriétés et particuliers. Cadence événementielle tenue. Devis gratuit sous 24h.",
    intro:
      "Décines-Charpieu vit à un rythme particulier depuis l’installation du Groupama Stadium et du pôle de loisirs qui l’entoure : des pics de fréquentation liés aux matchs et aux concerts, une offre d’hébergement courte durée qui s’est fortement développée, et un secteur résidentiel en croissance. MonCleanerPro y accompagne les hébergeurs, les commerces et les copropriétés, avec la capacité à absorber les rotations serrées des week-ends d’événement.",
    highlights: [
      { title: 'Cadence événementielle', text: "Week-ends de match ou de concert : rotations rapprochées sur les hébergements, sans baisse de finition." },
      { title: 'Locations courte durée', text: "Ménage entre voyageurs, linge et mise en place pour les propriétaires et conciergeries du secteur." },
      { title: 'Résidentiel en croissance', text: "Programmes récents et copropriétés : entretien des parties communes et remises en état de logements." },
    ],
    includes: [
      'Ménage entre voyageurs (Airbnb et courte durée)',
      'Changement du linge et mise en place d’accueil',
      'Parties communes de copropriété et de résidences',
      'Nettoyage de commerces et de bureaux',
      'Grand ménage et remise en état de logements',
      'Nettoyage de fin de chantier sur les programmes neufs',
    ],
    faq: [
      { q: 'Pouvez-vous suivre le rythme des week-ends d’événement ?', a: "Oui, c’est un cas d’usage identifié à Décines : nous planifions les rotations en amont des dates de match ou de concert pour que les logements soient prêts entre deux arrivées." },
      { q: 'Travaillez-vous avec les conciergeries du secteur ?', a: "Oui, sur plusieurs logements à la fois, avec des plannings synchronisés sur vos arrivées et départs." },
      { q: 'Intervenez-vous sur les programmes neufs ?', a: "Oui, les livraisons de logements neufs du secteur font partie de nos interventions de fin de chantier." },
    ],
    related: ['menage-airbnb-lyon', 'nettoyage-meyzieu', 'nettoyage-fin-de-chantier-lyon'],
  },
  {
    slug: 'nettoyage-sainte-foy-les-lyon',
    keyword: 'nettoyage Sainte-Foy-lès-Lyon',
    eyebrow: 'Sainte-Foy-lès-Lyon',
    h1: 'Entreprise de nettoyage à Sainte-Foy-lès-Lyon',
    title: 'Nettoyage à Sainte-Foy-lès-Lyon — MonCleanerPro | Résidences, maisons & particuliers',
    description: "Entreprise de nettoyage à Sainte-Foy-lès-Lyon : maisons et résidences de standing, copropriétés soignées, ménage à domicile régulier et grand ménage. Discrétion et finitions. Devis gratuit sous 24h.",
    intro:
      "Sur les hauteurs à l’ouest de Lyon, Sainte-Foy-lès-Lyon est avant tout une commune résidentielle : maisons avec jardin, résidences soignées, copropriétés où les parties communes sont un sujet d’attention. Les attentes y portent moins sur le volume que sur le soin du détail et la discrétion des intervenants. MonCleanerPro y propose un entretien régulier à domicile et des prestations ponctuelles, avec le niveau de finition que ce type de bien demande.",
    highlights: [
      { title: 'Le détail avant le volume', text: "Finitions soignées, respect des matériaux et des objets : ce qui compte ici, c’est la qualité du fini." },
      { title: 'Intervenant attitré', text: "Pour l’entretien régulier, la même personne d’une fois sur l’autre — elle connaît la maison et vos habitudes." },
      { title: 'Discrétion', text: "Des intervenants encadrés, formés à la réserve, chez des clients souvent absents pendant la prestation." },
    ],
    includes: [
      'Ménage à domicile régulier, hebdomadaire ou bimensuel',
      'Grand ménage et nettoyage en profondeur',
      'Vitres, baies vitrées et vérandas',
      'Parties communes de résidences et copropriétés',
      'Remise en état avant ou après un déménagement',
      'Nettoyage après travaux de rénovation',
    ],
    faq: [
      { q: 'Proposez-vous un entretien régulier à domicile ?', a: "Oui, c’est la demande principale sur la commune : un passage hebdomadaire ou bimensuel avec un intervenant attitré, et un remplacement organisé en cas d’absence." },
      { q: 'Puis-je être absent pendant l’intervention ?', a: "Oui, la plupart de nos clients réguliers nous confient un accès. Nos intervenants sont encadrés et formés à la discrétion." },
      { q: 'Traitez-vous les grandes surfaces vitrées ?', a: "Oui, baies vitrées et vérandas sont fréquentes sur la commune. Les surfaces accessibles en sécurité sont traitées sans traces." },
    ],
    related: ['menage-domicile-lyon', 'grand-menage-lyon', 'nettoyage-ecully', 'nettoyage-vitres-lyon'],
  },
  {
    slug: 'nettoyage-saint-genis-laval',
    keyword: 'nettoyage Saint-Genis-Laval',
    eyebrow: 'Saint-Genis-Laval',
    h1: 'Entreprise de nettoyage à Saint-Genis-Laval',
    title: 'Nettoyage à Saint-Genis-Laval — MonCleanerPro | Santé, bureaux & résidentiel',
    description: "Entreprise de nettoyage à Saint-Genis-Laval : cabinets et structures de santé, bureaux, copropriétés, commerces et logements de particuliers. Protocoles rigoureux. Devis gratuit sous 24h.",
    intro:
      "Saint-Genis-Laval est marquée par la présence du pôle hospitalier Lyon Sud et de l’écosystème de santé et de recherche qui l’entoure, doublée d’un secteur résidentiel calme et de commerces de proximité. Cela se traduit par une demande forte sur l’entretien de cabinets et de locaux professionnels, où l’exigence d’hygiène et la discrétion priment. MonCleanerPro y intervient pour ces professionnels comme pour les copropriétés et les particuliers de la commune.",
    highlights: [
      { title: 'Cabinets et santé', text: "Points de contact désinfectés à chaque passage, ordre d’intervention strict et matériel différencié par zone." },
      { title: 'Hors consultation', text: "Interventions tôt le matin ou en soirée : aucun croisement avec les patients ni avec vos équipes." },
      { title: 'Résidentiel et copropriétés', text: "Parties communes suivies avec régularité, et prestations ponctuelles chez les particuliers." },
    ],
    includes: [
      'Entretien de cabinets médicaux et paramédicaux',
      'Nettoyage de bureaux et locaux professionnels',
      'Désinfection des points de contact et sanitaires',
      'Parties communes de copropriété',
      'Grand ménage et remise en état de logements',
      'Nettoyage de vitres et de commerces de proximité',
    ],
    faq: [
      { q: 'Entretenez-vous les cabinets près de Lyon Sud ?', a: "Oui, l’entretien de cabinets médicaux et paramédicaux est une part importante de notre activité sur la commune, avec des protocoles adaptés et des passages hors consultation." },
      { q: 'Prenez-vous en charge les déchets de soins ?', a: "Non, les déchets d’activités de soins relèvent d’une filière réglementée et d’un prestataire agréé. Nous gérons uniquement les déchets non médicaux." },
      { q: 'Intervenez-vous aussi chez les particuliers ?', a: "Oui, grand ménage, entretien régulier et remise en état de logements font partie de nos prestations sur Saint-Genis-Laval." },
    ],
    related: ['nettoyage-cabinet-medical-lyon', 'nettoyage-oullins-pierre-benite', 'nettoyage-bureaux-lyon'],
  },

  // ── Déclinaisons communales du cluster « fin de chantier » ────────────────
  {
    slug: 'nettoyage-fin-de-chantier-villeurbanne',
    cluster: 'fin-de-chantier',
    keyword: 'nettoyage fin de chantier Villeurbanne',
    eyebrow: 'Fin de chantier · Villeurbanne',
    h1: 'Nettoyage de fin de chantier à Villeurbanne',
    title: 'Nettoyage fin de chantier à Villeurbanne — MonCleanerPro | Après rénovation',
    description: "Nettoyage de fin de chantier et après travaux à Villeurbanne : appartements rénovés, immeubles anciens, locaux commerciaux. Poussière de plâtre, traces, vitres et finitions. Devis gratuit sous 24h.",
    intro:
      "Villeurbanne rénove beaucoup, et rarement du neuf : appartements des Gratte-Ciel, immeubles d’avant-guerre, copropriétés des années soixante remises au goût du jour pour de la location. Ces chantiers ont une signature — beaucoup de poussière de plâtre, des parquets anciens fragiles, des menuiseries à ne pas abîmer. MonCleanerPro assure le nettoyage de fin de chantier à Villeurbanne avec les gestes que ce bâti demande, pour livrer un logement prêt à louer ou à habiter.",
    highlights: [
      { title: 'Habitué au bâti ancien', text: "Parquets, moulures et menuiseries d’époque nettoyés sans produit agressif ni excès d’eau." },
      { title: 'Poussière de démolition', text: "Ouverture de mur, dépose de cloison : le plâtre se dépose dans tout le volume. On traite les points hauts, pas seulement les sols." },
      { title: 'Pensé pour la mise en location', text: "Beaucoup de nos chantiers villeurbannais visent un état des lieux d’entrée : on cale l’intervention juste avant." },
      { title: 'Intervention rapide', text: "Villeurbanne est limitrophe de nos zones lyonnaises : planification souple, y compris à quelques jours." },
    ],
    includes: [
      'Dépoussiérage complet après démolition ou rénovation',
      'Traitement des parquets et sols anciens sans les gorger d’eau',
      'Menuiseries, moulures, plinthes et radiateurs',
      'Élimination des projections de peinture, plâtre et colle',
      'Vitres, encadrements et rebords, sans traces',
      'Cuisine et sanitaires détaillés avant remise des clés',
    ],
    sections: [
      {
        h2: 'Les chantiers villeurbannais qu’on nous confie',
        list: [
          "Appartements rénovés pour la location, notamment autour de la Doua et des campus",
          "Remises à neuf dans les immeubles anciens des Gratte-Ciel et de Charpennes",
          "Copropriétés en réhabilitation, parties privatives comme parties communes",
          "Locaux commerciaux et bureaux réaménagés avant réouverture",
          "Maisons de ville rénovées à Cusset, Croix-Luizet ou Saint-Jean",
        ],
      },
      {
        h2: 'Pourquoi l’ancien demande une autre approche',
        paragraphs: [
          "Sur un logement neuf, on protège des matériaux qui n’ont jamais servi. Sur un appartement villeurbannais des années trente, on travaille sur des supports qui ont déjà vécu : un parquet qui ne supporte pas l’eau stagnante, des moulures où la poussière de ponçage s’accumule, des menuiseries dont la peinture ancienne part au mauvais produit. Un nettoyage trop énergique fait plus de dégâts qu’il n’en répare.",
          "Nos intervenants adaptent donc les produits et la quantité d’eau au support, et traitent les recoins où la poussière de plâtre se loge — rainures, dessus de portes, gorges de moulures — parce que c’est de là qu’elle redescend une semaine plus tard sur un logement qu’on croyait livré.",
        ],
      },
    ],
    faq: [
      { q: 'Intervenez-vous rapidement à Villeurbanne ?', a: "Oui, la commune est limitrophe de nos zones lyonnaises. Nous planifions facilement des interventions à quelques jours, y compris avant un état des lieux d’entrée." },
      { q: 'Mon parquet ancien risque-t-il quelque chose ?', a: "Non, à condition d’adapter le geste. Nous n’inondons jamais un parquet ancien et utilisons des produits compatibles avec sa finition. C’est un point que nous vérifions systématiquement avant de commencer." },
      { q: 'Faites-vous les parties communes après des travaux d’immeuble ?', a: "Oui, halls, cages d’escalier et paliers après ravalement ou réfection font partie de nos prestations, pour les syndics comme pour les copropriétés en gestion bénévole." },
      { q: 'Pouvez-vous intervenir avant une mise en location ?', a: "C’est le cas le plus fréquent à Villeurbanne. Indiquez-nous la date de l’état des lieux et nous calons l’intervention juste avant." },
    ],
    related: ['nettoyage-fin-de-chantier-lyon', 'nettoyage-apres-travaux-lyon', 'prix-nettoyage-fin-de-chantier-lyon'],
    relatedPosts: ['poussiere-de-chantier-eliminer', 'etapes-nettoyage-fin-de-chantier'],
  },
  {
    slug: 'nettoyage-fin-de-chantier-venissieux',
    cluster: 'fin-de-chantier',
    keyword: 'nettoyage fin de chantier Vénissieux',
    eyebrow: 'Fin de chantier · Vénissieux',
    h1: 'Nettoyage de fin de chantier à Vénissieux',
    title: 'Nettoyage fin de chantier à Vénissieux — MonCleanerPro | Logements & locaux',
    description: "Nettoyage de fin de chantier à Vénissieux : réhabilitation de logements, locaux d’activité, commerces et bureaux réaménagés. Interventions multi-lots, équipe formée. Devis gratuit sous 24h.",
    intro:
      "À Vénissieux, les chantiers se comptent rarement à l’unité. Réhabilitation d’une cage entière pour un bailleur, réaménagement d’un local d’activité, remise en état de plusieurs logements avant relocation : ce sont des opérations où le nettoyage doit suivre un planning de livraison, lot par lot. MonCleanerPro organise la remise en état de fin de chantier à Vénissieux avec les moyens que ces volumes demandent, sans perdre le niveau de finition attendu sur chaque logement pris séparément.",
    highlights: [
      { title: 'Plusieurs lots, un planning', text: "Nous livrons les logements au rythme de votre calendrier de remise, pas tous en même temps au dernier moment." },
      { title: 'Interlocuteur unique', text: "Un seul contact pour l’ensemble de l’opération, même quand les lots s’étalent sur plusieurs semaines." },
      { title: 'Locaux d’activité', text: "Ateliers, entrepôts légers et bureaux réaménagés : surfaces importantes traitées hors horaires d’exploitation." },
      { title: 'Traçabilité', text: "Chaque lot livré fait l’objet d’un rapport d’intervention, utile pour les bailleurs et les maîtres d’ouvrage." },
    ],
    includes: [
      'Remise en état de logements après réhabilitation',
      'Nettoyage de locaux d’activité et de bureaux réaménagés',
      'Dépoussiérage complet et élimination des résidus de travaux',
      'Vitres, encadrements et surfaces vitrées',
      'Sanitaires et cuisines détaillés avant remise',
      'Parties communes après travaux d’immeuble',
    ],
    sections: [
      {
        h2: 'Livrer plusieurs lots sans perdre en qualité',
        paragraphs: [
          "Le risque, sur une opération en volume, est connu : les premiers logements sont impeccables, les derniers sont bâclés parce que la date de livraison approche. Nous l’évitons en calant le nombre d’intervenants sur le planning réel, et en appliquant la même check-list de contrôle sur le dernier lot que sur le premier.",
          "Concrètement, chaque logement est contrôlé pièce par pièce avant d’être déclaré livré, et le rapport d’intervention associé vous permet de savoir ce qui a été fait, où et quand. C’est ce qui rend la prestation défendable devant un maître d’ouvrage ou un conseil syndical.",
        ],
      },
      {
        h2: 'Nos interventions à Vénissieux',
        list: [
          "Réhabilitation de logements pour bailleurs sociaux et privés",
          "Remise en état avant relocation, lot par lot",
          "Locaux d’activité et ateliers après réaménagement",
          "Bureaux et surfaces tertiaires rouvrant après travaux",
          "Commerces et surfaces de vente avant réouverture",
          "Parties communes après ravalement ou réfection de cage",
        ],
      },
    ],
    faq: [
      { q: 'Pouvez-vous traiter plusieurs logements sur une même opération ?', a: "Oui, c’est notre cas d’usage courant à Vénissieux. Nous adaptons le nombre d’intervenants au planning de livraison et vous livrons les lots au fur et à mesure." },
      { q: 'Intervenez-vous en dehors des heures d’exploitation ?', a: "Oui, pour les locaux d’activité et les bureaux nous intervenons tôt le matin, en soirée ou le week-end afin de ne pas bloquer votre activité." },
      { q: 'Fournissez-vous un suivi pour le maître d’ouvrage ?', a: "Chaque intervention donne lieu à un rapport, lot par lot. C’est ce qui permet de justifier précisément ce qui a été livré et à quelle date." },
      { q: 'Gérez-vous les grandes surfaces vitrées ?', a: "Oui, les surfaces vitrées accessibles en sécurité sont traitées sans traces. Pour les grandes hauteurs nécessitant du matériel spécifique, nous vous orientons vers la solution adaptée." },
    ],
    related: ['nettoyage-fin-de-chantier-lyon', 'nettoyage-venissieux', 'prix-nettoyage-fin-de-chantier-lyon'],
    relatedPosts: ['etapes-nettoyage-fin-de-chantier'],
  },
  {
    slug: 'nettoyage-fin-de-chantier-saint-priest',
    cluster: 'fin-de-chantier',
    keyword: 'nettoyage fin de chantier Saint-Priest',
    eyebrow: 'Fin de chantier · Saint-Priest',
    h1: 'Nettoyage de fin de chantier à Saint-Priest',
    title: 'Nettoyage fin de chantier à Saint-Priest — MonCleanerPro | Neuf & tertiaire',
    description: "Nettoyage de fin de chantier à Saint-Priest : livraisons de programmes neufs, bureaux et locaux d’activité, commerces. Remise en état avant réception. Devis gratuit sous 24h.",
    intro:
      "Saint-Priest construit et livre : programmes neufs, plateaux de bureaux, locaux d’activité du parc technologique et de la zone logistique. Sur ces chantiers, le nettoyage n’est pas une finition optionnelle — c’est l’étape qui conditionne la réception. Un lot livré avec des étiquettes de vitrage encore en place ou un voile de ciment au sol génère des réserves, et les réserves coûtent du temps à tout le monde. MonCleanerPro assure la remise en état de fin de chantier à Saint-Priest en visant précisément ce qui est regardé le jour de la livraison.",
    highlights: [
      { title: 'Calé sur la réception', text: "Nous intervenons juste avant la visite de livraison, pour que le lot soit vu dans son état définitif." },
      { title: 'Le neuf a ses pièges', text: "Films de protection, étiquettes, voile de ciment, silicone frais : autant de points qui déclenchent des réserves s’ils sont oubliés." },
      { title: 'Volumes tertiaires', text: "Plateaux de bureaux et locaux d’activité de grande surface, traités avec les effectifs nécessaires." },
      { title: 'Multi-sites', text: "Plusieurs bâtiments ou plusieurs lots sur une même opération, avec un planning coordonné." },
    ],
    includes: [
      'Retrait des films de protection, étiquettes et adhésifs',
      'Élimination du voile de ciment et des résidus de pose',
      'Dépoussiérage complet, faux plafonds et points hauts compris',
      'Vitrages, châssis et menuiseries alu nettoyés sans traces',
      'Sanitaires, kitchenettes et locaux techniques',
      'Sols traités selon le revêtement posé (carrelage, résine, moquette)',
    ],
    sections: [
      {
        h2: 'Livrer sans réserves de propreté',
        paragraphs: [
          "Sur une réception de programme neuf, les réserves liées à la propreté sont les plus faciles à éviter et pourtant les plus fréquentes. Elles portent presque toujours sur les mêmes points : une étiquette de vitrage laissée en place, un voile blanchâtre sur un carrelage neuf, des traces de silicone sur un plan de travail, de la poussière de découpe restée dans les rails de placard ou sur les grilles de ventilation.",
          "Nous construisons notre passage autour de cette liste. L’objectif n’est pas de « faire propre » au sens général, mais de neutraliser précisément ce que le maître d’ouvrage, l’acquéreur ou le preneur va regarder en premier lors de la visite.",
        ],
      },
      {
        h2: 'Types de chantiers traités à Saint-Priest',
        list: [
          "Livraisons de logements neufs, lot par lot ou bâtiment entier",
          "Plateaux de bureaux avant prise de possession par le preneur",
          "Locaux d’activité et bâtiments logistiques du secteur",
          "Commerces et surfaces de vente avant ouverture",
          "Réaménagements de bureaux en site occupé, hors horaires",
        ],
      },
    ],
    faq: [
      { q: 'Intervenez-vous avant la visite de réception ?', a: "Oui, c’est le moment optimal. Nous calons l’intervention au plus près de la livraison pour que le lot soit vu dans son état définitif, sans nouvelle salissure entre-temps." },
      { q: 'Retirez-vous les films de protection et les étiquettes ?', a: "Oui, c’est une part importante du travail sur du neuf : films sur les menuiseries, étiquettes de vitrage, adhésifs et protections de sol sont retirés sans marquer les supports." },
      { q: 'Pouvez-vous traiter de grandes surfaces tertiaires ?', a: "Oui, nous dimensionnons l’équipe selon la surface et le délai. Les plateaux de bureaux et locaux d’activité de Saint-Priest font partie de nos interventions régulières." },
      { q: 'Travaillez-vous pour les promoteurs et entreprises générales ?', a: "Oui, en prestation ponctuelle comme en partenariat sur plusieurs opérations, avec un interlocuteur dédié et un planning coordonné." },
    ],
    related: ['nettoyage-fin-de-chantier-lyon', 'nettoyage-saint-priest', 'prix-nettoyage-fin-de-chantier-lyon'],
    relatedPosts: ['etapes-nettoyage-fin-de-chantier', 'difference-fin-de-chantier-apres-travaux'],
  },
  {
    slug: 'nettoyage-fin-de-chantier-villefranche-sur-saone',
    cluster: 'fin-de-chantier',
    keyword: 'nettoyage fin de chantier Villefranche-sur-Saône',
    eyebrow: 'Fin de chantier · Villefranche-sur-Saône',
    h1: 'Nettoyage de fin de chantier à Villefranche-sur-Saône',
    title: 'Nettoyage fin de chantier à Villefranche-sur-Saône — MonCleanerPro | Beaujolais',
    description: "Nettoyage de fin de chantier à Villefranche-sur-Saône et dans le Beaujolais : maisons rénovées, bâti ancien en pierre, extensions, commerces. Finitions avant emménagement. Devis gratuit sous 24h.",
    intro:
      "Autour de Villefranche-sur-Saône, les chantiers ressemblent peu à ceux de la métropole : plus de maisons individuelles que d’appartements, beaucoup de bâti ancien en pierre, des extensions et des rénovations qui s’étalent dans le temps. Le nettoyage de fin de chantier y demande donc de la souplesse sur les dates et une bonne connaissance des matériaux anciens. MonCleanerPro intervient à Villefranche et dans les communes du Beaujolais pour rendre ces biens habitables et présentables une fois les travaux terminés.",
    highlights: [
      { title: 'Maisons et bâti ancien', text: "Pierre, tomettes, poutres et sols anciens : des supports qui ne se nettoient pas comme du carrelage neuf." },
      { title: 'Surfaces importantes', text: "Une maison rénovée représente souvent plus de volume qu’un appartement — nous dimensionnons l’équipe en conséquence." },
      { title: 'Souplesse sur les dates', text: "Les chantiers de rénovation en maison glissent souvent : nous ajustons plutôt que d’annuler." },
      { title: 'Extérieurs compris', text: "Terrasse, abords et menuiseries extérieures salis par les travaux peuvent être inclus dans la prestation." },
    ],
    includes: [
      'Dépoussiérage complet après rénovation ou extension',
      'Traitement adapté des sols anciens (tomettes, pierre, parquet)',
      'Poutres, menuiseries et points hauts dépoussiérés',
      'Élimination des projections de peinture, enduit et colle',
      'Vitres, baies et menuiseries extérieures',
      'Cuisine et sanitaires détaillés avant emménagement',
      'Abords et terrasse salis par le chantier, sur demande',
    ],
    sections: [
      {
        h2: 'Rénover une maison ancienne : ce que ça change au nettoyage',
        paragraphs: [
          "Une rénovation en bâti ancien produit une poussière particulière : mélange d’enduit à la chaux, de plâtre et de poussière de pierre, souvent en grande quantité parce que les volumes sont plus importants et les chantiers plus longs. Elle se dépose sur les poutres, dans les joints de tomettes et sur des surfaces irrégulières où un simple passage ne suffit pas.",
          "Les supports, eux, sont sensibles. Une tomette se ternit à l’eau savonneuse mal rincée, une pierre absorbe les produits acides, une poutre ne se lave pas. Nous adaptons donc le geste au matériau plutôt que d’appliquer une méthode unique — c’est ce qui fait la différence entre un bien remis en valeur et un bien abîmé par son propre nettoyage.",
        ],
      },
      {
        h2: 'Nos interventions à Villefranche et dans le Beaujolais',
        list: [
          "Maisons individuelles après rénovation complète ou partielle",
          "Extensions et surélévations livrées avant emménagement",
          "Bâti ancien en pierre remis en état, en centre-ville comme en village",
          "Appartements rénovés avant location ou vente",
          "Commerces et locaux professionnels avant réouverture",
          "Biens remis en état avant une mise en vente ou des photos",
        ],
      },
    ],
    faq: [
      { q: 'Couvrez-vous les communes autour de Villefranche ?', a: "Oui, nous intervenons à Villefranche-sur-Saône et dans les communes voisines du Beaujolais, en plus de Lyon et de la métropole." },
      { q: 'Comment nettoyez-vous des tomettes ou de la pierre ?', a: "Avec des produits neutres, peu d’eau et un rinçage soigné. Ces supports absorbent : un produit inadapté laisse un voile ou une auréole difficile à rattraper. Nous vérifions toujours la nature du sol avant de commencer." },
      { q: 'Mon chantier a pris du retard, pouvez-vous décaler ?', a: "Oui. Les rénovations en maison glissent souvent de quelques jours ou semaines : prévenez-nous et nous replanifions plutôt que d’intervenir sur un chantier qui n’est pas prêt." },
      { q: 'Nettoyez-vous aussi la terrasse et les abords ?', a: "Sur demande, oui. Les abords immédiats et la terrasse salis par le passage des artisans peuvent être inclus : précisez-le lors de l’estimation." },
    ],
    related: ['nettoyage-fin-de-chantier-lyon', 'nettoyage-villefranche-sur-saone', 'prix-nettoyage-fin-de-chantier-lyon'],
    relatedPosts: ['poussiere-de-chantier-eliminer', 'etapes-nettoyage-fin-de-chantier'],
  },
];

export const SEO_SLUGS = SEO_PAGES.map(p => p.slug);
export const getSeoPage = (slug: string) => SEO_PAGES.find(p => p.slug === slug);

// Zone desservie (géo) par page VILLE : nom de la commune + coordonnées. Sert aux
// données structurées (schema.org areaServed + geo) — signal local fort pour Google.
// Les pages « service » (non listées ici) desservent Lyon par défaut.
export interface CityGeo { city: string; lat: number; lng: number; postalCode?: string }
export const CITY_GEO: Record<string, CityGeo> = {
  'nettoyage-villefranche-sur-saone': { city: 'Villefranche-sur-Saône', lat: 45.9847, lng: 4.7267, postalCode: '69400' },
  'nettoyage-caluire-et-cuire':       { city: 'Caluire-et-Cuire',       lat: 45.7955, lng: 4.8442, postalCode: '69300' },
  'nettoyage-venissieux':             { city: 'Vénissieux',             lat: 45.6976, lng: 4.8859, postalCode: '69200' },
  'nettoyage-neuville-sur-saone':     { city: 'Neuville-sur-Saône',     lat: 45.8779, lng: 4.8419, postalCode: '69250' },
  'nettoyage-bron':                   { city: 'Bron',                   lat: 45.7333, lng: 4.9110, postalCode: '69500' },
  'nettoyage-saint-priest':           { city: 'Saint-Priest',           lat: 45.6966, lng: 4.9439, postalCode: '69800' },
  'nettoyage-ecully':                 { city: 'Écully',                 lat: 45.7743, lng: 4.7787, postalCode: '69130' },
  'nettoyage-tassin-la-demi-lune':    { city: 'Tassin-la-Demi-Lune',    lat: 45.7644, lng: 4.7717, postalCode: '69160' },
  'nettoyage-rillieux-la-pape':       { city: 'Rillieux-la-Pape',       lat: 45.8217, lng: 4.8983, postalCode: '69140' },
  'nettoyage-villeurbanne':           { city: 'Villeurbanne',           lat: 45.7667, lng: 4.8800, postalCode: '69100' },
  'nettoyage-oullins-pierre-benite':  { city: 'Oullins-Pierre-Bénite',  lat: 45.7141, lng: 4.8078, postalCode: '69600' },
  'nettoyage-vaulx-en-velin':         { city: 'Vaulx-en-Velin',         lat: 45.7768, lng: 4.9186, postalCode: '69120' },
  'nettoyage-meyzieu':                { city: 'Meyzieu',                lat: 45.7681, lng: 5.0031, postalCode: '69330' },
  'nettoyage-decines-charpieu':       { city: 'Décines-Charpieu',       lat: 45.7692, lng: 4.9603, postalCode: '69150' },
  'nettoyage-sainte-foy-les-lyon':    { city: 'Sainte-Foy-lès-Lyon',    lat: 45.7369, lng: 4.8003, postalCode: '69110' },
  'nettoyage-saint-genis-laval':      { city: 'Saint-Genis-Laval',      lat: 45.6953, lng: 4.7936, postalCode: '69230' },

  // Pages « fin de chantier × commune » : même logique géo, ancrée sur la commune
  // visée, pour que chaque page porte un signal local propre.
  'nettoyage-fin-de-chantier-villeurbanne':            { city: 'Villeurbanne',            lat: 45.7667, lng: 4.8800, postalCode: '69100' },
  'nettoyage-fin-de-chantier-venissieux':              { city: 'Vénissieux',              lat: 45.6976, lng: 4.8859, postalCode: '69200' },
  'nettoyage-fin-de-chantier-saint-priest':            { city: 'Saint-Priest',            lat: 45.6966, lng: 4.9439, postalCode: '69800' },
  'nettoyage-fin-de-chantier-villefranche-sur-saone':  { city: 'Villefranche-sur-Saône',  lat: 45.9847, lng: 4.7267, postalCode: '69400' },
};
export const getCityGeo = (slug: string): CityGeo | undefined => CITY_GEO[slug];

// Liste des communes desservies (villes ciblées) — pour l'accueil (areaServed global).
// Dédupliquée : plusieurs slugs peuvent viser la même commune (ex. une page ville
// généraliste + sa déclinaison « fin de chantier »).
export const SERVED_CITIES = Array.from(new Set(['Lyon', ...Object.values(CITY_GEO).map(c => c.city)]));

// Pages d'un même cluster thématique (maillage interne ciblé).
export const getCluster = (name: string) => SEO_PAGES.filter(p => p.cluster === name);
