// ── Logiciels de gestion pris en charge ───────────────────────────────────────
//
// Deux voies pour brancher un logiciel de la conciergerie :
//
//   · LE LIEN iCAL — universel. Tous les logiciels de location saisonnière
//     savent exporter un calendrier. C'est la réponse à « n'importe quel
//     logiciel » : il n'y a aucun cas où ça ne marche pas.
//     Limite : des dates seulement.
//
//   · LA CLÉ API — apporte en plus les heures d'arrivée et de départ (donc les
//     départs tardifs), le nom du voyageur et le nombre de personnes. Mais
//     chaque éditeur a sa propre API : il faut un connecteur par logiciel.
//
// Ce fichier est la source de vérité de ce qui est réellement branché. L'écran
// de connexion le lit : on n'y propose jamais une API qu'on ne sait pas parler,
// et on renvoie honnêtement vers l'iCal dans le cas contraire.
//
// Ajouter un logiciel = un connecteur dans ce dossier + une ligne ici.

export interface PmsCredentialField {
  name: 'apiKey' | 'apiSecret';
  label: string;
  secret?: boolean;   // masqué à la saisie
}

export interface PmsDefinition {
  id: string;
  label: string;
  /** Où trouver le lien d'export iCal (toujours disponible). */
  icalHelp: string;
  /** Connexion API : false tant qu'aucun connecteur n'existe. */
  api: false | {
    fields: PmsCredentialField[];
    /** Où générer la clé, dans les mots de l'éditeur. */
    help: string;
  };
}

export const PMS_LIST: PmsDefinition[] = [
  {
    id: 'smoobu',
    label: 'Smoobu',
    icalHelp: 'Smoobu → Logement → Channel manager → Exporter (iCal).',
    api: {
      fields: [
        { name: 'apiKey', label: 'Clé API (usr_live_…)' },
        { name: 'apiSecret', label: 'Secret', secret: true },
      ],
      help: 'Smoobu → Paramètres → API. Générez une clé, copiez la clé et le secret.',
    },
  },
  // Les suivants ont une API, mais leur documentation n'est pas publique : il
  // faut un compte (ou une clé de test) pour écrire le connecteur sans deviner.
  // En attendant, l'iCal fonctionne parfaitement avec eux.
  {
    id: 'beds24',
    label: 'Beds24',
    icalHelp: 'Beds24 → Settings → Sync → Export calendar (iCal).',
    api: false,
  },
  {
    id: 'hostaway',
    label: 'Hostaway',
    icalHelp: 'Hostaway → Listing → Channel Manager → iCal export.',
    api: false,
  },
  {
    id: 'hostify',
    label: 'Hostify',
    icalHelp: 'Hostify → Logement → Calendrier → lien d’export iCal.',
    api: false,
  },
  {
    id: 'superhote',
    label: 'Superhote',
    icalHelp: 'Superhote → Logement → Synchronisation → lien iCal.',
    api: false,
  },
  {
    id: 'lodgify',
    label: 'Lodgify',
    icalHelp: 'Lodgify → Calendar → Import/Export → Export calendar (.ics).',
    api: false,
  },
  {
    id: 'guesty',
    label: 'Guesty',
    icalHelp: 'Guesty → Listing → Calendar → iCal export link.',
    api: false,
  },
  {
    id: 'amenitiz',
    label: 'Amenitiz',
    icalHelp: 'Amenitiz → Channel manager → Synchronisation iCal → lien d’export.',
    api: false,
  },
];

export function findPms(id: string | null | undefined): PmsDefinition | undefined {
  return PMS_LIST.find(p => p.id === id);
}

/** Logiciels avec lesquels on sait parler par API (les seuls proposés à l'écran). */
export function pmsWithApi(): PmsDefinition[] {
  return PMS_LIST.filter(p => p.api !== false);
}

/** La connexion API est-elle réellement branchée pour ce logiciel ? */
export function supportsApi(id: string | null | undefined): boolean {
  return findPms(id)?.api !== false && !!findPms(id);
}
