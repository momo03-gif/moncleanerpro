import { supabase } from './supabase';
import { annexe } from './db/shared';

// ══════════════════════════════════════════════════════════════════════════════
//  Dépôt d'un fichier (photo de ménage, de réparation, de checklist, reçu).
//
//  Le serveur vérifie le droit de déposer et délivre une autorisation à usage
//  unique pour un chemin qu'il choisit (cf. lib/annexes.ts, 'upload-url') ; le
//  fichier part ensuite directement vers le stockage avec cette autorisation.
//  La clé publique, elle, n'a plus le droit de déposer ni d'effacer.
// ══════════════════════════════════════════════════════════════════════════════

export type TypeDepot = 'mission-photo' | 'repair-photo' | 'checklist-photo' | 'receipt' | 'site-video' | 'logo';

export async function deposerFichier(
  kind: TypeDepot, params: Record<string, unknown>, fichier: Blob, contentType: string,
): Promise<{ path: string; url: string; error: null } | { path: null; url: null; error: string }> {
  try {
    const a = await annexe('upload-url', { kind, ...params });
    const { error } = await supabase.storage.from(a.bucket).uploadToSignedUrl(a.path, a.token, fichier, { contentType });
    if (error) return { path: null, url: null, error: error.message };
    return { path: a.path as string, url: a.publicUrl as string, error: null };
  } catch (e) {
    return { path: null, url: null, error: e instanceof Error ? e.message : 'Dépôt impossible.' };
  }
}
