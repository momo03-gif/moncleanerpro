// ── Grille tarifaire et simulateur, lus CÔTÉ SERVEUR (clé de service) ───────
// Seul chemin vers les prix pour les pages publiques et l'espace conciergerie :
// les tables `tarifs` et `devis_*` ne sont plus lisibles depuis le navigateur
// (cf. lib/devisEstimation.ts).

import 'server-only';
import { getSupabaseAdmin } from './supabaseAdmin';
import { toTarif, type Tarif } from './devis';
import { getSimulatorConfigDB, type SimulatorConfig } from './devisConfig';

export async function grilleTarifs(actifsSeulement = true): Promise<Tarif[]> {
  let q = getSupabaseAdmin().from('tarifs').select('*').order('created_at');
  if (actifsSeulement) q = q.eq('actif', true);
  const { data, error } = await q;
  if (error) { console.error('grilleTarifs:', error.message); return []; }
  return (data ?? []).map(toTarif);
}

export async function configSimulateur(): Promise<SimulatorConfig | null> {
  return getSimulatorConfigDB(getSupabaseAdmin());
}
