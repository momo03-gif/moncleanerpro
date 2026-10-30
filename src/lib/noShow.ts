// ── No show : le logement n'a pas été utilisé (logique PURE) ─────────────────
//
// Le cleaner arrive pour le ménage et constate que le voyageur n'est jamais
// venu : le logement est propre, il n'y a rien à faire. La mission est clôturée
// (statut « terminée » en base — aucun statut nouveau) et marquée no_show.
//
// L'ARGENT. Le client paie un forfait déplacement, le cleaner touche un forfait.
// Les deux remplacent le prix et le gain sur la mission : facturation, paie et
// rentabilité les reprennent sans code dédié, puisqu'elles lisent déjà ces deux
// champs. Les anciens montants sont gardés (no_show_prev_*) pour qu'un no show
// déclaré par erreur s'annule sans rien perdre.
//
// LA PREUVE. Côté cleaner, le serveur exige d'être sur place (GPS, même règle
// que le démarrage) et au moins une photo du logement tel qu'il a été trouvé.
// L'admin, lui, peut le déclarer sans preuve (appel du cleaner, oubli).

import type { MissionService } from './types';

export const NO_SHOW_LABEL = 'Logement non utilisé';
export const NO_SHOW_CFG = { label: 'No show', color: '#8A6BB0', bg: '#8A6BB018' };
/** Libellé du bouton : couvre les deux motifs. */
export const NO_SHOW_BOUTON = 'No show / prolongation';

// Deux motifs, même clôture et mêmes forfaits (le cleaner s'est déplacé pour
// rien) ; seuls les textes changent. En base : missions.no_show_reason
// (NULL sur les anciens = 'no_show').
export const NO_SHOW_MOTIFS = [
  { key: 'no_show', label: 'Le voyageur n’est jamais venu', titre: 'Logement non utilisé' },
  { key: 'prolongation', label: 'Le voyageur est encore là (prolongation)', titre: 'Prolongation du voyageur' },
] as const;

export type NoShowMotif = (typeof NO_SHOW_MOTIFS)[number]['key'];

export function motifNoShow(v: unknown): NoShowMotif {
  return v === 'prolongation' ? 'prolongation' : 'no_show';
}

/** « Logement non utilisé » ou « Prolongation du voyageur ». */
export function titreNoShow(v: unknown): string {
  return NO_SHOW_MOTIFS.find(m => m.key === motifNoShow(v))!.titre;
}

export const NO_SHOW_PHOTO_ERROR =
  'Ajoutez au moins une photo : le logement tel que vous l’avez trouvé, ou la porte si le voyageur est encore là. C’est la preuve de votre passage.';

/** Le no show ne concerne qu'un ménage : une livraison ou un rendez-vous n'a pas de logement à constater. */
export function noShowPossible(service: MissionService | string | null | undefined): boolean {
  const s = service ?? 'cleaning';
  return s === 'cleaning' || s === 'both';
}

export interface NoShowFees {
  /** Forfait déplacement facturé au client (€). */
  client: number;
  /** Forfait payé au cleaner (€). */
  cleaner: number;
}

const centimes = (v: number) => Math.round(Math.max(0, v) * 100) / 100;

/** Ligne mission telle que lue en base (colonnes utiles). */
interface LigneArgent {
  price?: unknown;
  cleaner_gain?: unknown;
  prestataire_id?: unknown;
  prestataire_gain?: unknown;
}

/**
 * Ce qu'on écrit sur la mission au moment du no show : clôture + forfaits, et
 * sauvegarde des montants d'avant. Un prestataire est payé au forfait cleaner,
 * comme nos cleaners.
 */
export function patchNoShow(
  m: LigneArgent, fees: NoShowFees,
  o: { at: string; by: 'cleaner' | 'admin'; note?: string | null; motif?: NoShowMotif },
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    status: 'done',
    ended_at: o.at,
    no_show: true,
    no_show_at: o.at,
    no_show_by: o.by,
    no_show_reason: o.motif ?? 'no_show',
    no_show_note: o.note?.trim() || null,
    no_show_prev_price: Number(m.price) || 0,
    no_show_prev_gain: Number(m.cleaner_gain) || 0,
    price: centimes(fees.client),
    cleaner_gain: centimes(fees.cleaner),
  };
  if (m.prestataire_id) {
    patch.no_show_prev_prestataire_gain = m.prestataire_gain != null ? Number(m.prestataire_gain) : null;
    patch.prestataire_gain = centimes(fees.cleaner);
  }
  return patch;
}

/**
 * Annulation du no show : les montants d'avant reviennent et les marques
 * s'effacent. Le statut, lui, est choisi par l'appelant (à refaire, ou en cours).
 */
export function patchAnnulerNoShow(m: {
  no_show_prev_price?: unknown; no_show_prev_gain?: unknown;
  no_show_prev_prestataire_gain?: unknown; prestataire_id?: unknown;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    no_show: false, no_show_at: null, no_show_by: null, no_show_reason: null, no_show_note: null,
    no_show_prev_price: null, no_show_prev_gain: null, no_show_prev_prestataire_gain: null,
    price: Number(m.no_show_prev_price) || 0,
    cleaner_gain: Number(m.no_show_prev_gain) || 0,
  };
  if (m.prestataire_id) {
    patch.prestataire_gain = m.no_show_prev_prestataire_gain != null ? Number(m.no_show_prev_prestataire_gain) : null;
  }
  return patch;
}
