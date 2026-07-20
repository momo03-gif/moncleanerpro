import { supabase } from './supabase';
import type { Repair, RepairStatus } from './types';

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
    propertyName: apt?.name ?? undefined,
    propertyAddress: apt?.address ?? undefined,
  };
}

// Jointure du site pour afficher « quel appartement » sans requête supplémentaire.
const SELECT = '*, airbnbs(name, address)';

/** Toutes les réparations d'un partenaire (son espace). Ouvertes d'abord. */
export async function getRepairsForPartnerDB(partnerId: string): Promise<Repair[]> {
  const { data, error } = await supabase
    .from('repairs').select(SELECT)
    .eq('partner_id', partnerId)
    .order('status', { ascending: true })          // 'done' > 'open' → ouvertes en tête
    .order('created_at', { ascending: false });
  if (error) { console.error('getRepairsForPartnerDB:', error.message); return []; }
  return (data ?? []).map(rowToRepair);
}

/** Toutes les réparations (admin). */
export async function getAllRepairsDB(): Promise<Repair[]> {
  const { data, error } = await supabase
    .from('repairs').select(SELECT)
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) { console.error('getAllRepairsDB:', error.message); return []; }
  return (data ?? []).map(rowToRepair);
}

/** Réparations d'un site donné (fiche logement admin / partenaire). */
export async function getRepairsForApartmentDB(airbnbId: string): Promise<Repair[]> {
  const { data, error } = await supabase
    .from('repairs').select(SELECT)
    .eq('airbnb_id', airbnbId)
    .order('status', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) { console.error('getRepairsForApartmentDB:', error.message); return []; }
  return (data ?? []).map(rowToRepair);
}

/** Réparations créées depuis une mission donnée (rapport cleaner). */
export async function getRepairsForMissionDB(missionId: string): Promise<Repair[]> {
  const { data, error } = await supabase
    .from('repairs').select(SELECT)
    .eq('mission_id', missionId)
    .order('created_at', { ascending: false });
  if (error) { console.error('getRepairsForMissionDB:', error.message); return []; }
  return (data ?? []).map(rowToRepair);
}

export interface NewRepair {
  airbnbId: string;
  missionId?: string;
  description: string;
  createdBy?: string;
  createdRole?: Repair['createdRole'];
}

/**
 * Crée une réparation. Le partenaire propriétaire est repris du SITE (et non de
 * la mission) : c'est lui qui devra confirmer la réparation dans son espace.
 */
export async function createRepairDB(r: NewRepair): Promise<{ repair: Repair | null; error: string | null }> {
  const description = r.description.trim();
  if (!description) return { repair: null, error: 'Description requise.' };

  const { data: apt } = await supabase
    .from('airbnbs').select('partner_id').eq('id', r.airbnbId).maybeSingle();

  const { data, error } = await supabase.from('repairs').insert({
    airbnb_id: r.airbnbId,
    partner_id: apt?.partner_id ?? null,
    mission_id: r.missionId ?? null,
    description,
    status: 'open',
    created_by: r.createdBy ?? null,
    created_role: r.createdRole ?? null,
  }).select(SELECT).single();

  if (error) { console.error('createRepairDB:', error.message); return { repair: null, error: error.message }; }
  return { repair: rowToRepair(data), error: null };
}

/** Marque une réparation comme faite (propriétaire ou admin). */
export async function resolveRepairDB(id: string, resolvedBy?: string, note?: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('repairs').update({
    status: 'done',
    resolved_by: resolvedBy ?? null,
    resolved_note: note?.trim() || null,
    resolved_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) console.error('resolveRepairDB:', error.message);
  return { error: error?.message ?? null };
}

/** Rouvre une réparation clôturée par erreur. */
export async function reopenRepairDB(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('repairs').update({
    status: 'open', resolved_by: null, resolved_note: null, resolved_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  if (error) console.error('reopenRepairDB:', error.message);
  return { error: error?.message ?? null };
}

export async function deleteRepairDB(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('repairs').delete().eq('id', id);
  if (error) console.error('deleteRepairDB:', error.message);
  return { error: error?.message ?? null };
}
