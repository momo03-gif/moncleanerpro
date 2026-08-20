// ── Configuration du simulateur de devis — accès données ──────────────────────
//
// Lecture seule côté navigateur : les quatre tables sont publiques en SELECT
// (le simulateur est une page publique) mais fermées en écriture. L'admin
// enregistre ses modifications par /api/admin/devis-config, qui vérifie la
// session et écrit avec la clé de service.
//
// Le calcul lui-même est dans devisSimulator.ts (pur, testé).

import { supabase } from './supabase';
import type {
  SimulatorConfig, SurfaceTier, QuoteZone, QuoteOption, CapacityStep, BathroomStep, UrgencyLevel,
} from './devisSimulator';

export type {
  SimulatorConfig, SurfaceTier, QuoteZone, QuoteOption, CapacityStep, BathroomStep, UrgencyLevel,
} from './devisSimulator';

function rowToTier(r: Record<string, unknown>): SurfaceTier {
  return {
    id: r.id as string,
    maxM2: Number(r.max_m2),
    label: (r.label as string) ?? '',
    capText: (r.cap_text as string) ?? undefined,
    basePrice: r.base_price == null ? null : Number(r.base_price),
  };
}

function rowToZone(r: Record<string, unknown>): QuoteZone {
  return {
    id: r.id as string,
    name: (r.name as string) ?? '',
    fee: Number(r.fee ?? 0),
    communes: Array.isArray(r.communes) ? (r.communes as string[]) : [],
    color: (r.color as string) ?? undefined,
  };
}

function rowToOption(r: Record<string, unknown>): QuoteOption {
  return {
    id: r.id as string,
    key: r.key as string,
    label: (r.label as string) ?? '',
    fee: Number(r.fee ?? 0),
    perCapacity: r.per_capacity === true,
    tiers: Array.isArray(r.tiers) ? (r.tiers as CapacityStep[]) : null,
    defaultOn: r.default_on === true,
  };
}

/**
 * Configuration complète du simulateur. Renvoie null si la grille de surface est
 * vide : mieux vaut afficher « configuration en cours » qu'un simulateur qui
 * chiffrerait à zéro.
 */
export async function getSimulatorConfigDB(): Promise<SimulatorConfig | null> {
  const [tiersRes, zonesRes, optionsRes, settingsRes] = await Promise.all([
    supabase.from('devis_surface_tiers').select('*').eq('active', true).order('max_m2'),
    supabase.from('devis_zones').select('*').eq('active', true).order('position'),
    supabase.from('devis_options').select('*').eq('active', true).order('position'),
    supabase.from('devis_settings').select('*').eq('id', 1).maybeSingle(),
  ]);

  if (tiersRes.error) { console.error('getSimulatorConfigDB(tiers):', tiersRes.error.message); return null; }
  const tiers = (tiersRes.data ?? []).map(rowToTier);
  if (tiers.length === 0) return null;

  const s = settingsRes.data as Record<string, unknown> | null;
  return {
    tiers,
    zones: (zonesRes.data ?? []).map(rowToZone),
    options: (optionsRes.data ?? []).map(rowToOption),
    capacitySurcharge: Array.isArray(s?.capacity_surcharge) ? (s!.capacity_surcharge as CapacityStep[]) : [],
    bathroomSurcharge: Array.isArray(s?.bathroom_surcharge) ? (s!.bathroom_surcharge as BathroomStep[]) : [],
    urgency: Array.isArray(s?.urgency) ? (s!.urgency as UrgencyLevel[]) : [],
    minM2: Number(s?.min_m2 ?? 12),
    maxM2: Number(s?.max_m2 ?? 230),
  };
}
