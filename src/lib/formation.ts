import { supabase } from './supabase';

// ══════════════════════════════════════════════════════════════════════════════
//  Module Formation (LOT 7 + 7bis) — couche d'accès données.
//  Catégories → vidéos, et assignations admin → cleaners (bloquantes ou non).
// ══════════════════════════════════════════════════════════════════════════════

export interface FormationCategory {
  id: string; titre: string; description?: string; icone?: string; ordre: number;
}
export interface Formation {
  id: string; categorieId: string; titre: string; description?: string;
  videoUrl?: string; ordre: number; obligatoire: boolean;
}
export interface FormationAssignment {
  id: string; cleanerId: string; formationId?: string; categorieId?: string;
  obligatoire: boolean; statut: 'a_faire' | 'terminee';
  dateAssignation?: string; dateCompletion?: string;
}

const toCat = (r: any): FormationCategory => ({ id: r.id, titre: r.titre, description: r.description ?? undefined, icone: r.icone ?? undefined, ordre: r.ordre ?? 0 });
const toForm = (r: any): Formation => ({ id: r.id, categorieId: r.categorie_id, titre: r.titre, description: r.description ?? undefined, videoUrl: r.video_url ?? undefined, ordre: r.ordre ?? 0, obligatoire: !!r.obligatoire });
const toAssign = (r: any): FormationAssignment => ({ id: r.id, cleanerId: r.cleaner_id, formationId: r.formation_id ?? undefined, categorieId: r.categorie_id ?? undefined, obligatoire: !!r.obligatoire, statut: r.statut ?? 'a_faire', dateAssignation: r.date_assignation ?? undefined, dateCompletion: r.date_completion ?? undefined });

// ── CATÉGORIES ──────────────────────────────────────────────────────────────
export async function getCategoriesDB(): Promise<FormationCategory[]> {
  const { data, error } = await supabase.from('formation_categories').select('*').order('ordre');
  if (error) { console.error('getCategoriesDB:', error.code, error.message); return []; }
  return (data ?? []).map(toCat);
}
export async function createCategoryDB(f: { titre: string; description?: string; icone?: string; ordre?: number }) {
  const { error } = await supabase.from('formation_categories').insert({ titre: f.titre, description: f.description || null, icone: f.icone || 'book', ordre: f.ordre ?? 0 });
  return { error: error?.message ?? null };
}
export async function updateCategoryDB(id: string, f: { titre?: string; description?: string; icone?: string; ordre?: number }) {
  const patch: Record<string, unknown> = {};
  if (f.titre !== undefined) patch.titre = f.titre;
  if (f.description !== undefined) patch.description = f.description || null;
  if (f.icone !== undefined) patch.icone = f.icone;
  if (f.ordre !== undefined) patch.ordre = f.ordre;
  const { error } = await supabase.from('formation_categories').update(patch).eq('id', id);
  return { error: error?.message ?? null };
}
export async function deleteCategoryDB(id: string) {
  const { error } = await supabase.from('formation_categories').delete().eq('id', id);
  return { error: error?.message ?? null };
}

// ── VIDÉOS ──────────────────────────────────────────────────────────────────
export async function getFormationsDB(): Promise<Formation[]> {
  const { data, error } = await supabase.from('formations').select('*').order('ordre');
  if (error) { console.error('getFormationsDB:', error.code, error.message); return []; }
  return (data ?? []).map(toForm);
}
export async function getFormationsByCategoryDB(categorieId: string): Promise<Formation[]> {
  const { data } = await supabase.from('formations').select('*').eq('categorie_id', categorieId).order('ordre');
  return (data ?? []).map(toForm);
}
export async function createFormationDB(f: { categorieId: string; titre: string; description?: string; videoUrl?: string; ordre?: number; obligatoire?: boolean }) {
  const { error } = await supabase.from('formations').insert({ categorie_id: f.categorieId, titre: f.titre, description: f.description || null, video_url: f.videoUrl || null, ordre: f.ordre ?? 0, obligatoire: f.obligatoire ?? false });
  return { error: error?.message ?? null };
}
export async function updateFormationDB(id: string, f: { titre?: string; description?: string; videoUrl?: string; ordre?: number; obligatoire?: boolean }) {
  const patch: Record<string, unknown> = {};
  if (f.titre !== undefined) patch.titre = f.titre;
  if (f.description !== undefined) patch.description = f.description || null;
  if (f.videoUrl !== undefined) patch.video_url = f.videoUrl || null;
  if (f.ordre !== undefined) patch.ordre = f.ordre;
  if (f.obligatoire !== undefined) patch.obligatoire = f.obligatoire;
  const { error } = await supabase.from('formations').update(patch).eq('id', id);
  return { error: error?.message ?? null };
}
export async function deleteFormationDB(id: string) {
  const { error } = await supabase.from('formations').delete().eq('id', id);
  return { error: error?.message ?? null };
}

// ── ASSIGNATIONS (admin → cleaners) ───────────────────────────────────────────
export async function getAssignmentsForCleanerDB(cleanerId: string): Promise<FormationAssignment[]> {
  const { data } = await supabase.from('formation_assignments').select('*').eq('cleaner_id', cleanerId).order('date_assignation', { ascending: false });
  return (data ?? []).map(toAssign);
}

// Assigne une formation (vidéo OU catégorie) à plusieurs cleaners en un insert.
export async function assignFormationDB(params: {
  cleanerIds: string[]; formationId?: string; categorieId?: string; obligatoire: boolean;
}): Promise<{ error: string | null; count: number }> {
  if (params.cleanerIds.length === 0) return { error: 'Aucun cleaner sélectionné.', count: 0 };
  if (!params.formationId && !params.categorieId) return { error: 'Choisir une vidéo ou une catégorie.', count: 0 };
  const rows = params.cleanerIds.map(cid => ({
    cleaner_id: cid,
    formation_id: params.formationId || null,
    categorie_id: params.categorieId || null,
    obligatoire: params.obligatoire,
    statut: 'a_faire',
  }));
  const { data, error } = await supabase.from('formation_assignments').insert(rows).select('id');
  if (error) { console.error('assignFormationDB:', error.code, error.message); return { error: error.message, count: 0 }; }
  return { error: null, count: data?.length ?? 0 };
}

// Le cleaner marque une assignation comme terminée (depuis son onglet Formation).
export async function completeAssignmentDB(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('formation_assignments')
    .update({ statut: 'terminee', date_completion: new Date().toISOString() }).eq('id', id);
  return { error: error?.message ?? null };
}
export async function deleteAssignmentDB(id: string) {
  const { error } = await supabase.from('formation_assignments').delete().eq('id', id);
  return { error: error?.message ?? null };
}

// Y a-t-il une formation OBLIGATOIRE encore « à faire » pour ce cleaner (cleaners.id) ?
// → utilisé pour bloquer l'acceptation de mission (LOT 7bis B).
export async function getBlockingFormationsDB(cleanerId: string): Promise<FormationAssignment[]> {
  const { data } = await supabase.from('formation_assignments')
    .select('*').eq('cleaner_id', cleanerId).eq('obligatoire', true).eq('statut', 'a_faire');
  return (data ?? []).map(toAssign);
}
