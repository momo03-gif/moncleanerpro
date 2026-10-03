import { supabase } from './supabase';
import { annexe } from './db/shared';
import { compressImage } from './imageCompress';
import type { Repair, RepairStatus } from './types';

// Photos d'un incident : 2 maximum. Réutilise le bucket Storage des photos de
// mission (sous-dossier repairs/) pour éviter de créer un bucket dédié.
export const MAX_REPAIR_PHOTOS = 2;
const REPAIR_PHOTOS_BUCKET = 'mission_photos';

// Compresse puis téléverse une image d'incident → URL publique.
export async function uploadRepairPhotoDB(airbnbId: string, file: File): Promise<{ url: string | null; error: string | null }> {
  if (!file.type.startsWith('image/')) return { url: null, error: 'Fichier image attendu (jpg, png…).' };
  const compressed = await compressImage(file);
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `repairs/${airbnbId}/${Date.now()}-${rand}.jpg`;
  const { error: upErr } = await supabase.storage.from(REPAIR_PHOTOS_BUCKET)
    .upload(path, compressed, { contentType: compressed.type || 'image/jpeg', upsert: false });
  if (upErr) { console.error('uploadRepairPhotoDB:', upErr.message); return { url: null, error: upErr.message }; }
  const { data } = supabase.storage.from(REPAIR_PHOTOS_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

// ════════════════════════════════════════════════════════════════════════════
//  Réparations — rattachées à un SITE (appartement), pas à une mission.
//  Créées par le cleaner (depuis son rapport de fin de mission) ou par l'admin.
//  Elles restent OUVERTES tant que le propriétaire (ou l'admin) ne les a pas
//  marquées réparées : la clôture de la mission d'origine ne les ferme pas.
// ════════════════════════════════════════════════════════════════════════════

function rowToRepair(r: Record<string, unknown>): Repair {
  const apt = r.airbnbs as { name?: string; address?: string } | null | undefined;
  return {
    id: r.id as string,
    airbnbId: r.airbnb_id as string,
    partnerId: (r.partner_id as string) ?? undefined,
    missionId: (r.mission_id as string) ?? undefined,
    description: (r.description as string) ?? '',
    status: (r.status as RepairStatus) ?? 'open',
    createdBy: (r.created_by as string) ?? undefined,
    createdRole: (r.created_role as Repair['createdRole']) ?? undefined,
    resolvedBy: (r.resolved_by as string) ?? undefined,
    resolvedNote: (r.resolved_note as string) ?? undefined,
    resolvedAt: (r.resolved_at as string) ?? undefined,
    createdAt: (r.created_at as string) ?? undefined,
    photos: Array.isArray(r.photos) ? (r.photos as string[]) : [],
    propertyName: apt?.name ?? undefined,
    propertyAddress: apt?.address ?? undefined,
  };
}

// Jointure du site pour afficher « quel appartement » sans requête supplémentaire.

/** Toutes les réparations d'un partenaire (son espace). Ouvertes d'abord. */
export async function getRepairsForPartnerDB(_partnerId: string): Promise<Repair[]> {
  // La conciergerie est celle de la session.
  try { return ((await annexe('repairs-partner')).data ?? []).map(rowToRepair); }
  catch (e) { console.error('getRepairsForPartnerDB:', e); return []; }
}

/** Toutes les réparations (admin). */
export async function getAllRepairsDB(): Promise<Repair[]> {
  try { return ((await annexe('repairs-all')).data ?? []).map(rowToRepair); }
  catch (e) { console.error('getAllRepairsDB:', e); return []; }
}

/** Réparations d'un site donné (fiche logement admin / partenaire). */
export async function getRepairsForApartmentDB(airbnbId: string): Promise<Repair[]> {
  try { return ((await annexe('repairs-apartment', { airbnbId })).data ?? []).map(rowToRepair); }
  catch (e) { console.error('getRepairsForApartmentDB:', e); return []; }
}

/** Réparations créées depuis une mission donnée (rapport cleaner). */
export async function getRepairsForMissionDB(missionId: string): Promise<Repair[]> {
  try { return ((await annexe('repairs-mission', { missionId })).data ?? []).map(rowToRepair); }
  catch (e) { console.error('getRepairsForMissionDB:', e); return []; }
}

export interface NewRepair {
  airbnbId: string;
  missionId?: string;
  description: string;
  createdBy?: string;
  createdRole?: Repair['createdRole'];
  photos?: string[];          // URLs déjà téléversées (max 2)
}

/**
 * Crée une réparation. Le partenaire propriétaire est repris du SITE (et non de
 * la mission) : c'est lui qui devra confirmer la réparation dans son espace.
 */
export async function createRepairDB(r: NewRepair): Promise<{ repair: Repair | null; error: string | null }> {
  const description = r.description.trim();
  if (!description) return { repair: null, error: 'Description requise.' };

  // Le serveur reprend le propriétaire du SITE et vérifie le droit de signaler
  // (admin, ou cleaner depuis sa mission).
  let repair: Repair;
  try {
    const res = await annexe('repair-create', {
      airbnbId: r.airbnbId, missionId: r.missionId, description,
      createdBy: r.createdBy, photos: (r.photos ?? []).slice(0, MAX_REPAIR_PHOTOS),
    });
    repair = rowToRepair(res.data);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Enregistrement impossible.';
    console.error('createRepairDB:', message);
    return { repair: null, error: message };
  }

  if (typeof window !== 'undefined') {
    fetch('/api/whatsapp/repair', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ airbnbId: r.airbnbId, description, reportedBy: r.createdBy }),
    }).catch(() => { /* silencieux : la réparation est déjà créée */ });
  }

  return { repair, error: null };
}

/** Marque une réparation comme faite (propriétaire ou admin). */
export async function resolveRepairDB(id: string, resolvedBy?: string, note?: string): Promise<{ error: string | null }> {
  try { await annexe('repair-resolve', { id, resolvedBy, note }); return { error: null }; }
  catch (e) { const m = e instanceof Error ? e.message : 'Enregistrement impossible.'; console.error('resolveRepairDB:', m); return { error: m }; }
}

/** Rouvre une réparation clôturée par erreur. */
export async function reopenRepairDB(id: string): Promise<{ error: string | null }> {
  try { await annexe('repair-reopen', { id }); return { error: null }; }
  catch (e) { const m = e instanceof Error ? e.message : 'Enregistrement impossible.'; console.error('reopenRepairDB:', m); return { error: m }; }
}

export async function deleteRepairDB(id: string): Promise<{ error: string | null }> {
  try { await annexe('repair-delete', { id }); return { error: null }; }
  catch (e) { const m = e instanceof Error ? e.message : 'Suppression impossible.'; console.error('deleteRepairDB:', m); return { error: m }; }
}
