// ── Le logo d'une conciergerie ───────────────────────────────────────────────
//
//  La fiche d'accueil est posée chez un voyageur : elle porte le nom et les
//  couleurs de la conciergerie, pas les nôtres. C'est son accueil, pas notre
//  prestation — et c'est aussi ce qui la rend présentable à ses propriétaires.
//
//  Le fichier vit dans le Storage. On ne garde en base que son adresse publique
//  et son chemin, ce dernier servant à supprimer l'ancien quand on en envoie un
//  nouveau : sans ça, chaque remplacement laisserait un fichier orphelin sur un
//  plan gratuit déjà étroit.

import { annexe } from './db/shared';
import { deposerFichier } from './depot';

export const LOGOS_BUCKET = 'logos';

// Un logo de fiche s'affiche sur 56 pixels de haut : au-delà de deux méga-
// octets, on transporte une image que personne ne verra jamais en entier.
export const MAX_LOGO_MB = 2;

export interface LogoResult { error: string | null; url?: string | null }

/** Les formats qu'un navigateur affiche à coup sûr, à l'écran comme à l'impression. */
const FORMATS = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export async function uploadLogoPartenaire(_userId: string, file: File): Promise<LogoResult> {
  if (!FORMATS.includes(file.type)) {
    return { error: 'Formats acceptés : PNG, JPEG, WebP ou SVG.' };
  }
  const mo = file.size / (1024 * 1024);
  if (mo > MAX_LOGO_MB) {
    return { error: `Logo trop lourd (${mo.toFixed(1)} Mo). Maximum ${MAX_LOGO_MB} Mo.` };
  }

  // Dépôt autorisé par le serveur, pour la conciergerie connectée uniquement ;
  // l'enregistrement remplace l'ancien logo et supprime son fichier.
  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const depot = await deposerFichier('logo', { ext }, file, file.type);
  if (depot.error !== null) {
    console.error('uploadLogoPartenaire storage:', depot.error);
    return { error: depot.error.includes('Bucket not found')
      ? 'Le dossier « logos » n’existe pas encore dans Supabase Storage.'
      : depot.error };
  }
  try {
    const res = await annexe('logo-set', { path: depot.path });
    return { error: null, url: res.url as string };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Enregistrement impossible.' };
  }
}

/** Le logo d'une conciergerie, s'il y en a un. */
export async function getLogoPartenaire(_userId: string): Promise<string | null> {
  // Celui de la conciergerie connectée (la table des comptes n'est pas publique).
  try { return ((await annexe('logo-get')).url as string | null) ?? null; }
  catch { return null; }
}
