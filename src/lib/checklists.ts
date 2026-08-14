// ── Checklists de ménage ──────────────────────────────────────────────────────
//
// La conciergerie définit son standard PAR LOGEMENT (le modèle) ; le cleaner
// coche pendant le ménage (l'exécution) ; la conciergerie lit la conformité et
// la transmet à son propriétaire. Voir supabase/migration_checklists.sql.
//
// Décoché = pas de ligne dans mission_checklist_checks. On ne stocke jamais un
// « false » : la conformité se lit toujours « points cochés / points requis ».

import { supabase } from './supabase';
import { compressImage } from './imageCompress';
import { STARTER_CHECKLIST } from './checklistCompute';
import type { ChecklistItem, ChecklistCheck, MissionChecklistLine } from './types';

// La logique pure (conformité, regroupement, modèle de démarrage) vit dans
// checklistCompute.ts ; on la réexporte pour n'avoir qu'un point d'import.
export {
  checklistProgress, groupByRoom, STARTER_CHECKLIST, type ChecklistProgress,
} from './checklistCompute';

// ── Lignes → objets ───────────────────────────────────────────────────────────

function rowToItem(r: Record<string, unknown>): ChecklistItem {
  return {
    id: r.id as string,
    airbnbId: r.airbnb_id as string,
    label: (r.label as string) ?? '',
    room: (r.room as string) ?? undefined,
    position: (r.position as number) ?? 0,
    required: r.required !== false,
    referencePhotoUrl: (r.reference_photo_url as string) ?? undefined,
    createdBy: (r.created_by as string) ?? undefined,
    createdAt: (r.created_at as string) ?? undefined,
    archivedAt: (r.archived_at as string) ?? undefined,
  };
}

function rowToCheck(r: Record<string, unknown>): ChecklistCheck {
  return {
    missionId: r.mission_id as string,
    itemId: r.item_id as string,
    labelSnapshot: (r.label_snapshot as string) ?? '',
    checkedAt: (r.checked_at as string) ?? '',
    checkedBy: (r.checked_by as string) ?? undefined,
  };
}

// ── Le modèle (par logement) ──────────────────────────────────────────────────

/** Standard de ménage d'un logement (points actifs, dans l'ordre). */
export async function getChecklistForApartmentDB(airbnbId: string): Promise<ChecklistItem[]> {
  const { data, error } = await supabase
    .from('checklist_items').select('*')
    .eq('airbnb_id', airbnbId)
    .is('archived_at', null)
    .order('position', { ascending: true });
  if (error) { console.error('getChecklistForApartmentDB:', error.message); return []; }
  return (data ?? []).map(rowToItem);
}

/** Ajoute un point au standard ; il se place en fin de liste. */
export async function addChecklistItemDB(
  airbnbId: string,
  fields: { label: string; room?: string; required?: boolean; createdBy?: string },
): Promise<{ item: ChecklistItem | null; error: string | null }> {
  const label = fields.label.trim();
  if (!label) return { item: null, error: 'Intitulé requis.' };

  const { data: last } = await supabase
    .from('checklist_items').select('position')
    .eq('airbnb_id', airbnbId).is('archived_at', null)
    .order('position', { ascending: false }).limit(1).maybeSingle();

  const { data, error } = await supabase.from('checklist_items').insert({
    airbnb_id: airbnbId,
    label,
    room: fields.room?.trim() || null,
    required: fields.required !== false,
    position: ((last?.position as number) ?? -1) + 1,
    created_by: fields.createdBy ?? null,
  }).select('*').single();

  if (error) { console.error('addChecklistItemDB:', error.message); return { item: null, error: error.message }; }
  return { item: rowToItem(data), error: null };
}

export async function updateChecklistItemDB(
  id: string,
  fields: { label?: string; room?: string | null; required?: boolean; position?: number; referencePhotoUrl?: string | null },
): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = {};
  if (fields.referencePhotoUrl !== undefined) patch.reference_photo_url = fields.referencePhotoUrl || null;
  if (fields.label !== undefined) {
    const label = fields.label.trim();
    if (!label) return { error: 'Intitulé requis.' };
    patch.label = label;
  }
  if (fields.room !== undefined) patch.room = fields.room?.trim() || null;
  if (fields.required !== undefined) patch.required = fields.required;
  if (fields.position !== undefined) patch.position = fields.position;
  if (Object.keys(patch).length === 0) return { error: null };

  const { error } = await supabase.from('checklist_items').update(patch).eq('id', id);
  if (error) console.error('updateChecklistItemDB:', error.message);
  return { error: error?.message ?? null };
}

/**
 * Retire un point du standard. On ARCHIVE au lieu de supprimer : les ménages
 * passés gardent la preuve de ce qui avait été demandé et coché.
 */
export async function archiveChecklistItemDB(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('checklist_items')
    .update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) console.error('archiveChecklistItemDB:', error.message);
  return { error: error?.message ?? null };
}

/** Réordonne le standard (liste d'ids dans le nouvel ordre). */
export async function reorderChecklistDB(ids: string[]): Promise<{ error: string | null }> {
  const results = await Promise.all(
    ids.map((id, i) => supabase.from('checklist_items').update({ position: i }).eq('id', id)),
  );
  const failed = results.find(r => r.error);
  if (failed?.error) { console.error('reorderChecklistDB:', failed.error.message); return { error: failed.error.message }; }
  return { error: null };
}

