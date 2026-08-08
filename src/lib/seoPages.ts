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
  // ── PAGE PILIER du cluster « Airbnb / courte durée » ──────────────────────
  {
    slug: 'menage-airbnb-lyon',
    cluster: 'airbnb',
    keyword: 'ménage Airbnb Lyon',
    eyebrow: 'Airbnb & courte durée',
    h1: 'Ménage Airbnb à Lyon',
    title: 'Ménage Airbnb à Lyon — MonCleanerPro | Entre voyageurs, linge & calendrier synchronisé',
    description: "Ménage Airbnb à Lyon entre deux voyageurs : remise en état dans la fenêtre départ/arrivée, gestion du linge, réassort, rapport photo. Calendrier synchronisé, multi-logements. Devis gratuit sous 24h.",
    intro:
      "En location courte durée, tout se joue dans une fenêtre de quelques heures : le voyageur part à 11h, le suivant arrive à 15h, et entre les deux le logement doit être remis à neuf — sans exception, y compris le dimanche et en pleine saison. C’est cette contrainte, plus que le ménage lui-même, qui fait la différence entre un hôte tranquille et un hôte qui court. MonCleanerPro assure le ménage Airbnb à Lyon pour les propriétaires et les conciergeries : intervention calée sur votre calendrier de réservations, linge changé, logement remis en scène et rapport envoyé une fois la porte refermée.",
    highlights: [
      { title: 'Dans la fenêtre départ / arrivée', text: "Nous intervenons entre le check-out et le check-in, pas « dans la journée ». C’est la seule façon de tenir des réservations qui s’enchaînent." },
      { title: 'Calendrier synchronisé', text: "Nous branchons votre calendrier iCal Airbnb ou Booking : les ménages se créent à partir de vos réservations réelles, sans que vous ayez à nous écrire à chaque fois." },
      { title: 'Linge et consommables', text: "Draps et serviettes changés à chaque départ, réassort du papier, du savon et des petits consommables selon le stock convenu." },
      { title: 'Rapport après chaque passage', text: "Dégâts, objets oubliés, consommables à recharger : vous recevez un compte rendu, photos à l’appui, avant l’arrivée suivante." },
      { title: 'Remise en scène', text: "Le logement n’est pas seulement propre, il est présenté : linge plié, décoration replacée, aération. C’est ce que le voyageur voit en entrant." },
      { title: 'Multi-logements', text: "Un logement ou trente : plannings coordonnés, intervenants attitrés quand c’est possible, un seul interlocuteur pour l’ensemble." },
    ],
    includes: [
      'Remise en état complète entre deux voyageurs',
      'Changement des draps, housses et linge de toilette',
      'Salle de bains détartrée, désinfectée, miroirs et robinetterie sans traces',
      'Cuisine dégraissée, réfrigérateur vidé et contrôlé, vaisselle vérifiée',
      'Sols aspirés puis lavés, surfaces et points de contact désinfectés',
      'Réassort des consommables (papier, savon, sacs, éponges) selon votre stock',
      'Mise en scène d’accueil : linge plié, décoration replacée, logement aéré',
      'Signalement des dégâts, objets oubliés et équipements défectueux',
      'Rapport d’intervention avec photos, envoyé après chaque passage',
    ],
    sections: [
      {
        h2: 'Le vrai sujet, ce n’est pas le ménage — c’est le créneau',
        paragraphs: [
          "Un logement en courte durée n’a pas besoin d’un ménage plus long qu’un autre. Il a besoin d’un ménage qui tombe au bon moment. Départ à 11h, arrivée à 15h : la fenêtre utile est de trois à quatre heures, et elle n’est pas négociable. Un prestataire qui promet de passer « dans l’après-midi » ne peut pas tenir un enchaînement de réservations — c’est la raison numéro un pour laquelle les hôtes changent de prestataire.",
          "Nous construisons donc le planning à l’envers : à partir de vos arrivées, pas de nos disponibilités. Quand plusieurs de vos logements tournent le même jour — le samedi, typiquement — les passages sont ordonnancés par proximité géographique pour que les déplacements ne mangent pas le temps de ménage. Et si une réservation se prolonge ou s’annule la veille, le ménage est décalé ou annulé sans que vous ayez à gérer un aller-retour de messages.",
        ],
      },
      {
        h2: 'Votre calendrier de réservations pilote nos interventions',
        paragraphs: [
          "La plupart des hôtes perdent un temps considérable à recopier leurs réservations vers leur femme de ménage. Nous supprimons cette étape : vous nous transmettez le lien iCal de votre annonce Airbnb, Booking ou de votre PMS, et les ménages sont générés automatiquement à partir des départs réels.",
          "Concrètement, une réservation ajoutée ou modifiée sur la plateforme se répercute sur le planning sans intervention de votre part. Vous gardez la main pour ajuster un horaire, ajouter une demande particulière ou bloquer une date — mais vous n’avez plus à surveiller si le ménage a bien été noté quelque part.",
        ],
      },
      {
        h2: 'La propreté est une note, pas une impression',
        paragraphs: [
          "Sur Airbnb, la propreté est notée séparément des autres critères, et c’est celui qui descend le plus vite. Un cheveu dans la douche ou une plaque de cuisson grasse suffit à déclencher un commentaire — et un commentaire sur la propreté pèse longtemps sur une annonce, bien après que le problème a été corrigé. À l’inverse, un logement irréprochable est rarement commenté en tant que tel : il se traduit simplement par une note haute et des réservations qui continuent.",
          "Nos intervenants travaillent sur check-list, pièce par pièce, avec les mêmes points de contrôle à chaque passage. Ce ne sont pas les grandes surfaces qui font la note, ce sont les détails que le voyageur inspecte en arrivant : l’intérieur du micro-ondes, le joint de douche, le dessous du couvercle des WC, le fond du réfrigérateur, l’état des serviettes.",
        ],
      },
      {
        h2: 'Le linge : le point qui fait dérailler les plannings',
        paragraphs: [
          "Laver le linge sur place entre deux voyageurs est mathématiquement impossible : un cycle machine plus un séchage dépassent la fenêtre disponible. C’est pourtant l’organisation la plus répandue chez les hôtes qui débutent, et c’est ce qui provoque les retards de check-in.",
          "La seule méthode qui tient sur la durée est le stock de rotation : deux à trois parures complètes par lit, autant de jeux de serviettes, de sorte qu’il y ait toujours du linge propre disponible pendant que le reste est en traitement. Nous changeons le linge à chaque départ et récupérons le sale ; selon votre fonctionnement, le lavage est assuré par vos soins, par une blanchisserie, ou organisé avec vous. Nous vous disons ce qu’il manque pour que la rotation tienne, plutôt que de subir la pénurie un samedi de forte affluence.",
        ],
      },
      {
        h2: 'Ce que vous recevez après chaque passage',
        paragraphs: [
          "Un hôte qui n’habite pas Lyon, ou qui gère plusieurs biens, a besoin de savoir ce qui s’est passé chez lui sans avoir à demander. Après chaque intervention, vous recevez un rapport : ce qui a été fait, l’état constaté à l’arrivée de notre intervenant, et les points qui appellent une décision de votre part.",
        ],
        list: [
          "Dégâts et casse constatés, avec photos — utile pour une réclamation auprès de la plateforme, qui exige des preuves datées",
          "Objets oubliés par le voyageur précédent, mis de côté et signalés",
          "Consommables à recharger avant que le stock ne soit épuisé",
          "Équipements défectueux repérés (ampoule, robinet qui fuit, télécommande sans piles)",
          "Usure du linge et de la vaisselle, pour anticiper les remplacements",
        ],
      },
      {
        h2: 'Propriétaire indépendant ou conciergerie : deux fonctionnements',
        paragraphs: [
          "Si vous gérez vous-même un ou deux logements, nous devenons simplement votre prestataire ménage : vous nous donnez accès au calendrier et au logement, nous nous occupons du reste. C’est le cas le plus fréquent chez les propriétaires lyonnais qui louent un appartement en complément de revenu.",
          "Si vous êtes une conciergerie, le fonctionnement change : vous avez besoin de volume, d’un planning consolidé sur l’ensemble de votre parc et d’une traçabilité que vous pouvez montrer à vos propres clients. Nous travaillons dans ce cadre en sous-traitance, avec un espace dédié où vous suivez vos logements et vos rapports. Nous ne sommes pas une conciergerie et ne démarchons pas vos propriétaires : nous sommes le prestataire ménage derrière votre marque.",
        ],
      },
    ],
    faq: [
      { q: 'Pouvez-vous intervenir entre un départ à 11h et une arrivée à 15h ?', a: "Oui, c’est le cadre normal de notre organisation en courte durée. Nous calons les passages sur vos horaires réels de check-out et de check-in. Si la fenêtre est particulièrement serrée ou si le logement est grand, nous prévoyons deux intervenants plutôt que de faire déborder l’arrivée." },
      { q: 'Comment savez-vous quand un logement se libère ?', a: "Nous branchons le lien iCal de votre annonce Airbnb, Booking ou de votre PMS : les ménages sont générés à partir de vos réservations réelles et se mettent à jour tout seuls. Vous n’avez plus à nous transmettre votre planning chaque semaine." },
      { q: 'Intervenez-vous le week-end et les jours fériés ?', a: "Oui. En courte durée, le samedi et le dimanche sont les jours de rotation les plus chargés : une organisation qui s’arrête le vendredi soir n’a aucun intérêt pour un hôte." },
      { q: 'Fournissez-vous le linge ?', a: "Nous assurons le changement du linge à chaque départ et récupérons le linge sale. La fourniture et le lavage s’organisent selon votre fonctionnement — stock qui vous appartient, blanchisserie, ou solution que nous cadrons ensemble. L’essentiel est d’avoir assez de parures en rotation pour ne jamais bloquer une arrivée." },
      { q: 'Comment accédez-vous au logement ?', a: "Boîte à clés, serrure connectée, clés confiées ou remise par un voisin : nous nous adaptons à ce qui existe déjà. Pour les biens que nous traitons régulièrement, une solution en autonomie est préférable — elle évite qu’un imprévu d’accès bloque toute la rotation de la journée." },
      { q: 'Que se passe-t-il si le voyageur laisse le logement dans un état anormal ?', a: "Nous documentons immédiatement l’état constaté avec des photos horodatées et vous prévenons avant l’arrivée suivante. C’est ce qui vous permet d’ouvrir une réclamation auprès de la plateforme, qui demande systématiquement des preuves. Si le temps nécessaire dépasse largement une remise en état standard, nous vous le signalons avant d’engager le supplément." },
      { q: 'Gérez-vous plusieurs logements pour une conciergerie ?', a: "Oui, c’est une part importante de notre activité. Plannings consolidés, intervenants attitrés quand c’est possible, rapports par logement et interlocuteur unique. Nous intervenons en sous-traitance, derrière votre marque, sans contact commercial avec vos propriétaires." },
      { q: 'Quels quartiers et communes couvrez-vous ?', a: "L’ensemble de Lyon et de la métropole, ainsi que le Beaujolais — Villefranche-sur-Saône, Anse et les communes des Pierres Dorées, où la location saisonnière est très présente." },
    ],
    related: [
      'menage-conciergerie-lyon',
      'menage-location-courte-duree-lyon',
      'prix-menage-airbnb-lyon',
      'menage-airbnb-villefranche-sur-saone',
      'menage-airbnb-anse',
      'nettoyage-hotel-lyon',
    ],
    relatedPosts: [
      'checklist-menage-airbnb-entre-voyageurs',
      'menage-airbnb-creneau-entre-deux-voyageurs',
      'linge-location-courte-duree',
    ],
    updatedAt: '2026-08-08',
  },
  {
    slug: 'menage-conciergerie-lyon',
    cluster: 'airbnb',
    keyword: 'ménage pour conciergerie Lyon',
    eyebrow: 'Conciergeries',
    h1: 'Prestataire ménage pour conciergerie à Lyon',
    title: 'Ménage pour conciergerie à Lyon — MonCleanerPro | Sous-traitance courte durée',
    description: "Prestataire de ménage pour conciergeries Airbnb à Lyon : sous-traitance des rotations, planning consolidé multi-logements, rapports photo par bien. Nous intervenons derrière votre marque. Devis sous 24h.",
    intro:
      "Une conciergerie ne se casse pas sur la relation propriétaire ni sur les annonces : elle se casse sur l’exécution du samedi, quand douze logements tournent en même temps et qu’un intervenant manque à l’appel. MonCleanerPro est le prestataire ménage qui absorbe cette charge à Lyon. Nous ne gérons pas d’annonces, nous ne parlons pas à vos propriétaires : nous assurons les rotations, avec les effectifs, le planning et la traçabilité qu’un parc en croissance exige.",
    highlights: [
      { title: 'Nous restons à notre place', text: "Nous sommes prestataire, pas concurrent. Aucun contact commercial avec vos propriétaires, aucune sollicitation : votre parc reste le vôtre." },
      { title: 'Le samedi tient debout', text: "Le jour de rotation le plus dense est dimensionné à l’avance, avec des effectifs prévus et une tournée ordonnancée par proximité." },
      { title: 'Un planning pour tout le parc', text: "Vos logements sont consolidés dans une même vue : ce qui est fait, ce qui reste, ce qui a dérapé — sans reconstituer l’information logement par logement." },
      { title: 'Traçabilité présentable', text: "Chaque passage produit un rapport photo daté, que vous pouvez transmettre tel quel à votre propriétaire en cas de litige." },
      { title: 'Absorption des pics', text: "Congés, week-ends prolongés, événements lyonnais : nous montons en charge sans vous demander de trouver une solution de secours." },
      { title: 'Un seul interlocuteur', text: "Un contact dédié pour l’ensemble du contrat, qui connaît vos logements et vos exigences — pas un standard différent à chaque appel." },
    ],
    includes: [
      'Rotations entre voyageurs sur l’ensemble de votre parc',
      'Planning consolidé multi-logements, alimenté par vos calendriers',
      'Changement du linge et récupération du linge sale',
      'Réassort des consommables selon le stock défini par logement',
      'Rapport photo daté par intervention, exploitable en litige',
      'Signalement des dégâts, objets oubliés et équipements défectueux',
      'Remises en état renforcées après séjour difficile',
      'Interventions de rattrapage en urgence sur demande',
    ],
    sections: [
      {
        h2: 'Ce qui fait tomber une conciergerie, c’est l’exécution',
        paragraphs: [
          "Le modèle de la conciergerie est simple sur le papier : capter des propriétaires, gérer les annonces, prendre une commission. Ce qui est difficile, c’est le jour où quinze logements se libèrent avant midi et doivent être prêts à quinze heures. Ce jour-là, la conciergerie ne vend plus un service de gestion, elle vend une capacité opérationnelle — et c’est là que les modèles reposant sur des indépendants recrutés au coup par coup atteignent leur limite.",
          "Le symptôme habituel arrive vite : un intervenant qui ne confirme pas, un remplacement trouvé en catastrophe, un logement livré en retard, un voyageur qui attend dans la rue et un propriétaire qui appelle. Une fois, c’est un incident. Trois fois, c’est un mandat perdu. Externaliser la partie ménage auprès d’un prestataire structuré, c’est transformer un aléa humain permanent en engagement contractuel.",
        ],
      },
      {
        h2: 'Comment nous nous intégrons à votre fonctionnement',
        list: [
          "Cadrage du parc : par logement, on fixe la durée type, le stock de linge, les consommables, les particularités d’accès et le niveau d’exigence attendu.",
          "Raccordement des calendriers : vos liens iCal (Airbnb, Booking, PMS) alimentent directement le planning des ménages. Aucune ressaisie.",
          "Intervenants attitrés : sur les logements réguliers, nous cherchons la stabilité — un intervenant qui connaît un appartement va plus vite et voit ce qui a changé.",
          "Rapports : chaque passage produit un compte rendu photo daté, accessible logement par logement.",
          "Point de suivi : sur les parcs importants, un point régulier permet d’ajuster les durées, les stocks et les niveaux de service.",
        ],
      },
      {
        h2: 'La traçabilité, votre meilleure protection',
        paragraphs: [
          "Dans la relation avec un propriétaire, la parole ne suffit pas. « Le logement était propre en partant » et « il ne l’était pas en arrivant » se valent tant que personne n’a de preuve. Un rapport photo daté, produit systématiquement et non à la demande, met fin à ce type de discussion en trente secondes.",
          "Le même mécanisme joue face aux plateformes. Une réclamation pour dégradation n’aboutit que si elle est documentée rapidement, avec des images horodatées prises avant toute remise en état. Nos intervenants ont pour consigne de photographier avant d’intervenir dès qu’un état anormal est constaté — c’est précisément le moment où la preuve existe encore.",
        ],
      },
      {
        h2: 'Nous ne sommes pas une conciergerie',
        paragraphs: [
          "C’est une question posée systématiquement, et la réponse compte : nous n’exerçons pas votre métier. Nous ne créons pas d’annonces, ne fixons pas de tarifs de nuitée, ne gérons pas la relation voyageur et n’avons aucun intérêt à connaître vos propriétaires. Notre activité est le nettoyage professionnel — hôtellerie, tertiaire, courte durée.",
          "C’est ce qui rend la sous-traitance saine : vous confiez l’exécution à un prestataire dont le modèle économique ne consiste pas, un jour, à récupérer vos mandats. Plusieurs conciergeries lyonnaises travaillent avec nous sur cette base.",
        ],
      },
    ],
    faq: [
      { q: 'Travaillez-vous en sous-traitance sous notre marque ?', a: "Oui. Nos intervenants exécutent la prestation, vous conservez la relation client. Nous n’apparaissons pas auprès de vos propriétaires si vous ne le souhaitez pas, et nous ne les sollicitons en aucun cas." },
      { q: 'Combien de logements pouvez-vous absorber ?', a: "Cela dépend de la densité géographique et des créneaux, plus que du nombre brut. Un parc concentré sur quelques quartiers lyonnais se traite bien mieux qu’un parc éclaté sur toute la métropole. Nous cadrons la capacité réelle lors de l’étude de votre parc, et nous préférons refuser un volume que nous ne tiendrions pas." },
      { q: 'Que se passe-t-il si un intervenant est absent ?', a: "C’est notre problème, pas le vôtre — c’est l’intérêt d’externaliser. Le remplacement est organisé en interne, et vous êtes informé si l’horaire prévu doit bouger. Vous n’avez pas à chercher une solution de secours." },
      { q: 'Pouvez-vous reprendre un parc en cours d’année ?', a: "Oui. La reprise se fait par vagues plutôt que d’un bloc : on démarre sur un échantillon de logements pour caler les durées et les attentes réelles, puis on étend. C’est plus sûr qu’un basculement complet en pleine saison." },
      { q: 'Fournissez-vous les produits et le matériel ?', a: "Oui, nos intervenants viennent équipés. Pour les logements disposant déjà d’un stock sur place, nous utilisons ce qui est prévu par le propriétaire et signalons ce qui doit être racheté." },
      { q: 'Comment sont facturées les prestations ?', a: "Sur une base contractuelle définie par type de logement et de rotation, avec une facturation consolidée pour l’ensemble du parc. Les remises en état exceptionnelles sont signalées avant d’être engagées, jamais découvertes sur la facture." },
    ],
    related: ['menage-airbnb-lyon', 'menage-location-courte-duree-lyon', 'prix-menage-airbnb-lyon', 'nettoyage-hotel-lyon'],
    relatedPosts: ['menage-airbnb-creneau-entre-deux-voyageurs', 'linge-location-courte-duree'],
    updatedAt: '2026-08-08',
  },
  {
    slug: 'menage-location-courte-duree-lyon',
    cluster: 'airbnb',
    keyword: 'ménage location courte durée Lyon',
    eyebrow: 'Location saisonnière',
    h1: 'Ménage de location courte durée à Lyon',
    title: 'Ménage location courte durée à Lyon — MonCleanerPro | Airbnb, Booking, Abritel',
    description: "Ménage de location saisonnière à Lyon, toutes plateformes : rotations entre voyageurs, moyenne durée, remise en état de fin de saison. Propriétaires indépendants et multipropriétaires. Devis sous 24h.",
    intro:
      "Airbnb n’est qu’une plateforme parmi d’autres. Beaucoup de propriétaires lyonnais diffusent le même bien sur Booking, Abritel ou en direct, louent parfois au mois à des salariés en mission, et alternent avec des périodes d’occupation personnelle. Le ménage doit suivre cette réalité-là, pas un modèle unique. MonCleanerPro assure l’entretien des locations courte et moyenne durée à Lyon quel que soit le canal de réservation, avec des prestations calibrées sur le type de séjour plutôt que sur le nom du site.",
    highlights: [
      { title: 'Toutes plateformes', text: "Airbnb, Booking, Abritel, agences ou réservation directe : nous travaillons à partir de vos calendriers, pas d’un canal imposé." },
      { title: 'Courte et moyenne durée', text: "Rotation entre deux nuitées ou entretien mensuel d’un locataire en mission longue : deux prestations différentes, pas le même contenu." },
      { title: 'Propriétaires non résidents', text: "Vous ne vivez pas à Lyon ? Le rapport photo après chaque passage remplace le contrôle sur place." },
      { title: 'Ouverture et fermeture de saison', text: "Remise en route après une période creuse, remise en état renforcée en fin de saison : les deux moments où un logement se dégrade sans qu’on le voie." },
    ],
    includes: [
      'Rotation complète entre deux séjours',
      'Entretien périodique des séjours longs (moyenne durée)',
      'Changement et récupération du linge',
      'Réassort des consommables et de la vaisselle manquante',
      'Nettoyage des vitres et surfaces vitrées accessibles',
      'Remise en état renforcée d’ouverture ou de fin de saison',
      'Contrôle de l’état du mobilier et des équipements',
      'Rapport photo daté après chaque intervention',
    ],
    sections: [
      {
        h2: 'Courte durée, moyenne durée : deux métiers, pas un',
        paragraphs: [
          "Une rotation de deux nuits et un séjour de trois mois n’appellent pas le même travail. En courte durée, l’enjeu est la vitesse et l’exhaustivité : tout est remis à zéro entre chaque voyageur, dans une fenêtre très courte, avec un changement de linge systématique. Rien n’est reporté au passage suivant, parce qu’il n’y a pas de passage suivant avant l’arrivée.",
          "En moyenne durée — le salarié en mission, l’étudiant, le patient d’un traitement long, l’expatrié en transition — le logement est occupé en continu. La prestation devient un entretien périodique : on maintient le bien en état pendant l’occupation, avec un ménage de fond à l’entrée et à la sortie. Beaucoup de propriétaires lyonnais alternent les deux régimes selon la saison ; nous adaptons la prestation à chaque période plutôt que d’appliquer un forfait unique toute l’année.",
        ],
      },
      {
        h2: 'Ce que Lyon impose comme contraintes',
        list: [
          "Des immeubles anciens en Presqu’île, à la Croix-Rousse ou dans le Vieux Lyon : escaliers, pas d’ascenseur, portage du linge à prendre en compte dans la durée réelle du passage",
          "Un stationnement difficile en hypercentre, qui pèse sur l’enchaînement des interventions et se planifie",
          "Une saisonnalité marquée : congrès, salons et événements créent des pics de rotation sur des dates précises",
          "Une réglementation locale de la location meublée touristique qui pousse les propriétaires vers des durées plus longues — et donc vers un besoin d’entretien différent",
          "Une forte concentration de logements sur quelques quartiers, ce qui permet d’optimiser les tournées quand un propriétaire en détient plusieurs",
        ],
      },
      {
        h2: 'Louer sans être sur place',
        paragraphs: [
          "Une bonne partie des logements loués à Lyon appartient à des propriétaires qui vivent ailleurs. Ils partagent tous le même angle mort : ils ne voient jamais leur bien. L’usure s’installe progressivement — une poêle rayée, un joint noirci, des serviettes grises, une chaise bancale — et rien de tout cela n’est signalé par les voyageurs, qui se contentent de le refléter dans la note.",
          "Le rapport photo après chaque passage sert exactement à ça : donner à un propriétaire distant la vision qu’il aurait en entrant chez lui. Sur les biens que nous suivons régulièrement, nous signalons ce qui se dégrade avant que ça n’apparaisse dans un commentaire public — c’est beaucoup moins cher à corriger à ce stade.",
        ],
      },
      {
        h2: 'Les deux moments qu’il ne faut pas rater',
        paragraphs: [
          "L’ouverture de saison, d’abord. Un logement resté fermé plusieurs semaines n’est pas propre, même s’il l’était en fermant : poussière déposée, odeur de renfermé, siphons asséchés qui remontent, linge qui a pris l’humidité du placard. Une simple rotation ne corrige rien de tout ça. Il faut une remise en route complète avant le premier voyageur.",
          "La fin de saison, ensuite. C’est le seul créneau où l’on peut traiter ce qu’une rotation ne permet jamais : intérieur des placards et du four, détartrage en profondeur, vitres complètes, matelas et protège-matelas, dessous des meubles. Un logement qui reçoit ce traitement une à deux fois par an ne dérive pas ; un logement qui n’a jamais que des rotations se dégrade lentement, sans qu’aucun passage individuel soit en cause.",
        ],
      },
    ],
    faq: [
      { q: 'Travaillez-vous uniquement avec Airbnb ?', a: "Non. Airbnb est le canal le plus répandu, mais nous intervenons indifféremment pour des biens diffusés sur Booking, Abritel, via une agence ou en réservation directe. Ce qui compte pour nous est le calendrier des départs et arrivées, pas la plateforme." },
      { q: 'Prenez-vous les locations à la semaine ou au mois ?', a: "Oui. Pour un séjour long, la prestation devient un entretien périodique — hebdomadaire ou bimensuel selon votre formule — avec un ménage de fond à l’entrée et à la sortie du locataire." },
      { q: 'Je ne vis pas à Lyon, comment suivre ce qui est fait ?', a: "Chaque intervention donne lieu à un rapport photo daté. Vous voyez l’état du logement après notre passage et les points signalés — usure, équipement défectueux, consommable manquant — sans avoir à vous déplacer ni à demander." },
      { q: 'Pouvez-vous préparer le logement avant la reprise de saison ?', a: "Oui, et c’est vivement conseillé après plusieurs semaines de fermeture. Poussière, odeur de renfermé et siphons asséchés ne se traitent pas dans une rotation classique : il faut une remise en route dédiée avant le premier voyageur." },
      { q: 'Intervenez-vous pour un seul logement ?', a: "Oui, sans volume minimum. Un propriétaire avec un appartement est traité avec la même organisation qu’une conciergerie — la différence est le nombre d’interventions, pas le niveau d’exigence." },
      { q: 'Que faites-vous des objets oubliés par les voyageurs ?', a: "Ils sont mis de côté dans le logement à un endroit convenu et signalés dans le rapport, avec photo. Vous décidez de la suite : restitution, envoi ou mise au rebut après un délai." },
    ],
    related: ['menage-airbnb-lyon', 'menage-conciergerie-lyon', 'prix-menage-airbnb-lyon', 'grand-menage-lyon'],
    relatedPosts: ['checklist-menage-airbnb-entre-voyageurs', 'linge-location-courte-duree'],
    updatedAt: '2026-08-08',
  },
  {
    slug: 'prix-menage-airbnb-lyon',
    cluster: 'airbnb',
    keyword: 'prix ménage Airbnb',
    eyebrow: 'Prix & devis',
    h1: 'Prix d’un ménage Airbnb à Lyon',
    title: 'Prix ménage Airbnb à Lyon — MonCleanerPro | Ce qui fait varier le devis',
    description: "Comment se calcule le prix d’un ménage Airbnb à Lyon : surface, nombre de couchages, linge, fréquence de rotation, accès et créneau. Estimation immédiate en ligne, devis confirmé sous 24h.",
    intro:
      "La question arrive toujours en premier, et c’est normal : le ménage est le poste de charge le plus régulier d’une location courte durée, celui qui revient à chaque réservation. Mais un tarif affiché en ligne ne vous dirait rien d’utile — un studio sans linge fourni et un T3 avec deux salles de bains et six couchages n’ont pas le même contenu de prestation. Voici précisément ce qui fait varier le devis, ce que vous pouvez actionner pour le réduire, et comment obtenir votre chiffre en quelques minutes.",
    highlights: [
      { title: 'Estimation immédiate', text: "Décrivez votre logement en ligne et obtenez une fourchette tout de suite, sans attendre un rappel commercial." },
      { title: 'Devis confirmé sous 24h', text: "Un devis écrit et détaillé, ajusté après vérification de votre situation réelle, sans engagement." },
      { title: 'Un tarif par rotation, stable', text: "Une fois le logement cadré, le prix d’une rotation standard ne bouge pas d’une réservation à l’autre." },
      { title: 'Les écarts sont annoncés', text: "Une remise en état exceptionnelle après un séjour difficile vous est signalée avant d’être engagée, jamais découverte sur la facture." },
    ],
    includes: [
      'Une estimation immédiate à partir de votre description',
      'Un devis écrit confirmé sous 24h, sans engagement',
      'Le détail précis de ce qui est inclus dans une rotation',
      'La durée prévue et le nombre d’intervenants',
      'Les conditions applicables aux logements récurrents et aux parcs',
    ],
    sections: [
      {
        h2: 'Les six critères qui déterminent le prix d’une rotation',
        paragraphs: [
          "Un devis de ménage en courte durée repose sur une estimation du temps de travail réel par rotation. Voici ce que nous regardons.",
        ],
        list: [
          "La surface et le nombre de pièces — la base, mais jamais suffisante à elle seule.",
          "Le nombre de couchages et de salles d’eau — c’est le facteur le plus sous-estimé. Deux salles de bains doublent le poste le plus long de la prestation, et six couchages représentent six lits à refaire, pas une surface de plus.",
          "Le linge — fourni, lavé, simplement changé, ou géré par une blanchisserie : selon le montage, le temps passé et la logistique changent nettement.",
          "La fréquence de rotation — un logement qui tourne trois fois par semaine se planifie et se traite mieux qu’une intervention isolée deux fois par an.",
          "Le créneau — une fenêtre très serrée entre un départ et une arrivée peut imposer deux intervenants au lieu d’un pour tenir l’horaire.",
          "L’accès — étage élevé sans ascenseur, portage du linge, stationnement impossible en hypercentre : autant de minutes qui ne servent pas à nettoyer mais qui se paient.",
        ],
      },
      {
        h2: 'Pourquoi nous n’affichons pas de grille tarifaire',
        paragraphs: [
          "Un prix affiché « à partir de » est presque toujours trompeur en courte durée. Soit il correspond à un studio sans linge, et il ne s’applique à aucun logement familial réel. Soit il est calé haut, et vous payez pour des prestations que votre bien ne nécessite pas. Dans les deux cas, le chiffre affiché n’est pas celui que vous paierez.",
          "Nous préférons construire l’estimation sur votre logement : vous le décrivez dans notre outil, vous obtenez une fourchette immédiate, et nous confirmons par un devis écrit sous 24h. C’est plus rapide qu’un rendez-vous commercial, et le montant correspond à votre bien.",
        ],
      },
      {
        h2: 'Ce qui peut faire baisser la note',
        list: [
          "Constituer un vrai stock de linge en rotation : cela supprime les attentes et les allers-retours qui allongent chaque passage",
          "Regrouper plusieurs logements proches : une tournée cohérente coûte moins qu’une somme d’interventions isolées",
          "Nous donner un accès en autonomie (boîte à clés ou serrure connectée) plutôt qu’une remise de clés à organiser à chaque fois",
          "Éviter les fenêtres inutilement serrées quand votre calendrier le permet — un check-out à 10h plutôt qu’à midi change beaucoup de choses",
          "Simplifier la décoration : un logement surchargé d’objets décoratifs demande un temps de remise en place qui n’apporte rien à la note",
          "Signaler à l’avance les séjours à risque (groupe, fête, long séjour) pour dimensionner la rotation plutôt que de la subir",
        ],
      },
      {
        h2: 'Le bon calcul n’est pas le prix, c’est le prix par nuitée',
        paragraphs: [
          "Un ménage rapporté au coût d’une nuitée pèse rarement lourd, surtout à Lyon où les tarifs de nuitée se tiennent bien. À l’inverse, une seule mauvaise note sur la propreté fait baisser le classement d’une annonce, réduit les réservations pendant des semaines et coûte immédiatement plus cher que l’écart entre deux prestataires.",
          "C’est le raisonnement que nous invitons à tenir : le ménage n’est pas une charge à comprimer au maximum, c’est ce qui protège la seule chose qui compte vraiment — le taux de remplissage et la note. Un prestataire un peu moins cher qui livre en retard un samedi sur trois vous coûte plus que la différence.",
        ],
      },
    ],
    faq: [
      { q: 'Le ménage Airbnb se facture-t-il au m² ?', a: "Non, et c’est une base de calcul trompeuse en courte durée. Le nombre de couchages et de salles d’eau pèse davantage que la surface : un T2 avec deux salles de bains et un canapé-lit demande plus de travail qu’un grand studio. Notre devis part du temps réel estimé par rotation." },
      { q: 'Le devis est-il gratuit et sans engagement ?', a: "Oui. L’estimation en ligne est immédiate et gratuite, et le devis confirmé sous 24h ne vous engage à rien." },
      { q: 'Le tarif change-t-il d’une rotation à l’autre ?', a: "Non. Une fois le logement cadré, le prix d’une rotation standard est stable, ce qui vous permet de le répercuter sereinement dans vos frais de ménage. Seules les remises en état exceptionnelles sortent de ce cadre, et elles vous sont signalées avant d’être engagées." },
      { q: 'Le linge est-il compris dans le prix ?', a: "Cela dépend du montage retenu. Le changement du linge est inclus dans la rotation ; la fourniture et le lavage se cadrent séparément, selon que vous disposez d’un stock, passez par une blanchisserie ou souhaitez que nous l’organisions." },
      { q: 'Proposez-vous des conditions pour plusieurs logements ?', a: "Oui. Les conciergeries et multipropriétaires bénéficient de conditions adaptées, principalement parce qu’une tournée groupée est plus efficace qu’une série d’interventions isolées. La densité géographique de votre parc compte autant que le nombre de biens." },
      { q: 'Facturez-vous un supplément en urgence ?', a: "Une intervention à caler dans un délai très court, hors planning, mobilise un intervenant sur un créneau déjà occupé et se répercute sur le devis. Un calendrier raccordé en amont suffit généralement à l’éviter." },
      { q: 'Comment obtenir mon chiffre ?', a: "Décrivez votre logement dans notre estimation en ligne : surface, couchages, salles d’eau, gestion du linge et fréquence. Vous obtenez une fourchette immédiate, puis un devis confirmé sous 24h." },
    ],
    related: ['menage-airbnb-lyon', 'menage-location-courte-duree-lyon', 'menage-conciergerie-lyon'],
    relatedPosts: ['linge-location-courte-duree', 'menage-airbnb-creneau-entre-deux-voyageurs'],
    updatedAt: '2026-08-08',
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
      { title: 'Une présence locale, pas un passage', text: "Villefranche et le Beaujolais ne sont pas une extension lointaine de notre zone : c’est un secteur que nous couvrons en propre, avec des interventions régulières." },
      { title: 'Réactivité caladoise', text: "Une demande urgente à Villefranche ne dépend pas d’une équipe qui descendrait de Lyon dans les embouteillages de l’A6." },
      { title: 'Pros & particuliers', text: "Commerces de la rue Nationale, bureaux, cabinets, copropriétés, locations saisonnières et logements de particuliers." },
      { title: 'Régulier ou ponctuel', text: "Contrat d’entretien récurrent ou prestation unique — grand ménage, fin de chantier, remise en état avant vente." },
      { title: 'Le Beaujolais avec ses matériaux', text: "Pierres dorées, tomettes, parquets anciens, poutres : le bâti local ne se nettoie pas comme un immeuble neuf de la métropole." },
      { title: 'Interlocuteur unique', text: "Un seul contact pour l’ensemble de vos sites, y compris si vous avez des locaux à la fois à Villefranche et sur Lyon." },
    ],
    includes: [
      'Nettoyage de bureaux, cabinets et locaux professionnels',
      'Entretien des parties communes de copropriété',
      'Ménage de locations courte durée et saisonnières',
      'Nettoyage de commerces, vitrines et surfaces de vente',
      'Nettoyage de fin de chantier et après travaux',
      'Grand ménage et remise en état avant vente ou location',
      'Nettoyage de vitres et surfaces vitrées',
      'Interventions ponctuelles ou contrats d’entretien récurrents',
    ],
    sections: [
      {
        h2: 'Pourquoi Villefranche est un vrai secteur pour nous',
        paragraphs: [
          "Beaucoup d’entreprises de nettoyage lyonnaises annoncent couvrir Villefranche-sur-Saône. Dans les faits, cela signifie souvent qu’elles y envoient une équipe quand le planning lyonnais le permet — c’est-à-dire rarement, et jamais en urgence. Un client caladois qui appelle un vendredi pour une intervention le lundi s’entend répondre que le secteur est « un peu loin ».",
          "Nous avons fait le choix inverse : traiter Villefranche et le nord du Rhône comme un secteur à part entière, avec des interventions régulières et une capacité à répondre localement. C’est ce qui permet de tenir un contrat d’entretien hebdomadaire sur un cabinet ou une copropriété caladoise sans que la prestation dépende de ce qui se passe à Lyon ce jour-là.",
        ],
      },
      {
        h2: 'Ce que nous nettoyons à Villefranche',
        list: [
          "Commerces et vitrines du centre-ville, autour de la rue Nationale et des rues commerçantes attenantes",
          "Bureaux, cabinets libéraux, professions de santé et agences du centre et des zones d’activité",
          "Parties communes de copropriétés : halls, cages d’escalier, paliers, locaux poubelles",
          "Locations saisonnières et meublés touristiques, en rotation entre deux séjours",
          "Logements de particuliers : grand ménage, remise en état, entretien régulier",
          "Chantiers de rénovation et livraisons neuves, en fin de chantier comme après travaux",
        ],
      },
      {
        h2: 'Le bâti caladois demande des gestes adaptés',
        paragraphs: [
          "Le centre de Villefranche, ce sont des immeubles anciens, des façades et des intérieurs qui ont traversé plusieurs siècles, et des matériaux qui ne pardonnent pas l’erreur de produit. Une pierre dorée absorbe : un détergent acide y laisse une auréole que rien ne rattrape. Une tomette se ternit définitivement à l’eau savonneuse mal rincée. Un parquet ancien gonfle si on l’inonde.",
          "Sur un immeuble neuf, ces questions ne se posent pas ; ici, elles se posent presque à chaque intervention. Nos intervenants identifient le support avant de choisir le produit, et privilégient systématiquement le geste le plus doux qui fonctionne. C’est un réflexe qu’on n’acquiert qu’en travaillant régulièrement sur ce type de bâti.",
        ],
      },
      {
        h2: 'Villefranche, Anse et les communes du Beaujolais',
        paragraphs: [
          "Notre couverture ne s’arrête pas à la commune. Nous intervenons sur l’ensemble du secteur : Anse et le pays des Pierres Dorées, Gleizé, Limas, Arnas, Belleville, et les villages du vignoble jusqu’aux portes de la métropole lyonnaise.",
          "C’est particulièrement utile pour les propriétaires et les gestionnaires qui ont plusieurs biens dispersés dans le Beaujolais : plutôt que de composer avec un prestataire différent par commune, un seul interlocuteur couvre l’ensemble, avec des tournées organisées par proximité.",
        ],
      },
    ],
    faq: [
      { q: 'Intervenez-vous vraiment à Villefranche, ou seulement depuis Lyon ?', a: "Villefranche et le Beaujolais sont un secteur que nous couvrons en propre, avec des interventions régulières. C’est ce qui nous permet de tenir des contrats d’entretien hebdomadaires et de répondre à des demandes urgentes sans dépendre du planning lyonnais du jour." },
      { q: 'Quelles communes du Beaujolais couvrez-vous ?', a: "Villefranche-sur-Saône, Anse, Gleizé, Limas, Arnas, Belleville et les communes du vignoble et des Pierres Dorées, jusqu’aux portes de la métropole lyonnaise. Si votre commune n’est pas citée, demandez-nous : elle est probablement dans notre zone." },
      { q: 'Proposez-vous du régulier comme du ponctuel ?', a: "Les deux. Contrats d’entretien réguliers pour les professionnels, commerces et copropriétés ; prestations ponctuelles pour les particuliers — grand ménage, fin de chantier, remise en état avant une vente ou un état des lieux." },
      { q: 'Intervenez-vous en dehors des heures d’ouverture d’un commerce ?', a: "Oui. Pour les commerces, bureaux et cabinets, nous intervenons avant l’ouverture, après la fermeture ou le week-end, afin de ne jamais gêner votre activité ni votre clientèle." },
      { q: 'Savez-vous traiter les sols anciens et la pierre ?', a: "Oui, c’est courant sur le secteur. Tomettes, pierres dorées, parquets anciens et poutres appellent des produits neutres, peu d’eau et un rinçage soigné. Nous vérifions systématiquement la nature du support avant de commencer." },
      { q: 'Gérez-vous plusieurs sites entre Villefranche et Lyon ?', a: "Oui, et c’est un cas fréquent pour les entreprises et les gestionnaires immobiliers du secteur. Un seul interlocuteur, un contrat unique et une facturation consolidée pour l’ensemble de vos implantations." },
    ],
    related: [
      'nettoyage-anse',
      'nettoyage-fin-de-chantier-villefranche-sur-saone',
      'menage-airbnb-villefranche-sur-saone',
      'nettoyage-bureaux-lyon',
      'nettoyage-copropriete-lyon',
    ],
    updatedAt: '2026-08-08',
  },
  {
    slug: 'nettoyage-anse',
    keyword: 'nettoyage Anse',
    eyebrow: 'Anse',
    h1: 'Entreprise de nettoyage à Anse',
    title: 'Nettoyage à Anse (69480) — MonCleanerPro | Entreprises, copropriétés & particuliers',
    description: "Entreprise de nettoyage à Anse et dans le pays des Pierres Dorées : bureaux, commerces, copropriétés, locations saisonnières, fin de chantier et grand ménage. Équipe locale, devis gratuit sous 24h.",
    intro:
      "Anse occupe une position particulière : porte d’entrée du Beaujolais, à quelques minutes de Villefranche, mais à moins de trente kilomètres de Lyon par l’A6 — ce qui en fait autant une commune viticole qu’une commune résidentielle où l’on habite en travaillant dans la métropole. Cette double nature se retrouve dans les besoins de nettoyage : des maisons en pierres dorées et des locations saisonnières d’un côté, des bureaux, des commerces et des copropriétés récentes de l’autre. MonCleanerPro intervient sur l’ensemble, avec une équipe qui couvre réellement le secteur.",
    highlights: [
      { title: 'Sur place, pas de passage', text: "Anse fait partie de notre secteur Beaujolais couvert en propre — pas d’une zone lointaine desservie quand le planning lyonnais le permet." },
      { title: 'Pierres dorées', text: "Le bâti local en pierre calcaire et les sols anciens demandent des produits neutres et peu d’eau. Nous adaptons le geste au support." },
      { title: 'Résidentiel et professionnel', text: "Maisons, copropriétés, bureaux, commerces et locaux d’activité : la commune a les deux visages, nous traitons les deux." },
      { title: 'Location saisonnière', text: "Gîtes, meublés touristiques et locations de bord de Saône : rotations entre deux séjours et remise en route de saison." },
      { title: 'Régulier ou ponctuel', text: "Contrat d’entretien hebdomadaire comme intervention unique avant une vente, un état des lieux ou une réception de travaux." },
      { title: 'Un seul interlocuteur', text: "Y compris si vous avez des biens à Anse, à Villefranche et sur la métropole lyonnaise." },
    ],
    includes: [
      'Nettoyage de bureaux et locaux professionnels',
      'Entretien des parties communes de copropriété',
      'Nettoyage de commerces et de vitrines',
      'Ménage de gîtes et de locations saisonnières',
      'Grand ménage et remise en état de maisons',
      'Nettoyage de fin de chantier et après travaux',
      'Traitement adapté des sols anciens et de la pierre',
      'Nettoyage de vitres et surfaces vitrées',
    ],
    sections: [
      {
        h2: 'Une commune à deux vitesses, deux types de besoins',
        paragraphs: [
          "Anse n’est pas un village du vignoble figé, ni une banlieue lyonnaise. C’est une commune qui a beaucoup construit ces dernières années, où de jeunes ménages s’installent parce qu’on y accède facilement à Lyon comme à Villefranche, et où le tissu ancien continue de vivre à côté des programmes récents.",
          "Pour nous, cela veut dire deux réalités très différentes à traiter parfois dans la même journée. D’un côté, des copropriétés récentes et des locaux d’activité qui demandent de la régularité et de la méthode. De l’autre, des maisons anciennes en pierres dorées, des logements aux tomettes et aux poutres, des biens de caractère loués en saisonnier. On ne travaille pas de la même façon sur les deux — et un prestataire qui applique un protocole unique abîme forcément l’un ou bâcle l’autre.",
        ],
      },
      {
        h2: 'Nos interventions à Anse',
        list: [
          "Copropriétés et résidences : halls, cages d’escalier, paliers, locaux techniques et poubelles",
          "Bureaux, cabinets et commerces du centre et des zones d’activité",
          "Maisons de particuliers : grand ménage, entretien régulier, remise en état avant vente",
          "Gîtes, chambres d’hôtes et meublés touristiques du secteur",
          "Logements neufs livrés dans les programmes récents de la commune",
          "Fin de chantier après rénovation d’une maison ancienne ou d’un corps de ferme",
        ],
      },
      {
        h2: 'La pierre dorée ne se nettoie pas comme du carrelage',
        paragraphs: [
          "C’est le point technique qui distingue vraiment le secteur. La pierre calcaire qui donne au pays des Pierres Dorées sa couleur est poreuse : elle absorbe ce qu’on lui applique. Un produit acide — y compris certains détartrants du commerce — y laisse une trace claire, irréversible. Un nettoyage haute pression mal dosé creuse le joint et fragilise la surface.",
          "Même logique à l’intérieur : les tomettes se ternissent à l’eau savonneuse insuffisamment rincée, les poutres ne se lavent pas mais se dépoussièrent, les parquets anciens ne supportent pas l’eau stagnante. Notre règle est simple : identifier le support avant de choisir le produit, et retenir toujours le geste le plus doux qui donne le résultat. Sur un bien de caractère, un nettoyage trop énergique coûte plus cher que l’absence de nettoyage.",
        ],
      },
      {
        h2: 'Le tourisme local change le rythme',
        paragraphs: [
          "Entre la Saône, la base de loisirs et le vignoble, Anse reçoit une fréquentation saisonnière réelle. Gîtes, chambres d’hôtes et meublés touristiques y connaissent des pics très marqués — week-ends d’été, ponts de printemps, périodes de vendanges — avec des rotations qui s’enchaînent sur quelques jours puis retombent.",
          "Nous adaptons la présence à cette courbe plutôt que d’appliquer une fréquence fixe toute l’année : rotations rapprochées en haute saison, remise en route complète avant la reprise, et remise en état renforcée à la fermeture. C’est le mode de fonctionnement le plus économique pour un propriétaire qui ne loue pas douze mois sur douze.",
        ],
      },
    ],
    faq: [
      { q: 'Intervenez-vous réellement à Anse ou depuis Lyon ?', a: "Anse fait partie de notre secteur Beaujolais, couvert avec des interventions régulières. Nous ne traitons pas la commune comme un déplacement exceptionnel : c’est ce qui rend possible un contrat d’entretien hebdomadaire ou une intervention à quelques jours." },
      { q: 'Couvrez-vous les communes voisines ?', a: "Oui : Villefranche-sur-Saône, Limas, Gleizé, Lucenay, Ambérieux-d’Azergues, Pommiers et plus largement le pays des Pierres Dorées, jusqu’à la métropole lyonnaise." },
      { q: 'Nettoyez-vous les maisons en pierres dorées ?', a: "Oui, avec des produits neutres et un dosage adapté. La pierre calcaire est poreuse : un produit acide y laisse une auréole définitive, et une haute pression mal maîtrisée creuse les joints. Nous vérifions toujours la nature du support avant d’intervenir." },
      { q: 'Prenez-vous les gîtes et locations saisonnières ?', a: "Oui, en rotation entre deux séjours comme en remise en route de début de saison. Le secteur connaît des pics très marqués : nous calons la fréquence sur votre calendrier réel plutôt que sur un forfait annuel figé." },
      { q: 'Intervenez-vous pour les copropriétés de la commune ?', a: "Oui, halls, cages d’escalier, paliers et locaux communs, pour les syndics professionnels comme pour les copropriétés en gestion bénévole, avec un passage régulier et un suivi des interventions." },
      { q: 'Pouvez-vous intervenir après des travaux ?', a: "Oui, en fin de chantier comme en nettoyage après travaux. C’est fréquent sur le secteur, entre les rénovations de bâti ancien et les livraisons de logements neufs. Nous calons l’intervention juste avant la réception ou l’emménagement." },
    ],
    related: [
      'nettoyage-villefranche-sur-saone',
      'menage-airbnb-anse',
      'nettoyage-fin-de-chantier-anse',
      'grand-menage-lyon',
      'nettoyage-copropriete-lyon',
    ],
    updatedAt: '2026-08-08',
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
    related: ['nettoyage-fin-de-chantier-lyon', 'nettoyage-villefranche-sur-saone', 'nettoyage-fin-de-chantier-anse', 'prix-nettoyage-fin-de-chantier-lyon'],
    relatedPosts: ['poussiere-de-chantier-eliminer', 'etapes-nettoyage-fin-de-chantier'],
  },
  {
    slug: 'nettoyage-fin-de-chantier-anse',
    cluster: 'fin-de-chantier',
    keyword: 'nettoyage fin de chantier Anse',
    eyebrow: 'Fin de chantier · Anse',
    h1: 'Nettoyage de fin de chantier à Anse',
    title: 'Nettoyage fin de chantier à Anse (69480) — MonCleanerPro | Neuf & rénovation ancienne',
    description: "Nettoyage de fin de chantier à Anse et dans les Pierres Dorées : livraisons de logements neufs, rénovations de maisons anciennes, extensions. Poussière, traces et finitions avant remise des clés. Devis sous 24h.",
    intro:
      "À Anse, deux types de chantiers cohabitent et ne se ressemblent pas. D’un côté, les programmes récents livrés à des ménages qui viennent s’installer : du neuf, avec ses films de protection, ses étiquettes de vitrage et son voile de ciment. De l’autre, la rénovation de maisons en pierres dorées, de corps de ferme et de bâtis anciens, où la poussière de chaux et de pierre se dépose sur des supports fragiles. MonCleanerPro assure la remise en état de fin de chantier dans les deux cas, avec la méthode que chacun demande.",
    highlights: [
      { title: 'Neuf et ancien, deux méthodes', text: "Retrait des protections et du voile de ciment sur du neuf ; produits neutres et peu d’eau sur de la pierre et des tomettes." },
      { title: 'Calé sur votre échéance', text: "Réception, état des lieux, emménagement ou séance photo : nous intervenons juste avant la date qui compte." },
      { title: 'Secteur couvert en propre', text: "Anse et les Pierres Dorées font partie de notre zone Beaujolais — planification souple, y compris à quelques jours." },
      { title: 'Maisons et volumes', text: "Une maison rénovée représente plus de surface qu’un appartement : nous dimensionnons l’équipe en conséquence." },
      { title: 'Extérieurs compris', text: "Terrasse, abords et menuiseries extérieures salis par le passage des artisans, sur demande." },
      { title: 'Chantiers qui glissent', text: "Les rénovations en maison prennent du retard : nous replanifions plutôt que d’intervenir sur un chantier qui n’est pas prêt." },
    ],
    includes: [
      'Retrait des films de protection, étiquettes et adhésifs',
      'Dépoussiérage de haut en bas, poutres et points hauts compris',
      'Élimination du voile de ciment et des résidus de pose',
      'Traitement adapté des sols anciens (tomettes, pierre, parquet)',
      'Projections de peinture, enduit, chaux et colle éliminées',
      'Vitres, baies et menuiseries extérieures sans traces',
      'Cuisine et sanitaires détaillés avant remise des clés',
      'Abords et terrasse salis par le chantier, sur demande',
    ],
    sections: [
      {
        h2: 'Rénover de la pierre dorée : la poussière n’est pas la même',
        paragraphs: [
          "Une rénovation en bâti ancien du Beaujolais produit un mélange caractéristique : poussière de pierre calcaire, chaux, plâtre et parfois sciure de charpente. C’est une poussière lourde, abrasive et abondante, parce que les volumes sont grands et les chantiers longs. Elle se loge dans les joints de tomettes, sur les poutres, dans les irrégularités des murs en pierre apparente — des surfaces où un simple passage ne suffit jamais.",
          "Le piège vient ensuite : ces supports sont sensibles. La pierre dorée absorbe tout produit acide et garde la marque. Une tomette mal rincée reste terne. Une poutre lavée à l’eau se tache. C’est exactement le type de chantier où un nettoyage énergique et générique abîme un bien qu’on vient de restaurer à grands frais.",
        ],
      },
      {
        h2: 'Livrer du neuf sans réserves de propreté',
        paragraphs: [
          "Sur les programmes récents de la commune, l’enjeu est différent et beaucoup plus mécanique. Les réserves de propreté portent toujours sur les mêmes points : une étiquette de vitrage oubliée, un voile blanchâtre sur un carrelage neuf, du silicone frais sur un plan de travail, de la poussière de découpe restée dans les rails de placard ou sur les grilles de ventilation.",
          "Nous construisons le passage autour de cette liste. L’objectif n’est pas de « faire propre » en général mais de neutraliser précisément ce que l’acquéreur ou le maître d’ouvrage regarde en premier lors de la visite de livraison.",
        ],
      },
      {
        h2: 'Les chantiers qu’on nous confie à Anse',
        list: [
          "Maisons anciennes et corps de ferme rénovés, avant emménagement",
          "Livraisons de logements neufs dans les programmes récents de la commune",
          "Extensions, surélévations et aménagements de combles",
          "Appartements remis en état avant location ou mise en vente",
          "Gîtes et meublés touristiques créés ou rénovés avant ouverture",
          "Locaux professionnels et commerces avant réouverture",
        ],
      },
    ],
    faq: [
      { q: 'Intervenez-vous rapidement à Anse ?', a: "Oui, la commune fait partie de notre secteur Beaujolais couvert en propre. Nous planifions facilement à quelques jours, y compris avant un état des lieux ou une réception." },
      { q: 'Comment nettoyez-vous la pierre dorée et les tomettes ?', a: "Avec des produits neutres, peu d’eau et un rinçage soigné. Ces supports sont poreux : un produit acide y laisse une auréole définitive et une haute pression mal dosée creuse les joints. Nous vérifions la nature du support avant de commencer." },
      { q: 'Faut-il que tous les artisans aient terminé ?', a: "Idéalement oui, retouches de peinture comprises. Intervenir avant la fin réelle oblige à repasser. Si le planning l’impose, nous organisons un nettoyage intermédiaire puis la remise en état finale." },
      { q: 'Mon chantier a du retard, pouvez-vous décaler ?', a: "Oui, et c’est fréquent sur les rénovations de maison. Prévenez-nous : nous replanifions plutôt que d’intervenir sur un chantier qui n’est pas prêt, ce qui reviendrait à nettoyer deux fois." },
      { q: 'Nettoyez-vous aussi la terrasse et les abords ?', a: "Sur demande. Les abords immédiats, la terrasse et les menuiseries extérieures salis par le passage des artisans peuvent être inclus : précisez-le lors de l’estimation." },
      { q: 'Travaillez-vous avec les artisans du secteur ?', a: "Oui, en prestation ponctuelle comme en partenariat régulier. Livrer un chantier propre est le dernier geste que le client retient d’une entreprise : beaucoup d’artisans du Beaujolais préfèrent le confier à un prestataire dédié." },
    ],
    related: ['nettoyage-fin-de-chantier-lyon', 'nettoyage-anse', 'nettoyage-fin-de-chantier-villefranche-sur-saone', 'prix-nettoyage-fin-de-chantier-lyon'],
    relatedPosts: ['poussiere-de-chantier-eliminer', 'etapes-nettoyage-fin-de-chantier'],
    updatedAt: '2026-08-08',
  },

  // ── Déclinaisons communales du cluster « Airbnb / courte durée » ───────────
  {
    slug: 'menage-airbnb-villefranche-sur-saone',
    cluster: 'airbnb',
    keyword: 'ménage Airbnb Villefranche-sur-Saône',
    eyebrow: 'Airbnb · Villefranche-sur-Saône',
    h1: 'Ménage Airbnb à Villefranche-sur-Saône',
    title: 'Ménage Airbnb à Villefranche-sur-Saône — MonCleanerPro | Courte durée & Beaujolais',
    description: "Ménage de location courte durée à Villefranche-sur-Saône : rotations entre voyageurs, gestion du linge, rapport photo. Séjours affaires en semaine, œnotourisme le week-end. Devis gratuit sous 24h.",
    intro:
      "La location courte durée à Villefranche ne ressemble pas à celle de Lyon. Ici, la semaine appartient aux déplacements professionnels — techniciens, commerciaux, intervenants sur les zones d’activité et l’hôpital — pendant que le week-end se remplit de visiteurs venus pour le vignoble et les Pierres Dorées. Deux clientèles, deux rythmes, et des rotations qui se concentrent sur le vendredi et le dimanche. MonCleanerPro assure le ménage de vos meublés caladois avec une organisation calée sur cette saisonnalité-là.",
    highlights: [
      { title: 'Prestataire local', text: "Nous couvrons Villefranche en propre : la rotation du dimanche ne dépend pas d’une équipe qui remonterait de Lyon." },
      { title: 'Semaine pro, week-end tourisme', text: "Séjours d’affaires en semaine et courts séjours œnotouristiques le week-end : deux usages, une même exigence de remise à neuf." },
      { title: 'Calendrier synchronisé', text: "Votre lien iCal Airbnb ou Booking génère les ménages à partir des départs réels, sans transmission manuelle." },
      { title: 'Linge et consommables', text: "Draps et serviettes changés à chaque départ, réassort selon le stock convenu pour votre logement." },
      { title: 'Rapport photo', text: "Vous ne vivez pas à Villefranche ? Chaque passage produit un compte rendu daté avec photos." },
      { title: 'Bâti ancien du centre', text: "Immeubles anciens sans ascenseur, parquets et tomettes : les gestes sont adaptés au support." },
    ],
    includes: [
      'Rotation complète entre deux voyageurs',
      'Changement des draps, housses et linge de toilette',
      'Salle de bains détartrée et désinfectée, sans traces',
      'Cuisine dégraissée, réfrigérateur vidé et contrôlé',
      'Réassort des consommables selon votre stock',
      'Mise en scène d’accueil et aération du logement',
      'Signalement des dégâts et objets oubliés',
      'Rapport d’intervention photo après chaque passage',
    ],
    sections: [
      {
        h2: 'Deux clientèles, deux façons de laisser un logement',
        paragraphs: [
          "Un voyageur d’affaires en semaine occupe peu le logement : il dort, il part tôt, il rentre tard. La rotation est rapide, mais elle est fréquente — parfois trois fois sur cinq jours, avec des séjours d’une ou deux nuits qui s’enchaînent. Ce qui compte alors, c’est la ponctualité absolue : un professionnel qui arrive à 19h après sa journée n’attend pas dans la rue.",
          "Le week-end change complètement la donne. Séjours en couple ou en groupe pour le vignoble, arrivées tardives le vendredi, départs le dimanche en fin de matinée : le logement est réellement vécu, la cuisine sert, et la remise en état demande davantage. C’est aussi le moment où les rotations se concentrent, dimanche midi, toutes en même temps — le créneau qu’il faut avoir dimensionné à l’avance plutôt que découvert le jour même.",
        ],
      },
      {
        h2: 'Ce que le centre ancien impose',
        list: [
          "Des immeubles sans ascenseur : le portage du linge compte dans la durée réelle du passage et doit être prévu",
          "Des parquets et tomettes anciens qui n’acceptent ni l’eau stagnante ni les produits agressifs",
          "Un stationnement contraint dans les rues du centre, qui se planifie plutôt qu’il ne s’improvise",
          "Des logements souvent petits mais très compartimentés, où le temps de ménage ne suit pas la surface",
          "Des boîtes à clés à généraliser : sur un parc caladois, l’accès en autonomie est ce qui sécurise le plus la rotation",
        ],
      },
      {
        h2: 'La saison compte plus qu’à Lyon',
        paragraphs: [
          "Lyon loue toute l’année. Villefranche vit davantage au rythme des saisons : le printemps et l’automne concentrent l’œnotourisme, l’été apporte les séjours de passage le long de la Saône, et janvier-février restent calmes. Un contrat de ménage à fréquence fixe n’a donc pas de sens ici — il facture des passages inutiles en creux et sature en haute saison.",
          "Nous calons la présence sur votre calendrier réel, avec une remise en route complète avant la reprise de saison et une remise en état renforcée à la fermeture. C’est là qu’on traite ce qu’une rotation ne permet jamais : intérieur des placards et du four, détartrage profond, vitres complètes, matelas et protège-matelas.",
        ],
      },
    ],
    faq: [
      { q: 'Couvrez-vous Villefranche pour la courte durée toute l’année ?', a: "Oui, y compris en basse saison. Villefranche fait partie de notre secteur Beaujolais couvert en propre, ce qui permet d’assurer les rotations du week-end comme les séjours professionnels de semaine." },
      { q: 'Pouvez-vous gérer les rotations groupées du dimanche ?', a: "Oui, à condition de les avoir prévues. C’est le créneau le plus dense du secteur : nous dimensionnons les effectifs à l’avance et ordonnançons la tournée par proximité pour que les déplacements ne mangent pas le temps de ménage." },
      { q: 'Intervenez-vous aussi à Anse et dans le vignoble ?', a: "Oui : Anse, Limas, Gleizé, Arnas, Pommiers, Lucenay et plus largement les communes des Pierres Dorées et du vignoble beaujolais." },
      { q: 'Comment accédez-vous au logement ?', a: "Boîte à clés, serrure connectée ou clés confiées. Sur un parc en courte durée, l’accès en autonomie est vivement recommandé : il évite qu’un imprévu de remise de clés bloque toute la rotation de la journée." },
      { q: 'Je loue seulement d’avril à octobre, est-ce un problème ?', a: "Non, c’est même le fonctionnement le plus courant sur le secteur. Nous calons la présence sur votre calendrier réel, avec une remise en route avant la reprise et une remise en état renforcée à la fermeture." },
      { q: 'Gérez-vous le linge ?', a: "Le changement du linge est assuré à chaque départ et le linge sale récupéré. La fourniture et le lavage s’organisent selon votre fonctionnement — stock personnel, blanchisserie ou solution cadrée avec vous." },
    ],
    related: ['menage-airbnb-lyon', 'menage-airbnb-anse', 'nettoyage-villefranche-sur-saone', 'prix-menage-airbnb-lyon'],
    relatedPosts: ['checklist-menage-airbnb-entre-voyageurs', 'linge-location-courte-duree'],
    updatedAt: '2026-08-08',
  },
  {
    slug: 'menage-airbnb-anse',
    cluster: 'airbnb',
    keyword: 'ménage Airbnb Anse',
    eyebrow: 'Airbnb · Anse',
    h1: 'Ménage Airbnb et gîtes à Anse',
    title: 'Ménage Airbnb à Anse (69480) — MonCleanerPro | Gîtes, meublés & Pierres Dorées',
    description: "Ménage de location saisonnière à Anse : gîtes, chambres d’hôtes et meublés touristiques du pays des Pierres Dorées. Rotations, linge, remise en route de saison. Devis gratuit sous 24h.",
    intro:
      "À Anse, la location saisonnière ne se joue pas sur la nuitée d’affaires mais sur le séjour : un week-end dans le vignoble, quelques jours au bord de la Saône, une base pour visiter les Pierres Dorées à trente minutes de Lyon. Les biens loués sont souvent des maisons de caractère, des gîtes ou des dépendances aménagées — plus grands qu’un studio urbain, avec des matériaux anciens et une saisonnalité très marquée. MonCleanerPro assure leur entretien avec les gestes que ce type de bien demande et une présence calée sur les pics de fréquentation.",
    highlights: [
      { title: 'Gîtes et maisons de caractère', text: "Des volumes plus importants qu’un meublé urbain, avec plusieurs chambres et souvent plusieurs salles d’eau." },
      { title: 'Matériaux anciens respectés', text: "Pierres dorées, tomettes, poutres et parquets : produits neutres, peu d’eau, jamais de traitement générique." },
      { title: 'Saison marquée', text: "Pics de printemps, d’été et de vendanges, creux hivernal : la fréquence suit votre calendrier, pas un forfait annuel." },
      { title: 'Remise en route de saison', text: "Un bien resté fermé plusieurs semaines n’est pas propre. Une rotation ne suffit pas avant le premier voyageur." },
      { title: 'Propriétaires non résidents', text: "Beaucoup de biens du secteur appartiennent à des propriétaires lyonnais ou plus lointains : le rapport photo remplace le contrôle sur place." },
      { title: 'Secteur couvert en propre', text: "Anse et les Pierres Dorées font partie de notre zone Beaujolais, pas d’une extension desservie à l’occasion." },
    ],
    includes: [
      'Rotation complète entre deux séjours',
      'Changement des draps et du linge de toilette, plusieurs chambres',
      'Salles d’eau détartrées et désinfectées',
      'Cuisine dégraissée, réfrigérateur vidé et contrôlé',
      'Traitement adapté des sols anciens et de la pierre',
      'Extérieurs d’usage courant : terrasse, salon de jardin, abords',
      'Remise en route de début de saison et fermeture renforcée',
      'Rapport d’intervention photo après chaque passage',
    ],
    sections: [
      {
        h2: 'Un gîte ne se traite pas comme un studio urbain',
        paragraphs: [
          "La différence est d’abord une question de volume. Là où un meublé lyonnais se résume souvent à une pièce, une salle d’eau et un couchage, un gîte du secteur compte plusieurs chambres, parfois deux salles d’eau, une vraie cuisine et un extérieur. Le temps de rotation n’a rien à voir, et le nombre de lits à refaire pèse bien plus que la surface au sol.",
          "S’ajoute l’usage : un groupe qui passe un week-end dans le Beaujolais cuisine, mange dehors, utilise le barbecue et la terrasse. La remise en état inclut donc des postes qu’un logement urbain ne connaît pas — mobilier de jardin, plancha, sols extérieurs — et qu’il faut avoir prévus dans le cadrage, sinon ils sont soit oubliés, soit facturés en supplément à chaque fois.",
        ],
      },
      {
        h2: 'Ouvrir et fermer la saison, les deux passages qui comptent',
        paragraphs: [
          "C’est l’erreur la plus fréquente chez les propriétaires du secteur : considérer qu’un logement fermé proprement en octobre sera propre en avril. Il ne l’est pas. Une poussière fine s’est déposée sur toutes les surfaces, les siphons asséchés remontent une odeur désagréable, le linge stocké a pris l’humidité du placard, et l’air sent le renfermé dès qu’on ouvre la porte. Le premier voyageur de la saison arrive dans ce logement-là — et c’est souvent lui qui laisse le commentaire qui plombera l’été.",
          "À l’autre bout, la fermeture est le seul créneau de l’année où l’on peut traiter ce qu’aucune rotation ne permet : intérieur des placards et du four, détartrage en profondeur, vitres complètes, matelas, protège-matelas, dessous des meubles. Un bien qui reçoit ce traitement une fois par an ne dérive pas ; un bien qui n’a que des rotations se dégrade lentement, sans qu’un passage précis soit en cause.",
        ],
      },
      {
        h2: 'Les biens que nous entretenons à Anse et alentour',
        list: [
          "Gîtes et maisons de caractère en pierres dorées loués à la semaine ou au week-end",
          "Chambres d’hôtes, avec un rythme de rotation quotidien en haute saison",
          "Dépendances, granges et corps de ferme aménagés en meublé touristique",
          "Appartements et petits meublés du centre, loués à l’année sur les plateformes",
          "Logements de bord de Saône, très saisonniers, à forte fréquentation estivale",
          "Biens en création : remise en état après travaux avant la mise en ligne de l’annonce",
        ],
      },
    ],
    faq: [
      { q: 'Intervenez-vous à Anse et dans les communes voisines ?', a: "Oui : Anse, Lucenay, Ambérieux-d’Azergues, Pommiers, Limas, Villefranche-sur-Saône et plus largement le pays des Pierres Dorées et le vignoble." },
      { q: 'Je ne loue qu’en saison, pouvez-vous vous adapter ?', a: "Oui, c’est le fonctionnement normal sur le secteur. Nous calons la présence sur votre calendrier réel : rotations rapprochées en haute saison, remise en route avant la reprise, fermeture renforcée à la fin. Aucun passage facturé en creux." },
      { q: 'Nettoyez-vous les extérieurs du gîte ?', a: "Les extérieurs d’usage courant — terrasse, salon de jardin, plancha ou barbecue, abords immédiats — peuvent être inclus dans la rotation. Il suffit de le prévoir au cadrage pour que ce ne soit ni oublié ni facturé en supplément à chaque passage." },
      { q: 'Mes sols sont anciens, y a-t-il un risque ?', a: "Non, à condition d’adapter le geste. Tomettes, pierre et parquets anciens demandent des produits neutres, peu d’eau et un rinçage soigné. Nous identifions le support avant de choisir le produit — c’est un réflexe indispensable sur le bâti du secteur." },
      { q: 'Faut-il vraiment un nettoyage avant la reprise de saison ?', a: "Oui. Après plusieurs semaines de fermeture, un logement a repris de la poussière, ses siphons sont asséchés et l’air est confiné. Une rotation classique ne corrige rien de tout ça, et c’est le premier voyageur de la saison qui en fait les frais dans son commentaire." },
      { q: 'Comment suivre les interventions si je n’habite pas sur place ?', a: "Chaque passage donne lieu à un rapport photo daté : état constaté, travail réalisé, dégâts ou objets oubliés, consommables à recharger. C’est ce qui permet à un propriétaire distant de garder la main sans se déplacer." },
    ],
    related: ['menage-airbnb-lyon', 'menage-airbnb-villefranche-sur-saone', 'nettoyage-anse', 'menage-location-courte-duree-lyon'],
    relatedPosts: ['linge-location-courte-duree', 'checklist-menage-airbnb-entre-voyageurs'],
    updatedAt: '2026-08-08',
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
  'nettoyage-anse':                   { city: 'Anse',                   lat: 45.9364, lng: 4.7186, postalCode: '69480' },
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
  'nettoyage-fin-de-chantier-anse':                    { city: 'Anse',                    lat: 45.9364, lng: 4.7186, postalCode: '69480' },

  // Pages « ménage Airbnb × commune » : même logique géo. Le signal local vaut
  // autant en courte durée qu'en fin de chantier — la requête est toujours
  // formulée avec le nom de la commune.
  'menage-airbnb-villefranche-sur-saone':              { city: 'Villefranche-sur-Saône',  lat: 45.9847, lng: 4.7267, postalCode: '69400' },
  'menage-airbnb-anse':                                { city: 'Anse',                    lat: 45.9364, lng: 4.7186, postalCode: '69480' },
};
export const getCityGeo = (slug: string): CityGeo | undefined => CITY_GEO[slug];

// Liste des communes desservies (villes ciblées) — pour l'accueil (areaServed global).
// Dédupliquée : plusieurs slugs peuvent viser la même commune (ex. une page ville
// généraliste + sa déclinaison « fin de chantier »).
export const SERVED_CITIES = Array.from(new Set(['Lyon', ...Object.values(CITY_GEO).map(c => c.city)]));

// Pages d'un même cluster thématique (maillage interne ciblé).
export const getCluster = (name: string) => SEO_PAGES.filter(p => p.cluster === name);
