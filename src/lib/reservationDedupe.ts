// ── Un séjour, même vu par deux calendriers, reste UN séjour ────────────────
//
//  POURQUOI CE MODULE EXISTE
//  Un logement peut porter plusieurs calendriers : c'est le cas normal du
//  propriétaire qui loue sur Airbnb, Booking et Abritel, et c'est aussi ce qui
//  arrive quand un logement connecté à un PMS garde en plus son ancien lien
//  iCal. Les deux flux décrivent alors LE MÊME séjour, avec des identifiants
//  externes différents : la déduplication par (feed_id, external_uid) ne peut
//  rien y faire, elle ne dédoublonne qu'à l'intérieur d'un flux.
//
//  Résultat visible : « 2 départs aujourd'hui » pour un seul voyageur qui s'en
//  va. Les ménages, eux, étaient déjà protégés — materializeMissions fusionne
//  les départs d'une même date en un seul ménage. C'est donc le COMPTAGE qui
//  mentait, pas le planning des interventions.
//
//  LA RÈGLE : même logement, mêmes nuits = même séjour. Un logement ne peut pas
//  être loué deux fois pour les mêmes dates ; deux lignes identiques sont donc
//  forcément le même séjour vu deux fois.
//
//  CE QU'ON GARDE des deux : la ligne la plus utile — celle qui porte déjà le
//  ménage, puis celle qui connaît les heures d'arrivée et de départ, puis la
//  plus ancienne. Jamais un panachage : on ne fabrique pas une réservation qui
//  n'a jamais existé dans aucun calendrier.

import type { Reservation } from './types';

/** Deux séjours identiques pour un même logement ne peuvent pas coexister. */
const cle = (r: Reservation) => `${r.airbnbId}|${r.checkIn}|${r.checkOut}`;

/** Ce qui rend une ligne préférable à sa jumelle, du plus décisif au moins. */
function score(r: Reservation): number {
  let n = 0;
  if (r.missionId) n += 8;              // le ménage y est rattaché
  if (r.checkOutTime) n += 4;           // heure de départ connue
  if (r.checkInTime) n += 2;            // heure d'arrivée connue
  if (r.guestName) n += 1;              // voyageur identifié
  return n;
}

/**
 * Réduit les séjours en double, en conservant l'ordre d'arrivée des éléments.
 *
 * `annulee` : une réservation annulée ne masque jamais une confirmée. Deux
 * annulées se dédoublonnent entre elles normalement.
 */
export function dedupeStays(reservations: Reservation[]): Reservation[] {
  const garde = new Map<string, Reservation>();
  const ordre: string[] = [];

  for (const r of reservations) {
    // Sans logement ni dates, on ne peut rien rapprocher : on laisse passer.
    if (!r.airbnbId || !r.checkIn || !r.checkOut) {
      const seul = `brut|${r.id}`;
      garde.set(seul, r); ordre.push(seul);
      continue;
    }

    const k = `${r.status === 'cancelled' ? 'x' : 'ok'}|${cle(r)}`;
    const deja = garde.get(k);
    if (!deja) { garde.set(k, r); ordre.push(k); continue; }

    // À égalité de richesse, la plus ancienne gagne : c'est celle que les
    // écrans affichaient déjà, et changer d'identifiant sans raison casserait
    // les liens ouverts par le partenaire.
    const mieux = score(r) > score(deja)
      || (score(r) === score(deja) && (r.createdAt ?? '') < (deja.createdAt ?? ''));
    if (mieux) garde.set(k, r);
  }

  return ordre.map(k => garde.get(k)!);
}

/**
 * Les séjours vus plusieurs fois, pour le diagnostic.
 *
 * Sert à dire à l'exploitant QUELS logements portent deux calendriers qui se
 * recouvrent — parce que masquer le doublon à l'écran ne répare pas la cause,
 * et qu'il vaut mieux débrancher le flux en trop que le corriger chaque mois.
 */
export function doublonsSejours(reservations: Reservation[]): {
  airbnbId: string; apartmentName?: string; checkIn: string; checkOut: string;
  fois: number; plateformes: string[];
}[] {
  const groupes = new Map<string, Reservation[]>();
  for (const r of reservations) {
    if (r.status === 'cancelled' || !r.airbnbId || !r.checkIn || !r.checkOut) continue;
    const k = cle(r);
    (groupes.get(k) ?? groupes.set(k, []).get(k)!).push(r);
  }

  const out = [];
  for (const rs of groupes.values()) {
    if (rs.length < 2) continue;
    out.push({
      airbnbId: rs[0].airbnbId,
      apartmentName: rs[0].apartmentName,
      checkIn: rs[0].checkIn,
      checkOut: rs[0].checkOut,
      fois: rs.length,
      plateformes: Array.from(new Set(rs.map(r => r.platform).filter(Boolean))) as string[],
    });
  }
  return out.sort((a, b) => a.checkOut.localeCompare(b.checkOut));
}

