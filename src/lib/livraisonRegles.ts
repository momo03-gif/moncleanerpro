// ── Livraison créée avec son ménage : la règle (logique pure) ───────────────
// Cf. livraisonAuto.ts pour le pourquoi et les écritures.

/** Durée prévue d'une livraison (le livreur est payé au forfait, cf. pay.ts). */
export const DUREE_LIVRAISON_MIN = 30;

export interface MenagePourLivraison {
  id: string;
  airbnb_id: string | null;
  partner_id?: string | null;
  date_from: string;
  time_from?: string | null;
  service?: string | null;
  status?: string | null;
}

/**
 * Les ménages qui doivent recevoir une livraison : un MÉNAGE seul (« both »
 * inclut déjà la livraison), pas annulé, sur un logement qui en a besoin, et
 * sans livraison déjà prévue ce jour-là sur ce logement — qu'elle soit liée à ce
 * ménage ou créée à la main. Une seule livraison par logement et par jour.
 */
export function livraisonsACreer(
  menages: MenagePourLivraison[],
  logementsAvecLivraison: Set<string>,
  existantes: { airbnb_id: string | null; date_from: string; linked_mission_id?: string | null }[],
): MenagePourLivraison[] {
  const pris = new Set(existantes.map(l => `${l.airbnb_id}|${l.date_from}`));
  const liees = new Set(existantes.map(l => l.linked_mission_id).filter(Boolean));
  const out: MenagePourLivraison[] = [];
  for (const m of menages) {
    if (!m.airbnb_id || !logementsAvecLivraison.has(m.airbnb_id)) continue;
    if ((m.service ?? 'cleaning') !== 'cleaning') continue;
    if (m.status === 'cancelled') continue;
    const cle = `${m.airbnb_id}|${m.date_from}`;
    if (pris.has(cle) || liees.has(m.id)) continue;
    pris.add(cle);
    out.push(m);
  }
  return out;
}
