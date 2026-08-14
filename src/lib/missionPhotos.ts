import { supabase } from './supabase';
import { compressImage } from './imageCompress';
import type { MissionPhoto, MissionPhotoKind } from './types';

// ════════════════════════════════════════════════════════════════════════════
//  Photos avant/après des missions.
//  Les images sont dans Supabase Storage (bucket dédié) ; la table ne garde que
//  des références légères. Upload = compression puis envoi. Purge = cron.
// ════════════════════════════════════════════════════════════════════════════

export const PHOTOS_BUCKET = 'mission_photos';

// Limite par mission (« 6 à 8 photos maximum » → on retient 8).
export const MAX_PHOTOS_PER_MISSION = 8;

// Rétention : les photos servent de preuve, pas d'archive. Purge après 14 jours.
export const PHOTO_RETENTION_DAYS = 14;

function rowToPhoto(r: Record<string, unknown>): MissionPhoto {
  return {
    id: r.id as string,
    missionId: r.mission_id as string,
    kind: (r.kind as MissionPhotoKind) ?? 'after',
    url: r.url as string,
    storagePath: (r.storage_path as string) ?? '',
    uploadedBy: (r.uploaded_by as string) ?? undefined,
    createdAt: (r.created_at as string) ?? '',
  };
}

// Toutes les photos d'une mission, anciennes en premier (avant puis après à l'affichage).
export async function getMissionPhotosDB(missionId: string): Promise<MissionPhoto[]> {
  const { data, error } = await supabase
    .from('mission_photos')
    .select('*')
    .eq('mission_id', missionId)
    .order('created_at', { ascending: true });
  if (error) { console.error('getMissionPhotosDB:', error.message); return []; }
  return (data ?? []).map(rowToPhoto);
}

/**
 * Photos de plusieurs missions en une requête — sert au relevé du propriétaire,
 * qui rassemble un mois de ménages. Renvoyé indexé par mission.
 * Rappel : les photos sont purgées après PHOTO_RETENTION_DAYS jours, un relevé
 * ancien peut donc légitimement n'en contenir aucune.
 */
export async function getMissionPhotosForMissionsDB(missionIds: string[]): Promise<Map<string, MissionPhoto[]>> {
  if (missionIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('mission_photos')
    .select('*')
    .in('mission_id', missionIds)
    .order('created_at', { ascending: true });
  if (error) { console.error('getMissionPhotosForMissionsDB:', error.message); return new Map(); }
  const byMission = new Map<string, MissionPhoto[]>();
  for (const photo of (data ?? []).map(rowToPhoto)) {
    const list = byMission.get(photo.missionId);
    if (list) list.push(photo); else byMission.set(photo.missionId, [photo]);
  }
  return byMission;
}

// Nombre de photos d'une mission (pour appliquer la limite avant upload).
export async function countMissionPhotosDB(missionId: string): Promise<number> {
  const { count } = await supabase
    .from('mission_photos')
    .select('id', { count: 'exact', head: true })
    .eq('mission_id', missionId);
  return count ?? 0;
}

// Compresse puis téléverse une photo, et enregistre sa référence.
// Renvoie la photo créée ou un message d'erreur explicite.
export async function uploadMissionPhotoDB(params: {
  missionId: string;
  kind: MissionPhotoKind;
  file: File;
  userId?: string;
}): Promise<{ error: string | null; photo?: MissionPhoto }> {
  const { missionId, kind, file, userId } = params;

  // Limite : 8 photos max par mission (avant + après confondus).
  const current = await countMissionPhotosDB(missionId);
  if (current >= MAX_PHOTOS_PER_MISSION) {
    return { error: `Limite atteinte : ${MAX_PHOTOS_PER_MISSION} photos maximum par mission.` };
  }

  // Compression pour limiter le stockage.
  const compressed = await compressImage(file);

  // Chemin : <missionId>/<kind>-<timestamp>-<rand>.jpg
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${missionId}/${kind}-${Date.now()}-${rand}.jpg`;

  const { error: upErr } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(path, compressed, { contentType: compressed.type || 'image/jpeg', upsert: false });
  if (upErr) { console.error('uploadMissionPhotoDB storage:', upErr.message); return { error: upErr.message }; }

  const { data: pub } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(path);
  const url = pub.publicUrl;

  const { data, error } = await supabase.from('mission_photos').insert({
    mission_id: missionId,
    kind,
    url,
    storage_path: path,
    uploaded_by: userId ?? null,
  }).select('*').single();

  if (error) {
    // Rollback du fichier orphelin si l'insertion de la référence échoue.
    await supabase.storage.from(PHOTOS_BUCKET).remove([path]);
    console.error('uploadMissionPhotoDB insert:', error.message);
    return { error: error.message };
  }
  return { error: null, photo: rowToPhoto(data) };
}

// Purge des photos expirées (> PHOTO_RETENTION_DAYS) : fichiers du bucket +
// références en base. Utilisé par le cron. Renvoie le nombre supprimé.
export async function deleteExpiredMissionPhotosDB(retentionDays = PHOTO_RETENTION_DAYS): Promise<{ deleted: number; error: string | null }> {
  const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();

  const { data, error } = await supabase
    .from('mission_photos')
    .select('id, storage_path')
    .lt('created_at', cutoff);
  if (error) return { deleted: 0, error: error.message };
  if (!data || data.length === 0) return { deleted: 0, error: null };

  const paths = data.map(r => r.storage_path as string).filter(Boolean);
  if (paths.length > 0) {
    const { error: rmErr } = await supabase.storage.from(PHOTOS_BUCKET).remove(paths);
    if (rmErr) console.error('deleteExpiredMissionPhotosDB storage:', rmErr.message);
  }

  const ids = data.map(r => r.id as string);
  const { error: delErr } = await supabase.from('mission_photos').delete().in('id', ids);
  if (delErr) return { deleted: 0, error: delErr.message };

  return { deleted: ids.length, error: null };
}
