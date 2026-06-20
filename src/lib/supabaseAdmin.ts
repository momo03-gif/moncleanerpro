import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ══════════════════════════════════════════════════════════════════════════════
//  Client Supabase SERVEUR (service_role) — LOT 4 « Sécurité RH ».
//  ⚠️ À n'importer QUE dans des routes API serveur (jamais côté client).
//  La clé service_role contourne la RLS : elle ne doit JAMAIS arriver au navigateur.
//  Variable d'env (Vercel, server-only, SANS préfixe NEXT_PUBLIC) : SUPABASE_SERVICE_ROLE_KEY.
//
//  Construction PARESSEUSE : le client n'est créé qu'au 1er appel (à l'exécution
//  d'une requête), jamais à l'import — sinon le build échoue là où la clé n'est pas
//  présente (collecte des pages). Lève une erreur explicite si la clé manque.
// ══════════════════════════════════════════════════════════════════════════════

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY (ou URL) manquante côté serveur.');
  }
  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
