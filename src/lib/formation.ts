import { postServer } from './db/shared';

// ══════════════════════════════════════════════════════════════════════════════
//  Module Formation (LOT 7 + 7bis) — couche d'accès données.
//  Catégories → vidéos, et assignations admin → cleaners (bloquantes ou non).
//  Tout passe par /api/formation : gestion réservée à l'admin, et un cleaner ne
//  lit et ne valide que SES assignations (les tables ne sont plus publiques).
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

async function lire<T>(op: string, map: (r: any) => T, body: Record<string, unknown> = {}): Promise<T[]> {
  try { return ((await postServer('/api/formation', { op, ...body })).data ?? []).map(map); }
  catch (e) { console.error(`formation/${op}:`, e); return []; }
}
async function ecrire(op: string, body: Record<string, unknown>): Promise<{ error: string | null; data?: any }> {
  try { const d = await postServer('/api/formation', { op, ...body }); return { error: null, data: d.data }; }
  catch (e) { return { error: e instanceof Error ? e.message : 'Opération impossible.' }; }
}

// ── CATÉGORIES ──────────────────────────────────────────────────────────────
export async function getCategoriesDB(): Promise<FormationCategory[]> {
  return lire('categories', toCat);
}
export async function createCategoryDB(f: { titre: string; description?: string; icone?: string; ordre?: number }) {
  return { error: (await ecrire('category-create', f)).error };
}
export async function updateCategoryDB(id: string, f: { titre?: string; description?: string; icone?: string; ordre?: number }) {
  return { error: (await ecrire('category-update', { id, ...f })).error };
}
export async function deleteCategoryDB(id: string) {
  return { error: (await ecrire('category-delete', { id })).error };
}

// ── VIDÉOS ──────────────────────────────────────────────────────────────────
export async function getFormationsDB(): Promise<Formation[]> {
  return lire('formations', toForm);
}
export async function getFormationsByCategoryDB(categorieId: string): Promise<Formation[]> {
  return lire('formations', toForm, { categorieId });
}
export async function createFormationDB(f: { categorieId: string; titre: string; description?: string; videoUrl?: string; ordre?: number; obligatoire?: boolean }) {
  return { error: (await ecrire('formation-create', f)).error };
}
export async function updateFormationDB(id: string, f: { titre?: string; description?: string; videoUrl?: string; ordre?: number; obligatoire?: boolean }) {
  return { error: (await ecrire('formation-update', { id, ...f })).error };
}
export async function deleteFormationDB(id: string) {
  return { error: (await ecrire('formation-delete', { id })).error };
}

// ── ASSIGNATIONS (admin → cleaners) ───────────────────────────────────────────
// Côté cleaner, `cleanerId` est ignoré : le serveur prend celui de la session.
export async function getAssignmentsForCleanerDB(cleanerId: string): Promise<FormationAssignment[]> {
  return lire('assignments', toAssign, { cleanerId });
}

// Assigne une formation (vidéo OU catégorie) à plusieurs cleaners en un insert.
export async function assignFormationDB(params: {
  cleanerIds: string[]; formationId?: string; categorieId?: string; obligatoire: boolean;
}): Promise<{ error: string | null; count: number }> {
  if (params.cleanerIds.length === 0) return { error: 'Aucun cleaner sélectionné.', count: 0 };
  if (!params.formationId && !params.categorieId) return { error: 'Choisir une vidéo ou une catégorie.', count: 0 };
  const r = await ecrire('assign', params);
  return { error: r.error, count: Number(r.data?.count) || 0 };
}

// Le cleaner marque une assignation comme terminée (depuis son onglet Formation).
export async function completeAssignmentDB(id: string): Promise<{ error: string | null }> {
  return { error: (await ecrire('complete', { id })).error };
}
export async function deleteAssignmentDB(id: string) {
  return { error: (await ecrire('assignment-delete', { id })).error };
}

// Y a-t-il une formation OBLIGATOIRE encore « à faire » pour ce cleaner (cleaners.id) ?
// (Le blocage à la demande de mission est, lui, vérifié côté serveur.)
export async function getBlockingFormationsDB(cleanerId: string): Promise<FormationAssignment[]> {
  return lire('blocking', toAssign, { cleanerId });
}
