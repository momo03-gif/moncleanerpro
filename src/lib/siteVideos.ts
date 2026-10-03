import { annexe } from './db/shared';
import { deposerFichier } from './depot';

// ════════════════════════════════════════════════════════════════════════════
//  Vidéo d'accès d'un site (logement) : comment s'y rendre / trouver la clé /
//  entrer. UNE seule vidéo par site, remplaçable et supprimable à tout moment.
//
//  Économe pour le plan GRATUIT Supabase :
//   • La base ne stocke qu'une URL (texte) → aucun poids en base.
//   • Remplacer une vidéo SUPPRIME l'ancienne → le stockage ne gonfle jamais
//     (au plus 1 fichier par site).
//   • Taille plafonnée (MAX_VIDEO_MB) → on garde des clips courts et légers.
//   • Côté lecture : la vidéo n'est téléchargée QUE si l'utilisateur la lance
//     (composant avec chargement à la demande) → pas de bande passante gaspillée.
// ════════════════════════════════════════════════════════════════════════════

export const SITE_VIDEOS_BUCKET = 'site_videos';

// Plafond volontairement bas (plan gratuit) : une vidéo d'accès n'a besoin que de
// quelques secondes. Au-delà, on refuse avec un message clair.
export const MAX_VIDEO_MB = 30;

export interface SiteVideoResult {
  error: string | null;
  url?: string | null;
}

// Téléverse (ou remplace) la vidéo d'accès d'un site. L'ancienne, s'il y en a une,
// est supprimée du Storage avant l'envoi de la nouvelle.
export async function uploadSiteVideoDB(airbnbId: string, file: File): Promise<SiteVideoResult> {
  if (!file.type.startsWith('video/')) {
    return { error: 'Merci de choisir un fichier vidéo.' };
  }
  const sizeMb = file.size / (1024 * 1024);
  if (sizeMb > MAX_VIDEO_MB) {
    return { error: `Vidéo trop lourde (${sizeMb.toFixed(0)} Mo). Maximum ${MAX_VIDEO_MB} Mo — filmez plus court.` };
  }

  // Dépôt autorisé par le serveur (admin, ou conciergerie du logement) ;
  // l'enregistrement remplace l'ancienne vidéo et supprime son fichier.
  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const depot = await deposerFichier('site-video', { airbnbId, ext }, file, file.type || 'video/mp4');
  if (depot.error !== null) { console.error('uploadSiteVideoDB storage:', depot.error); return { error: depot.error }; }
  try {
    const res = await annexe('site-video-set', { airbnbId, path: depot.path });
    return { error: null, url: res.url as string };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Enregistrement impossible.' };
  }
}

// Supprime la vidéo d'accès d'un site (fichier + référence).
export async function removeSiteVideoDB(airbnbId: string): Promise<SiteVideoResult> {
  try { await annexe('site-video-remove', { airbnbId }); return { error: null, url: null }; }
  catch (e) { return { error: e instanceof Error ? e.message : 'Suppression impossible.' }; }
}
