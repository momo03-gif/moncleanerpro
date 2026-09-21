// ── Deux calendriers qui racontent la même chose (logique PURE) ─────────────
//
//  CE QU'ON A VU EN VRAI
//  Un logement était relié à Hostify — qui centralise déjà Airbnb ET Booking —
//  et gardait en plus son ancien lien iCal Airbnb. Le même séjour arrivait donc
//  deux fois, et les départs se comptaient double sur le tableau de bord.
//
//  La déduplication par (feed_id, external_uid) ne peut rien y faire : les deux
//  flux donnent au séjour des identifiants différents. Et `dedupeStays` répare
//  l'affichage sans débrancher la cause — à chaque import, le doublon revient.
//
//  LA RÈGLE, ÉNONCÉE UNE FOIS :
//  un PMS est un agrégateur. S'il est branché sur un logement, les plateformes
//  qu'il redistribue (Airbnb, Booking, Abritel…) n'ont plus à être connectées
//  en direct sur CE logement.
//
//  ON AVERTIT, ON N'INTERDIT PAS. Il existe un cas légitime : une annonce que
//  le propriétaire gère hors de son PMS. C'est rare, c'est son choix, et lui
//  refuser la connexion serait décider à sa place. En revanche, le laisser
//  découvrir le doublon un mois plus tard dans ses chiffres, non.

import { findPms, platformLabel, type SourceKind } from './registry';

export interface FluxExistant {
  platform?: string | null;
  active?: boolean | null;
}

function genre(platform?: string | null): SourceKind | undefined {
  return findPms(platform)?.kind;
}

/**
 * Le message à montrer avant d'ajouter `nouvellePlateforme` sur un logement qui
 * porte déjà `existants`. `null` = rien à signaler.
 */
export function conflitCalendrier(
  existants: FluxExistant[],
  nouvellePlateforme: string | null | undefined,
): string | null {
  const actifs = (existants ?? []).filter(f => f.active !== false);
  const nouveau = genre(nouvellePlateforme);

  // 1) On ajoute une place de marché alors qu'un PMS est déjà branché.
  if (nouveau === 'marketplace') {
    const pms = actifs.find(f => genre(f.platform) === 'pms');
    if (pms) {
      return `Ce logement est déjà relié à ${platformLabel(pms.platform)}, qui centralise `
        + `les réservations de toutes vos plateformes. Ajouter ${platformLabel(nouvellePlateforme)} `
        + `en direct fera arriver les mêmes séjours deux fois, et vos départs seront comptés double. `
        + `À ne faire que si cette annonce est gérée en dehors de ${platformLabel(pms.platform)}.`;
    }
  }

  // 2) On branche un PMS alors que ses plateformes sont déjà là en direct.
  if (nouveau === 'pms') {
    const places = actifs.filter(f => genre(f.platform) === 'marketplace');
    if (places.length > 0) {
      const noms = Array.from(new Set(places.map(f => platformLabel(f.platform)))).join(' et ');
      return `${platformLabel(nouvellePlateforme)} centralise déjà vos réservations. `
        + `Ce logement a encore ${noms} en direct : une fois la connexion faite, `
        + `retirez ${places.length > 1 ? 'ces calendriers' : 'ce calendrier'} pour ne pas `
        + `recevoir chaque séjour deux fois.`;
    }
  }

  // 3) Deux PMS sur un même logement : il n'y a aucune raison valable.
  if (nouveau === 'pms') {
    const autre = actifs.find(f => genre(f.platform) === 'pms' && f.platform !== nouvellePlateforme);
    if (autre) {
      return `Ce logement est déjà relié à ${platformLabel(autre.platform)}. Deux logiciels de `
        + `gestion sur le même logement donneront systématiquement des séjours en double.`;
    }
  }

  return null;
}
