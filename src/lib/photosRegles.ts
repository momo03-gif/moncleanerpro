// ── Photos de ménage : les règles, partagées serveur / écran ────────────────
//
// Les photos « après » sont la preuve du travail rendu. Elles étaient
// facultatives et cachées dans un panneau fermé : sur deux semaines, un seul
// cleaner en prenait. Elles sont désormais OBLIGATOIRES pour terminer un
// ménage (vérifié par le serveur). Les livraisons et les rendez-vous ne sont
// pas concernés ; l'admin peut toujours clôturer une mission lui-même.
//
// Limites SÉPARÉES : des photos « avant » ne doivent jamais empêcher d'ajouter
// les photos « après » exigées (l'ancienne limite de 8 était commune).

import type { MissionPhotoKind, MissionService } from './types';

export const PHOTOS_APRES_MIN = 1;
export const MAX_PHOTOS_APRES = 8;
export const MAX_PHOTOS_AVANT = 4;

export const PHOTOS_REQUISES_ERROR =
  'Ajoutez au moins une photo « après » pour terminer le ménage : c’est la preuve du travail rendu.';

export function maxPhotos(kind: MissionPhotoKind): number {
  return kind === 'before' ? MAX_PHOTOS_AVANT : MAX_PHOTOS_APRES;
}

/** Un ménage (seul ou avec livraison) exige des photos « après » ; pas une livraison ni un rendez-vous. */
export function photosApresExigees(service: MissionService | string | null | undefined): boolean {
  const s = service ?? 'cleaning';
  return s === 'cleaning' || s === 'both';
}
