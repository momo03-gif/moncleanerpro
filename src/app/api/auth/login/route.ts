// ── POST /api/auth/login ─────────────────────────────────────────────────────────
// Authentification CÔTÉ SERVEUR (le navigateur n'interroge plus la table users avec
// le hash du mot de passe). Vérifie les identifiants, migre l'ancien hash SHA-256
// vers bcrypt de façon transparente, applique le gating de statut/rôle, puis pose
// un cookie de session signé.

import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { verifyPassword, hashPassword } from '@/lib/password';
import { createSession } from '@/lib/session';
import type { SessionUser } from '@/lib/sessionToken';

export const runtime = 'nodejs';

// Client serveur : service_role si dispo (prod / futur RLS), sinon anon (dev local).
// Dans les deux cas la vérification du mot de passe se fait côté serveur.
function serverDb(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

const INVALID = { error: 'Identifiants incorrects.' };

export async function POST(req: Request) {
  let body: { email?: string; password?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }

  const email = (body.email ?? '').toLowerCase().trim();
  const password = body.password ?? '';
  if (!email || !password) return NextResponse.json(INVALID, { status: 401 });

  const db = serverDb();
  const { data: u, error } = await db.from('users').select('*').eq('email', email).single();
  if (error || !u) return NextResponse.json(INVALID, { status: 401 });

  const { ok, needsRehash } = await verifyPassword(password, u.password_hash);
  if (!ok) return NextResponse.json(INVALID, { status: 401 });

  // Gating statut / rôle — identique à l'ancien loginUser.
  if (u.role === 'cleaner' && u.status === 'inactive') {
    return NextResponse.json({ error: 'Compte désactivé.' }, { status: 403 });
  }
  if (u.role === 'hotel') {
    const { data: h } = await db.from('hotels').select('status_account').eq('user_id', u.id).single();
    if (h?.status_account === 'pending' || h?.status_account === 'refused') {
      return NextResponse.json({ error: 'Compte en attente de validation.' }, { status: 403 });
    }
  }
  if (u.role === 'airbnb') {
    const { data: p } = await db.from('airbnb_partners').select('status_account').eq('user_id', u.id).single();
    if (p?.status_account === 'pending' || p?.status_account === 'refused') {
      return NextResponse.json({ error: 'Compte en attente de validation.' }, { status: 403 });
    }
  }

  // Migration transparente SHA-256 → bcrypt (non bloquante si elle échoue).
  if (needsRehash) {
    try { await db.from('users').update({ password_hash: await hashPassword(password) }).eq('id', u.id); }
    catch { /* on n'empêche pas la connexion */ }
  }

  const sessionUser: SessionUser = {
    id: u.id, name: u.name, email: u.email, role: u.role,
    phone: u.phone ?? undefined, isActive: u.status === 'active',
  };
  await createSession(sessionUser);

  // On renvoie un objet compatible avec le type User (password vidé).
  return NextResponse.json({ user: { ...sessionUser, password: '' } });
}
