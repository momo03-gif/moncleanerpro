// ── Contrat de prestation — conditions particulières (logique PURE) ──────────
//
// POURQUOI CE DOCUMENT EXISTE, ET CE QU'IL N'EST PAS
//
// Les CGV (page /conditions-generales, 15 articles) sont le socle juridique
// commun à tous les clients : prix, facturation, responsabilité, résiliation,
// RGPD, médiation. Elles ne bougent pas d'un client à l'autre.
//
// Ce contrat-ci ne contient QUE ce qui est propre à un client : qui il est, quels
// logements, à quels prix, à quelle fréquence. Il renvoie aux CGV pour le reste.
// C'est la façon de faire des prestataires sérieux, et surtout elle permet de
// générer le document à partir de données qu'on possède déjà — profil de
// facturation, liste des logements, prix, fourniture de linge.
//
// ⚠️ CE MODULE N'EST PAS UN CONSEIL JURIDIQUE. Il structure et rédige ; il ne
// remplace pas la relecture d'un avocat avant la première signature.
//
// LES CINQ CHOIX DE L'ENTREPRISE, arrêtés le 21/09/2026 :
//   · durée indéterminée, préavis de 30 jours de part et d'autre ;
//   · annulation d'une intervention libre et sans frais — sauf déplacement déjà
//     effectué, facturé 20 € (calculé sur les coûts réels : 12,9 km de distance
//     moyenne depuis le dépôt, une heure immobilisée, charges comprises) ;
//   · facturation mensuelle à terme échu, paiement à 30 jours ;
//   · révision des prix au 1er janvier, par renégociation, le silence valant
//     acceptation passé quinze jours ;
//   · mentions légales de retard de paiement obligatoires entre professionnels.

export interface PartieContrat {
  /** Raison sociale exacte — celle qui engage. */
  raisonSociale: string;
  adresse: string;
  siret?: string;
  tvaIntracom?: string;
  representant?: string;
  email?: string;
  telephone?: string;
}

export interface LogementContrat {
  nom: string;
  adresse: string;
  /** Prix du ménage facturé au client (€). */
  prix: number;
  /** Durée prévue, en minutes — informative, elle cadre l'engagement. */
  minutes?: number;
  /** Fourniture de linge facturée à part, le cas échéant. */
  fourniture?: { libelle: string; montant: number } | null;
}

export interface DonneesContrat {
  prestataire: PartieContrat;
  client: PartieContrat;
  logements: LogementContrat[];
  /** Date de prise d'effet (YYYY-MM-DD). */
  dateEffet: string;
  /** Frais de déplacement sans objet, en euros. */
  fraisDeplacement: number;
  /** Ce que couvre la prestation, en une phrase propre au client. */
  objet?: string;
}

export interface ArticleContrat {
  titre: string;
  paragraphes: string[];
}

