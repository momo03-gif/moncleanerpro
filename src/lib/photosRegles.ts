// ── Photos de ménage : les règles, partagées serveur / écran ────────────────
//
// Les photos « après » sont la preuve du travail rendu. Elles étaient
// facultatives et cachées dans un panneau fermé : sur deux semaines, un seul
// cleaner en prenait. Elles sont désormais OBLIGATOIRES pour terminer un
// ménage (vérifié par le serveur). Même constat pour les livraisons (aucune
// photo sur 478 en deux mois, 11/11/2026) : une photo du dépôt est exigée pour
// « Marquer comme livré ». Pas les rendez-vous ; l'admin peut toujours
// clôturer une mission lui-même.
//
// Depuis oct. 2026, on ne prend PLUS de photos « avant » : uniquement des
// photos « après », jusqu'à 16. Les anciennes photos « avant » restent
// affichées ; toute nouvelle photo est enregistrée en « après » par le serveur.

import type { MissionService } from './types';

export const PHOTOS_APRES_MIN = 1;
export const MAX_PHOTOS_APRES = 16;

export const PHOTOS_REQUISES_ERROR =
  'Ajoutez au moins une photo « après » pour terminer : c’est la preuve du travail rendu.';

/** Une seule limite : toute nouvelle photo est une photo « après ». */
export function maxPhotos(): number {
  return MAX_PHOTOS_APRES;
}

/** Un ménage (seul ou avec livraison) et une livraison exigent une photo « après » ; pas un rendez-vous. */
export function photosApresExigees(service: MissionService | string | null | undefined): boolean {
  const s = service ?? 'cleaning';
  return s === 'cleaning' || s === 'both' || s === 'delivery';
}