/**
 * Les séjours qui se CHEVAUCHENT sur un même logement.
 *
 * Un logement ne peut pas héberger deux voyageurs en même temps : deux séjours
 * qui se recouvrent sont donc forcément une anomalie — le plus souvent deux
 * calendriers qui décrivent les mêmes nuits avec des bornes différentes, ou un
 * flux qui exporte des périodes d'indisponibilité plutôt que des séjours.
 *
 * C'est le signal que `doublonsSejours` ne voit pas : lui ne rapproche que des
 * dates STRICTEMENT identiques, et deux bornes décalées d'un jour lui échappent.
 *
 * Un départ et une arrivée le MÊME JOUR ne sont pas un chevauchement : c'est la
 * rotation normale de la courte durée, et c'est précisément ce qui déclenche un
 * ménage. La comparaison se fait donc sur l'intervalle [arrivée, départ[.
 */
export function chevauchements(reservations: Reservation[]): {
  airbnbId: string; apartmentName?: string;
  a: { checkIn: string; checkOut: string; platform?: string; status: string };
  b: { checkIn: string; checkOut: string; platform?: string; status: string };
}[] {
  const parLogement = new Map<string, Reservation[]>();
  for (const r of reservations) {
    if (r.status === 'cancelled' || !r.airbnbId || !r.checkIn || !r.checkOut) continue;
    (parLogement.get(r.airbnbId) ?? parLogement.set(r.airbnbId, []).get(r.airbnbId)!).push(r);
  }

  const out = [];
  for (const [airbnbId, rs] of parLogement) {
    const tries = [...rs].sort((x, y) => x.checkIn.localeCompare(y.checkIn));
    for (let i = 0; i < tries.length; i++) {
      for (let j = i + 1; j < tries.length; j++) {
        const a = tries[i], b = tries[j];
        // Trié par arrivée : dès que b commence après la fin de a, aucun des
        // suivants ne peut chevaucher a non plus.
        if (b.checkIn >= a.checkOut) break;
        if (a.checkIn >= b.checkOut) continue;
        out.push({
          airbnbId,
          apartmentName: a.apartmentName ?? b.apartmentName,
          a: { checkIn: a.checkIn, checkOut: a.checkOut, platform: a.platform, status: a.status },
          b: { checkIn: b.checkIn, checkOut: b.checkOut, platform: b.platform, status: b.status },
        });
      }
    }
  }
  return out.sort((x, y) => x.a.checkIn.localeCompare(y.a.checkIn));
}

/** Une occupation du logement, telle qu'un calendrier la décrit. */
export interface Occupation {
  feedId?: string;
  checkIn: string;
  checkOut: string;
}

/**
 * Un départ est-il crédible, sachant ce que disent les AUTRES calendriers ?
 *
 * Deux calendriers décrivent souvent le même séjour avec des bornes
 * différentes : Airbnb ferme les dates vendues sur Booking, mais s'arrête
 * parfois une nuit trop tôt. Prendre la borne la plus courte, c'est envoyer
 * l'intervenant pendant que le voyageur est encore là — la pire erreur
 * possible, bien pire qu'un ménage oublié.
 *
 * La règle : un départ annoncé STRICTEMENT à l'intérieur d'une occupation
 * décrite par un AUTRE calendrier n'est pas un départ. Le vrai se produira à la
 * fin de la période la plus longue.
 *
 * « Un autre calendrier » compte : deux lignes du MÊME flux qui se contredisent
 * sont une incohérence de la plateforme, qu'on n'arbitre pas — sinon un flux
 * qui exporte des périodes larges effacerait les rotations qu'il contient.
 */
export function departCredible(
  depart: { feedId?: string; date: string },
  occupations: Occupation[],
): boolean {
  return !occupations.some(o =>
    o.feedId !== depart.feedId          // un autre calendrier, pas le même
    && o.checkIn < depart.date          // l'occupation a commencé avant
    && depart.date < o.checkOut,        // et ne se termine pas ce jour-là
  );
}
