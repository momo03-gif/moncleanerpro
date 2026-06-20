import { supabase } from './supabase';
import { getSupabaseAdmin } from './supabaseAdmin';
import type { SupabaseClient } from '@supabase/supabase-js';

// ══════════════════════════════════════════════════════════════════════════════
//  Résolveur de client Supabase (LOT 4).
//  • Côté SERVEUR (routes API) : client service_role → contourne la RLS.
//  • Côté CLIENT (navigateur)  : client anon (clé publique).
//  Les modules de données RH (rh.ts, depenses.ts, rhEngine.ts) l'utilisent : ainsi
//  la même logique sert l'admin via routes serveur (service_role) tout en restant
//  inerte si jamais importée côté client (la clé service_role n'est jamais lue —
//  getSupabaseAdmin n'est appelé que lorsque `window` est absent).
// ══════════════════════════════════════════════════════════════════════════════

export function getServerDb(): SupabaseClient {
  if (typeof window === 'undefined') {
    try { return getSupabaseAdmin(); } catch { return supabase; }
  }
  return supabase;
}
