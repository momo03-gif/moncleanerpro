// ── Performance par logement (logique PURE, sans I/O) ─────────────────────────
//
// Les PMS affichent des KPI d'exploitation (ménages, coût, retards). On garde
// les chiffres qu'une conciergerie utilise vraiment pour arbitrer :
//   · combien de ménages et pour quel coût,
//   · combien de turnovers absorbés (les journées tendues),
//   · la qualité perçue (note moyenne qu'ELLE a donnée),
//   · ce qui traîne (réparations ouvertes).
//
// UNE LIVRAISON N'EST PAS UN MÉNAGE. Elle se produit bien dans le logement,
// mais elle n'est pas facturée au client et ne remplace aucun passage de
// ménage. La compter avec les ménages gonflait le nombre d'interventions
// annoncé à la conciergerie, et lui faisait croire qu'un départ était couvert.
//
// Volontairement ABSENT : tout indicateur de durée ou de ponctualité horaire du
// ménage. Le temps de travail est interne (il pilote la paie) et le client n'a
// pas à le reconstituer — c'est l'admin qui suit ça, cf. stripInternalForPartner.

import type { Apartment, Mission, Repair } from './types';
import { serviceParts } from './service';

export interface ApartmentStats {
  apartmentId: string;
  apartmentName: string;
  cleanings: number;
  cost: number;
  /** Livraisons du mois — comptées à part, jamais facturées au client. */
  deliveries: number;
  /** Ménages faits un jour où un voyageur arrivait (journées tendues). */
  turnovers: number;
  /** Note moyenne donnée par la conciergerie. null = aucun ménage noté. */
  avgRating: number | null;
  ratedCount: number;
  openRepairs: number;
}

/**
 * Statistiques du mois `month` (YYYY-MM) pour chaque logement.
 * Seuls les ménages TERMINÉS comptent : un ménage annulé n'a ni coûté ni servi.
 */
export function apartmentStats(
  apartments: Apartment[],
  missions: Mission[],
  repairs: Repair[],
  month: string,
): ApartmentStats[] {
  return apartments.map(apt => {
    const duMois = missions.filter(m =>
      m.airbnbId === apt.id && m.status === 'completed' && m.date.startsWith(month));
    const done = duMois.filter(m => serviceParts(m.service).cleaning);
    const livraisons = duMois.filter(m => !serviceParts(m.service).cleaning && serviceParts(m.service).delivery);

    const rated = done.filter(m => m.partnerRating != null);
    const avg = rated.length
      ? Math.round((rated.reduce((s, m) => s + (m.partnerRating ?? 0), 0) / rated.length) * 10) / 10
      : null;

    return {
      apartmentId: apt.id,
      apartmentName: apt.name,
      cleanings: done.length,
      cost: Math.round(done.reduce((s, m) => s + (m.price || 0), 0)),
      deliveries: livraisons.length,
      turnovers: done.filter(m => m.nextArrival === m.date).length,
      avgRating: avg,
      ratedCount: rated.length,
      openRepairs: repairs.filter(r => r.airbnbId === apt.id && r.status === 'open').length,
    };
  });
}

/** Cumul tous logements — l'en-tête de la vue performance. */
export function totalStats(rows: ApartmentStats[]) {
  const cleanings = rows.reduce((s, r) => s + r.cleanings, 0);
  const cost = rows.reduce((s, r) => s + r.cost, 0);
  const deliveries = rows.reduce((s, r) => s + r.deliveries, 0);
  const openRepairs = rows.reduce((s, r) => s + r.openRepairs, 0);
  const turnovers = rows.reduce((s, r) => s + r.turnovers, 0);

  // Moyenne pondérée : un logement avec 12 ménages notés pèse plus qu'un avec 1.
  const ratedCount = rows.reduce((s, r) => s + r.ratedCount, 0);
  const ratingSum = rows.reduce((s, r) => s + (r.avgRating ?? 0) * r.ratedCount, 0);

  return {
    cleanings,
    cost,
    deliveries,
    turnovers,
    openRepairs,
    avgRating: ratedCount > 0 ? Math.round((ratingSum / ratedCount) * 10) / 10 : null,
  };
}
