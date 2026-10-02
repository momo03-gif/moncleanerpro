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

import { supabase } from './supabase';

export const LOGOS_BUCKET = 'logos';

// Un logo de fiche s'affiche sur 56 pixels de haut : au-delà de deux méga-
// octets, on transporte une image que personne ne verra jamais en entier.
export const MAX_LOGO_MB = 2;

export interface LogoResult { error: string | null; url?: string | null }

/** Les formats qu'un navigateur affiche à coup sûr, à l'écran comme à l'impression. */
const FORMATS = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export async function uploadLogoPartenaire(userId: string, file: File): Promise<LogoResult> {
  if (!FORMATS.includes(file.type)) {
    return { error: 'Formats acceptés : PNG, JPEG, WebP ou SVG.' };
  }
  const mo = file.size / (1024 * 1024);
  if (mo > MAX_LOGO_MB) {
    return { error: `Logo trop lourd (${mo.toFixed(1)} Mo). Maximum ${MAX_LOGO_MB} Mo.` };
  }

  // L'ancien d'abord : un seul logo par conciergerie.
  const { data: existant } = await supabase
    .from('users').select('logo_path').eq('id', userId).maybeSingle();
  const ancien = existant?.logo_path as string | null | undefined;

  const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const chemin = `${userId}/logo-${Date.now()}.${ext}`;

  const { error: upErr } = await supabase.storage
    .from(LOGOS_BUCKET).upload(chemin, file, { contentType: file.type, upsert: false });
  if (upErr) {
    console.error('uploadLogoPartenaire storage:', upErr.message);
    return { error: upErr.message.includes('Bucket not found')
      ? 'Le dossier « logos » n’existe pas encore dans Supabase Storage.'
      : upErr.message };
  }

  const url = supabase.storage.from(LOGOS_BUCKET).getPublicUrl(chemin).data.publicUrl;

  const { error } = await supabase.from('users')
    .update({ logo_url: url, logo_path: chemin }).eq('id', userId);
  if (error) {
    // L'enregistrement a échoué : on ne laisse pas le fichier derrière nous.
    await supabase.storage.from(LOGOS_BUCKET).remove([chemin]);
    console.error('uploadLogoPartenaire update:', error.message);
    return { error: error.code === '42703'
      ? 'Le logo n’est pas encore activé : exécutez migration_fiche_logement.sql.'
      : error.message };
  }

  if (ancien) await supabase.storage.from(LOGOS_BUCKET).remove([ancien]).catch(() => {});
  return { error: null, url };
}

/** Le logo d'une conciergerie, s'il y en a un. */
export async function getLogoPartenaire(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('users').select('logo_url').eq('id', userId).maybeSingle();
  // Colonne absente (migration non jouée) : pas de logo, et rien ne casse.
  if (error) return null;
  return (data?.logo_url as string | null) ?? null;
}
