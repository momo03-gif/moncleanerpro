// ── Mouvements du jour : départs et arrivées (logique pure) ─────────────────
//
// L'écran Réservations doit répondre d'un coup d'œil à « qui part, qui arrive,
// et quand ? ». Un logement où un voyageur part et un autre arrive le MÊME jour
// est un seul mouvement — le plus serré de la journée, le ménage tient entre
// les deux — et non deux lignes éloignées l'une de l'autre.

import type { Reservation } from './types';
import { occupationsReelles } from './reservationDedupe';

export type TypeMouvement = 'enchainement' | 'depart' | 'arrivee';

export interface Mouvement {
  type: TypeMouvement;
  airbnbId: string;
  logement: string;
  depart?: Reservation;
  arrivee?: Reservation;
}

export interface JourMouvements {
  jour: string;
  mouvements: Mouvement[];
  departs: number;       // départs, enchaînements compris
  arrivees: number;      // arrivées, enchaînements compris
  sansMenage: number;    // départs confirmés sans ménage créé
}

const ORDRE: Record<TypeMouvement, number> = { enchainement: 0, depart: 1, arrivee: 2 };

/**
 * Les mouvements à partir d'aujourd'hui, jour par jour — avec la MÊME règle que
 * le moteur de synchro (occupationsReelles) : un séjour confirmé, ou une date
 * fermée sur BOOKING (même intitulé pour un séjour et une fermeture, c'est
 * l'exploitant qui tranche), sans les fermetures qui recopient un séjour vendu
 * ailleurs. Une date fermée sur Airbnb ou un logiciel n'est jamais un séjour :
 * personne ne part, personne n'arrive. S'y ajoutent les séjours à confirmer.
 * Une arrivée ne compte que si elle est confirmée ou à confirmer.
 */
export function mouvementsParJour(reservations: Reservation[], aujourdhui: string): JourMouvements[] {
  const parCle = new Map<string, Mouvement>();
  const cle = (r: Reservation, jour: string) => `${jour}|${r.airbnbId}`;
  const logement = (r: Reservation) => r.apartmentName ?? '—';
  const retenues = [
    ...occupationsReelles(reservations),
    ...reservations.filter(r => r.status === 'tentative'),
  ];

  for (const r of retenues) {
    if (r.checkOut >= aujourdhui) {
      const k = cle(r, r.checkOut);
      const m = parCle.get(k) ?? { type: 'depart' as TypeMouvement, airbnbId: r.airbnbId, logement: logement(r) };
      // Deux départs le même jour sur le même logement : on garde le plus tardif
      // (le ménage ne peut pas commencer avant).
      if (!m.depart || (r.checkOutTime ?? '') > (m.depart.checkOutTime ?? '')) m.depart = r;
      parCle.set(k, m);
    }
    if (r.checkIn >= aujourdhui && (r.status === 'confirmed' || r.status === 'tentative')) {
      const k = cle(r, r.checkIn);
      const m = parCle.get(k) ?? { type: 'arrivee' as TypeMouvement, airbnbId: r.airbnbId, logement: logement(r) };
      // Deux arrivées : la plus tôt fait foi (le ménage doit être fini avant).
      if (!m.arrivee || (r.checkInTime ?? '99') < (m.arrivee.checkInTime ?? '99')) m.arrivee = r;
      parCle.set(k, m);
    }
  }

  const parJour = new Map<string, Mouvement[]>();
  for (const [k, m] of parCle) {
    m.type = m.depart && m.arrivee ? 'enchainement' : m.depart ? 'depart' : 'arrivee';
    const jour = k.slice(0, 10);
    const l = parJour.get(jour) ?? [];
    l.push(m);
    parJour.set(jour, l);
  }

  return [...parJour.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([jour, mouvements]) => {
      mouvements.sort((a, b) => ORDRE[a.type] - ORDRE[b.type]
        || (a.depart?.checkOutTime ?? a.arrivee?.checkInTime ?? '').localeCompare(b.depart?.checkOutTime ?? b.arrivee?.checkInTime ?? '')
        || a.logement.localeCompare(b.logement, 'fr'));
      return {
        jour,
        mouvements,
        departs: mouvements.filter(m => m.depart).length,
        arrivees: mouvements.filter(m => m.arrivee).length,
        sansMenage: mouvements.filter(m => m.depart?.status === 'confirmed' && !m.depart.missionId).length,
      };
    });
}

/** « 3 voyageurs », « 1 voyageur » — ou rien si le calendrier ne le dit pas. */
export function libelleVoyageurs(n?: number): string | null {
  if (!n) return null;
  return `${n} voyageur${n > 1 ? 's' : ''}`;
}