const euros = (v: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(v);

const dateFr = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? iso
    : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

function identite(p: PartieContrat): string {
  const bouts = [p.raisonSociale, p.adresse];
  if (p.siret) bouts.push(`SIRET ${p.siret}`);
  if (p.tvaIntracom) bouts.push(`TVA ${p.tvaIntracom}`);
  if (p.representant) bouts.push(`représentée par ${p.representant}`);
  return bouts.filter(Boolean).join(', ');
}

/** Total mensuel indicatif : somme des prestations, hors fréquence réelle. */
export function totalParPassage(logements: LogementContrat[]): number {
  const total = logements.reduce(
    (s, l) => s + (Number(l.prix) || 0) + (l.fourniture?.montant ?? 0), 0);
  return Math.round(total * 100) / 100;
}

/**
 * Construit les articles du contrat. Le texte est volontairement court : un
 * contrat qu'on ne lit pas n'engage personne. Ce qui peut vivre dans les CGV y
 * reste, et n'est pas répété ici.
 */
export function articlesContrat(d: DonneesContrat): ArticleContrat[] {
  const frais = euros(d.fraisDeplacement);

  const perimetre = d.logements.length === 0
    ? ['Le périmètre sera arrêté par avenant avant la première intervention.']
    : d.logements.map(l => {
        const parts = [`${l.nom} — ${l.adresse} : ${euros(l.prix)} par intervention`];
        if (l.minutes) parts.push(`durée prévue ${Math.round(l.minutes)} min`);
        if (l.fourniture) parts.push(`${l.fourniture.libelle} ${euros(l.fourniture.montant)}`);
        return parts.join(' · ');
      });

  return [
    {
      titre: 'Article 1 — Parties',
      paragraphes: [
        `Le Prestataire : ${identite(d.prestataire)}.`,
        `Le Client : ${identite(d.client)}.`,
      ],
    },
    {
      titre: 'Article 2 — Objet',
      paragraphes: [
        d.objet
          ?? 'Le Prestataire assure l’entretien des logements listés à l’article 3, entre deux occupations ou selon la fréquence convenue avec le Client.',
        'Les conditions générales de vente du Prestataire, en vigueur à la date de signature, font partie intégrante du présent contrat. En cas de contradiction, les présentes conditions particulières prévalent.',
      ],
    },
    {
      titre: 'Article 3 — Périmètre et prix',
      paragraphes: [
        'Les prestations portent sur les logements suivants. Tous les montants indiqués sont hors taxes.',
        ...perimetre,
        'Les prix s’entendent PAR INTERVENTION et HORS TAXES. La taxe sur la valeur ajoutée, au taux en vigueur, s’ajoute sur la facture.',
        'La fourniture de linge et de consommables, lorsqu’elle est assurée par le Prestataire, est facturée sur une ligne distincte de la prestation de ménage.',
        'Tout logement ajouté ou retiré fait l’objet d’un avenant, qui peut prendre la forme d’une confirmation écrite entre les parties.',
      ],
    },
    {
      titre: 'Article 4 — Organisation des interventions',
      paragraphes: [
        'Le Client communique au Prestataire les dates de départ des occupants, soit par la connexion de son calendrier de réservations, soit par tout autre moyen écrit.',
        'Le Client fournit les moyens d’accès au logement et informe le Prestataire de toute modification les concernant.',
      ],
    },
    {
      titre: 'Article 5 — Annulation et prolongation de séjour',
      paragraphes: [
        'Le Client peut annuler une intervention à tout moment et sans frais. Il s’engage à prévenir dès que la décision est prise.',
        `Le Client informe le Prestataire sans délai de toute prolongation de séjour ou report de la date de départ. À défaut, si l’intervenant s’est déplacé et n’a pu réaliser la prestation — logement encore occupé, accès impossible, code ou boîte à clés inopérants — des frais de déplacement de ${frais} hors taxes sont facturés, la prestation elle-même n’étant pas due.`,
        'Ces frais correspondent au coût réel d’un déplacement sans objet : trajet aller-retour et temps immobilisé de l’intervenant.',
      ],
    },
    {
      titre: 'Article 6 — Facturation et paiement',
      paragraphes: [
        'Les prestations sont facturées mensuellement, à terme échu, au début du mois suivant.',
        'Les factures sont payables à trente (30) jours date de facture.',
        'Conformément aux articles L.441-10 et D.441-5 du code de commerce, tout retard de paiement entraîne de plein droit des pénalités au taux de trois fois le taux d’intérêt légal, ainsi qu’une indemnité forfaitaire pour frais de recouvrement de quarante (40) euros, sans qu’un rappel soit nécessaire.',
      ],
    },
    {
      titre: 'Article 7 — Révision des prix',
      paragraphes: [
        'Les prix sont révisés une fois par an, avec effet au 1er janvier.',
        'Le Prestataire communique les nouveaux prix au plus tard le 30 novembre. À défaut de refus écrit du Client dans les quinze (15) jours suivant cette communication, les nouveaux prix s’appliquent.',
        'En cas de refus, chacune des parties peut résilier le contrat dans les conditions de préavis prévues à l’article 8.',
      ],
    },
    {
      titre: 'Article 8 — Durée et résiliation',
      paragraphes: [
        `Le contrat prend effet le ${dateFr(d.dateEffet)} et est conclu pour une durée indéterminée.`,
        'Chacune des parties peut y mettre fin à tout moment, par écrit, moyennant un préavis de trente (30) jours. Les interventions déjà planifiées pendant le préavis restent dues.',
      ],
    },
    {
      titre: 'Article 9 — Responsabilité, personnel et données',
      paragraphes: [
        'Le Prestataire est assuré en responsabilité civile professionnelle. Les conditions et limites de sa responsabilité, l’interdiction de sollicitation de son personnel et le traitement des données personnelles sont régis par ses conditions générales de vente.',
        'Lorsque le Client transmet des informations relatives aux occupants des logements, celles-ci ne sont utilisées que pour l’exécution des interventions et ne sont conservées que le temps nécessaire.',
      ],
    },
  ];
}

/** Rendu texte simple — pour relecture, impression ou export. */
export function contratEnTexte(d: DonneesContrat): string {
  const lignes: string[] = ['CONTRAT DE PRESTATION DE SERVICES', ''];
  for (const a of articlesContrat(d)) {
    lignes.push(a.titre, ...a.paragraphes, '');
  }
  lignes.push(
    `Fait en deux exemplaires, à compter du ${dateFr(d.dateEffet)}.`,
    'Le Prestataire',
    'Le Client (lu et approuvé)',
  );
  return lignes.join('\n');
}
