// ── Checklists de ménage ──────────────────────────────────────────────────────
//
// La conciergerie définit son standard PAR LOGEMENT (le modèle) ; le cleaner
// coche pendant le ménage (l'exécution) ; la conciergerie lit la conformité et
// la transmet à son propriétaire. Voir supabase/migration_checklists.sql.
//
// Décoché = pas de ligne dans mission_checklist_checks. On ne stocke jamais un
// « false » : la conformité se lit toujours « points cochés / points requis ».

import { compressImage } from './imageCompress';
import { deposerFichier } from './depot';
import { annexe } from './db/shared';
import type { ChecklistItem, ChecklistCheck, MissionChecklistLine } from './types';

// La logique pure (conformité, regroupement, modèle de démarrage) vit dans
// checklistCompute.ts ; on la réexporte pour n'avoir qu'un point d'import.
export {
  checklistProgress, groupByRoom, STARTER_CHECKLIST, type ChecklistProgress,
} from './checklistCompute';

// ── Écritures : par le serveur, jamais par le navigateur ─────────────────────
// `checklist_items` et `mission_checklist_checks` ont la RLS active : une
// écriture depuis la clé publique est refusée (42501), silencieusement pour
// l'utilisateur. Tout ce qui écrit passe donc par /api/checklist, qui vérifie la
// session et le droit avant d'agir. La LECTURE, elle, reste directe.
async function ecrire(payload: Record<string, unknown>): Promise<{ error: string | null; item?: unknown }> {
  try {
    const res = await fetch('/api/checklist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error ?? 'Enregistrement impossible.' };
    return { error: null, item: data.item };
  } catch {
    return { error: 'Connexion impossible. Réessayez.' };
  }
}

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
  // Lecture par le serveur : la RLS de ces tables refuse la clé publique.
  try { return ((await annexe('checklist-items', { airbnbId })).data ?? []).map(rowToItem); }
  catch (e) { console.error('getChecklistForApartmentDB:', e); return []; }
}

/** Ajoute un point au standard ; il se place en fin de liste. */
export async function addChecklistItemDB(
  airbnbId: string,
  fields: { label: string; room?: string; required?: boolean; createdBy?: string },
): Promise<{ item: ChecklistItem | null; error: string | null }> {
  const label = fields.label.trim();
  if (!label) return { item: null, error: 'Intitulé requis.' };

  const res = await ecrire({
    action: 'add', airbnbId, label,
    room: fields.room ?? null, required: fields.required !== false, authorName: fields.createdBy,
  });
  if (res.error) return { item: null, error: res.error };
  return { item: res.item ? rowToItem(res.item as Record<string, unknown>) : null, error: null };
}

export async function updateChecklistItemDB(
  id: string,
  fields: { label?: string; room?: string | null; required?: boolean; position?: number; referencePhotoUrl?: string | null },
): Promise<{ error: string | null }> {
  if (fields.label !== undefined && !fields.label.trim()) return { error: 'Intitulé requis.' };
  return ecrire({ action: 'update', itemId: id, ...fields });
}

/**
 * Retire un point du standard. On ARCHIVE au lieu de supprimer : les ménages
 * passés gardent la preuve de ce qui avait été demandé et coché.
 */
export async function archiveChecklistItemDB(id: string): Promise<{ error: string | null }> {
  return ecrire({ action: 'archive', itemId: id });
}

/** Ordre d'affichage : la position de chaque point suit l'ordre de la liste. */
export async function reorderChecklistDB(ids: string[]): Promise<{ error: string | null }> {
  if (ids.length === 0) return { error: null };
  return ecrire({ action: 'reorder', ids });
}

// ── L'exécution (par mission) ─────────────────────────────────────────────────

/**
 * Checklist d'une mission : le standard ACTUEL du logement + ce qui a été coché,
 * plus les points cochés dont le modèle a été archivé depuis (sinon une preuve
 * disparaîtrait de l'historique quand la conciergerie nettoie son standard).
 */
