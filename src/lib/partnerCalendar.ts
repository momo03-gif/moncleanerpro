// ── Multi-calendrier de la conciergerie (logique PURE, sans I/O) ──────────────
//
// Une ligne par logement, une colonne par jour : la vue que les PMS appellent
// « multi-calendar ». Elle répond d'un coup d'œil à « qui part, qui arrive, et
// où en est le ménage ? », ce que trois listes séparées ne font pas.
//
// Convention d'occupation : un séjour occupe les nuits de checkIn (inclus) à
// checkOut (exclu). Le jour du départ n'est donc PAS occupé — c'est le jour du
// ménage, et éventuellement de l'arrivée suivante (turnover).
//
// UNE LIVRAISON N'EST PAS UN MÉNAGE, et ici l'erreur coûtait cher : une
// livraison posée le jour d'un départ remplissait la case « ménage », et
// `departuresWithoutCleaning` ne signalait plus le départ non couvert. La
// conciergerie croyait son logement pris en charge alors que personne ne
// venait le nettoyer. La livraison est donc marquée à part.

import type { Apartment, Mission, Reservation } from './types';
import { estOccupation } from './reservationDedupe';
import { serviceParts } from './service';

export interface CalendarCell {
  day: string;             // YYYY-MM-DD
  occupied: boolean;       // une nuit est occupée
  arrival: boolean;        // un voyageur arrive ce jour
  departure: boolean;      // un voyageur part ce jour
  turnover: boolean;       // départ ET arrivée le même jour
  arrivalTime?: string;    // HH:MM quand la plateforme le fournit
  departureTime?: string;  // HH:MM du départ
  missionId?: string;
  missionStatus?: string;
  missionTime?: string;    // heure prévue du ménage
  cleanerName?: string;    // intervenant assigné (vide = pas encore assigné)
  delivery?: boolean;      // une livraison est prévue ce jour (jamais un ménage)
  // Quelle plateforme occupe la nuit. Un hôte qui vend sur Airbnb ET sur
  // Booking ne peut pas se souvenir de qui a réservé quoi : sans cette
  // information, il doit rouvrir les deux extranets pour répondre à un
  // voyageur ou corriger une date. Plusieurs plateformes le même jour = ses
  // calendriers se contredisent, et ça se voit alors sur la case.
  platforms?: string[];
}

export interface CalendarRow {
  apartmentId: string;
  apartmentName: string;
  cells: CalendarCell[];
}

/** Suite de N jours à partir d'une date (format YYYY-MM-DD, calendrier local). */
export function dayRange(start: string, count: number): string[] {
  const out: string[] = [];
  const d = new Date(start + 'T00:00:00');
  for (let i = 0; i < count; i++) {
    out.push(d.toLocaleDateString('en-CA'));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * Construit la grille logements × jours.
 * Les réservations annulées et les missions annulées sont ignorées : elles ne
 * doivent pas colorer le calendrier ni faire croire à un ménage prévu.
 */
export function buildCalendar(
  apartments: Apartment[],
  reservations: Reservation[],
  missions: Mission[],
  start: string,
  count: number,
): CalendarRow[] {
  const days = dayRange(start, count);
  // LA définition de l'occupation, partagée avec le moteur et les autres écrans.
  // Filtrer sur « confirmé » laissait le calendrier vide pendant un séjour vendu
  // sur Booking — qui n'étiquette pas ses séjours comme des réservations. La
  // conciergerie voyait son logement libre alors qu'un voyageur y était.
  const confirmed = reservations.filter(estOccupation);

  return apartments.map(apt => {
    const stays = confirmed.filter(r => r.airbnbId === apt.id);
    const aptMissions = missions.filter(m => m.airbnbId === apt.id && m.status !== 'cancelled');
    // La case « ménage » ne retient que les interventions qui nettoient.
    const aptMenages = aptMissions.filter(m => serviceParts(m.service).cleaning);
    const aptLivraisons = aptMissions.filter(m => !serviceParts(m.service).cleaning && serviceParts(m.service).delivery);

    const cells = days.map<CalendarCell>(day => {
      const arrivalStay = stays.find(r => r.checkIn === day);
      const departureStay = stays.find(r => r.checkOut === day);
      const occupantes = stays.filter(r => r.checkIn <= day && r.checkOut > day);
      const occupied = occupantes.length > 0;
      const mission = aptMenages.find(m => m.date === day);
      const platforms = Array.from(new Set(
        occupantes.map(r => r.platform).filter(Boolean) as string[],
      )).sort();
      return {
        day,
        occupied,
        platforms: platforms.length ? platforms : undefined,
        arrival: !!arrivalStay,
        departure: !!departureStay,
        turnover: !!arrivalStay && !!departureStay,
        arrivalTime: arrivalStay?.checkInTime || undefined,
        departureTime: departureStay?.checkOutTime || undefined,
        missionId: mission?.id,
        missionStatus: mission?.status,
        missionTime: mission?.time || undefined,
        cleanerName: mission?.cleanerName || undefined,
        delivery: aptLivraisons.some(m => m.date === day) || undefined,
      };
    });

    return { apartmentId: apt.id, apartmentName: apt.name, cells };
  });
}

/** Compteurs d'un jour, toutes lignes confondues (bandeau de résumé). */
export function daySummary(rows: CalendarRow[], day: string) {
  let arrivals = 0, departures = 0, turnovers = 0, cleanings = 0, cleaningsDone = 0, deliveries = 0;
  for (const row of rows) {
    const cell = row.cells.find(c => c.day === day);
    if (!cell) continue;
    if (cell.arrival) arrivals++;
    if (cell.departure) departures++;
    if (cell.turnover) turnovers++;
    if (cell.missionId) {
      cleanings++;
      if (cell.missionStatus === 'completed') cleaningsDone++;
    }
    if (cell.delivery) deliveries++;
  }
  return { arrivals, departures, turnovers, cleanings, cleaningsDone, deliveries };
}

/** Départs sans ménage prévu sur la période — le trou qui coûte cher. */
export function departuresWithoutCleaning(rows: CalendarRow[]): { apartmentName: string; day: string }[] {
  const out: { apartmentName: string; day: string }[] = [];
  for (const row of rows) {
    for (const cell of row.cells) {
      if (cell.departure && !cell.missionId) out.push({ apartmentName: row.apartmentName, day: cell.day });
    }
  }
  return out;
}
