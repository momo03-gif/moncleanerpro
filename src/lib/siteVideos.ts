import { supabase } from './supabase';

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

// Récupère les URL de vidéo d'accès pour une liste de sites, en UNE requête.
// RÉSILIENT : si la colonne access_video_url n'existe pas encore (migration non
// exécutée) ou en cas d'erreur, renvoie une map vide → la fonctionnalité est
// simplement inactive, SANS jamais casser le reste (ex. l'affichage des missions).
export async function getSiteVideosMap(airbnbIds: string[]): Promise<Record<string, string>> {
  const ids = Array.from(new Set(airbnbIds.filter(Boolean)));
  if (ids.length === 0) return {};
  try {
    const { data, error } = await supabase
      .from('airbnbs').select('id, access_video_url').in('id', ids);
    if (error) return {};
    const map: Record<string, string> = {};
    for (const r of data ?? []) {
      const url = (r as { access_video_url?: string }).access_video_url;
      if (url) map[(r as { id: string }).id] = url;
    }
    return map;
  } catch {
    return {};
  }
}

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

  // Supprime d'abord l'ancien fichier (une seule vidéo par site).
  const { data: existing } = await supabase
    .from('airbnbs').select('access_video_path').eq('id', airbnbId).maybeSingle();
  const oldPath = existing?.access_video_path as string | null | undefined;

  const ext = (file.name.split('.').pop() || 'mp4').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${airbnbId}/access-${Date.now()}-${rand}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(SITE_VIDEOS_BUCKET)
    .upload(path, file, { contentType: file.type || 'video/mp4', upsert: false });
  if (upErr) { console.error('uploadSiteVideoDB storage:', upErr.message); return { error: upErr.message }; }

  const { data: pub } = supabase.storage.from(SITE_VIDEOS_BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  const { error } = await supabase.from('airbnbs')
    .update({ access_video_url: url, access_video_path: path })
    .eq('id', airbnbId);
  if (error) {
    // Rollback du fichier orphelin si l'enregistrement échoue.
    await supabase.storage.from(SITE_VIDEOS_BUCKET).remove([path]);
    console.error('uploadSiteVideoDB update:', error.message);
    return { error: error.message };
  }

  // Nettoyage de l'ancien fichier (best-effort) après remplacement réussi.
  if (oldPath && oldPath !== path) {
    await supabase.storage.from(SITE_VIDEOS_BUCKET).remove([oldPath]).catch(() => {});
  }
  return { error: null, url };
}

// Supprime la vidéo d'accès d'un site (fichier + référence).
export async function removeSiteVideoDB(airbnbId: string): Promise<SiteVideoResult> {
  const { data: existing } = await supabase
    .from('airbnbs').select('access_video_path').eq('id', airbnbId).maybeSingle();
  const path = existing?.access_video_path as string | null | undefined;

  if (path) {
    const { error: rmErr } = await supabase.storage.from(SITE_VIDEOS_BUCKET).remove([path]);
    if (rmErr) console.error('removeSiteVideoDB storage:', rmErr.message);
  }
  const { error } = await supabase.from('airbnbs')
    .update({ access_video_url: null, access_video_path: null })
    .eq('id', airbnbId);
  if (error) { console.error('removeSiteVideoDB update:', error.message); return { error: error.message }; }
  return { error: null, url: null };
}