export async function getMissionChecklistDB(missionId: string, _airbnbId: string): Promise<MissionChecklistLine[]> {
  // Le logement est repris de la mission par le serveur.
  let res: { items?: Record<string, unknown>[]; checks?: Record<string, unknown>[] };
  try { res = await annexe('checklist-mission', { missionId }); }
  catch (e) { console.error('getMissionChecklistDB:', e); return []; }
  const checks = new Map((res.checks ?? []).map(rowToCheck).map(c => [c.itemId, c]));
  return (res.items ?? [])
    .map(rowToItem)
    .filter(item => !item.archivedAt || checks.has(item.id))
    .map(item => ({ item, check: checks.get(item.id) }));
}

/** Coche un point (idempotent : recocher ne duplique pas). */
export async function checkChecklistItemDB(
  missionId: string, item: ChecklistItem, checkedBy?: string,
): Promise<{ error: string | null }> {
  return ecrire({
    action: 'check', missionId, itemId: item.id, labelSnapshot: item.label, authorName: checkedBy,
  });
}

/** Décoche un point (supprime la ligne). */
export async function uncheckChecklistItemDB(missionId: string, itemId: string): Promise<{ error: string | null }> {
  return ecrire({ action: 'uncheck', missionId, itemId });
}

/**
 * Nombre de points actifs par logement — sert à montrer, sur la liste des
 * logements, lesquels ont déjà un standard de ménage et lesquels n'en ont pas.
 * Une seule requête pour toute la liste.
 */
export async function getChecklistCountsForApartmentsDB(airbnbIds: string[]): Promise<Map<string, number>> {
  if (airbnbIds.length === 0) return new Map();
  let ids: string[] = [];
  try { ids = (await annexe('checklist-counts-apartments', { airbnbIds })).data ?? []; }
  catch (e) { console.error('getChecklistCountsForApartmentsDB:', e); return new Map(); }
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

/** Conformité de plusieurs missions d'un coup (listes, statistiques). */
export async function getChecklistCountsForMissionsDB(missionIds: string[]): Promise<Map<string, number>> {
  if (missionIds.length === 0) return new Map();
  let ids: string[] = [];
  try { ids = (await annexe('checklist-counts-missions', { missionIds })).data ?? []; }
  catch (e) { console.error('getChecklistCountsForMissionsDB:', e); return new Map(); }
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
  return counts;
}

// ── Photo de référence d'un point ─────────────────────────────────────────────
// Réutilise le bucket des photos de mission (sous-dossier checklists/) : pas de
// bucket supplémentaire à créer ni à configurer.

/** Compresse puis téléverse la photo modèle d'un point → URL publique. */
export async function uploadChecklistPhotoDB(
  airbnbId: string, itemId: string, file: File,
): Promise<{ url: string | null; error: string | null }> {
  if (!file.type.startsWith('image/')) return { url: null, error: 'Fichier image attendu (jpg, png…).' };
  const compressed = await compressImage(file);
  // Dépôt autorisé par le serveur (admin, ou conciergerie du logement) :
  // checklists/<airbnbId>/<itemId>-<timestamp>.jpg
  const depot = await deposerFichier('checklist-photo', { airbnbId, itemId }, compressed, compressed.type || 'image/jpeg');
  if (depot.error !== null) { console.error('uploadChecklistPhotoDB:', depot.error); return { url: null, error: depot.error }; }
  const url = depot.url;
  const saved = await updateChecklistItemDB(itemId, { referencePhotoUrl: url });
  if (saved.error) return { url: null, error: saved.error };
  return { url, error: null };
}

/** Installe le modèle de démarrage sur un logement (uniquement si le standard est vide). */
export async function seedStarterChecklistDB(airbnbId: string, createdBy?: string): Promise<{ error: string | null }> {
  return ecrire({ action: 'seed', airbnbId, authorName: createdBy });
}