// ── L'exécution (par mission) ─────────────────────────────────────────────────

/**
 * Checklist d'une mission : le standard ACTUEL du logement + ce qui a été coché,
 * plus les points cochés dont le modèle a été archivé depuis (sinon une preuve
 * disparaîtrait de l'historique quand la conciergerie nettoie son standard).
 */
export async function getMissionChecklistDB(missionId: string, airbnbId: string): Promise<MissionChecklistLine[]> {
  const [itemsRes, checksRes] = await Promise.all([
    supabase.from('checklist_items').select('*').eq('airbnb_id', airbnbId).order('position', { ascending: true }),
    supabase.from('mission_checklist_checks').select('*').eq('mission_id', missionId),
  ]);
  if (itemsRes.error) { console.error('getMissionChecklistDB(items):', itemsRes.error.message); return []; }
  if (checksRes.error) console.error('getMissionChecklistDB(checks):', checksRes.error.message);

  const checks = new Map((checksRes.data ?? []).map(rowToCheck).map(c => [c.itemId, c]));
  return (itemsRes.data ?? [])
    .map(rowToItem)
    // Un point archivé n'est proposé que s'il avait été coché sur CE ménage.
    .filter(item => !item.archivedAt || checks.has(item.id))
    .map(item => ({ item, check: checks.get(item.id) }));
}

/** Coche un point (idempotent : recocher ne duplique pas). */
export async function checkChecklistItemDB(
  missionId: string, item: ChecklistItem, checkedBy?: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('mission_checklist_checks').upsert({
    mission_id: missionId,
    item_id: item.id,
    label_snapshot: item.label,
    checked_at: new Date().toISOString(),
    checked_by: checkedBy ?? null,
  }, { onConflict: 'mission_id,item_id' });
  if (error) console.error('checkChecklistItemDB:', error.message);
  return { error: error?.message ?? null };
}

/** Décoche un point (supprime la ligne). */
export async function uncheckChecklistItemDB(missionId: string, itemId: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('mission_checklist_checks')
    .delete().eq('mission_id', missionId).eq('item_id', itemId);
  if (error) console.error('uncheckChecklistItemDB:', error.message);
  return { error: error?.message ?? null };
}

/**
 * Nombre de points actifs par logement — sert à montrer, sur la liste des
 * logements, lesquels ont déjà un standard de ménage et lesquels n'en ont pas.
 * Une seule requête pour toute la liste.
 */
export async function getChecklistCountsForApartmentsDB(airbnbIds: string[]): Promise<Map<string, number>> {
  if (airbnbIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('checklist_items').select('airbnb_id')
    .in('airbnb_id', airbnbIds)
    .is('archived_at', null);
  if (error) { console.error('getChecklistCountsForApartmentsDB:', error.message); return new Map(); }
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.airbnb_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Conformité de plusieurs missions d'un coup (listes, statistiques). */
export async function getChecklistCountsForMissionsDB(missionIds: string[]): Promise<Map<string, number>> {
  if (missionIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('mission_checklist_checks').select('mission_id').in('mission_id', missionIds);
  if (error) { console.error('getChecklistCountsForMissionsDB:', error.message); return new Map(); }
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.mission_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

// ── Photo de référence d'un point ─────────────────────────────────────────────
// Réutilise le bucket des photos de mission (sous-dossier checklists/) : pas de
// bucket supplémentaire à créer ni à configurer.
const CHECKLIST_PHOTOS_BUCKET = 'mission_photos';

/** Compresse puis téléverse la photo modèle d'un point → URL publique. */
export async function uploadChecklistPhotoDB(
  airbnbId: string, itemId: string, file: File,
): Promise<{ url: string | null; error: string | null }> {
  if (!file.type.startsWith('image/')) return { url: null, error: 'Fichier image attendu (jpg, png…).' };
  const compressed = await compressImage(file);
  const path = `checklists/${airbnbId}/${itemId}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from(CHECKLIST_PHOTOS_BUCKET)
    .upload(path, compressed, { contentType: compressed.type || 'image/jpeg', upsert: false });
  if (error) { console.error('uploadChecklistPhotoDB:', error.message); return { url: null, error: error.message }; }
  const { data } = supabase.storage.from(CHECKLIST_PHOTOS_BUCKET).getPublicUrl(path);
  const url = data.publicUrl;
  const saved = await updateChecklistItemDB(itemId, { referencePhotoUrl: url });
  if (saved.error) return { url: null, error: saved.error };
  return { url, error: null };
}

/** Installe le modèle de démarrage sur un logement (uniquement si le standard est vide). */
export async function seedStarterChecklistDB(airbnbId: string, createdBy?: string): Promise<{ error: string | null }> {
  const existing = await getChecklistForApartmentDB(airbnbId);
  if (existing.length > 0) return { error: 'Ce logement a déjà une checklist.' };

  const { error } = await supabase.from('checklist_items').insert(
    STARTER_CHECKLIST.map((it, i) => ({
      airbnb_id: airbnbId,
      label: it.label,
      room: it.room,
      required: it.required !== false,
      position: i,
      created_by: createdBy ?? null,
    })),
  );
  if (error) console.error('seedStarterChecklistDB:', error.message);
  return { error: error?.message ?? null };
}
