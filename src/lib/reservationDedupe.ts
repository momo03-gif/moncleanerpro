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
