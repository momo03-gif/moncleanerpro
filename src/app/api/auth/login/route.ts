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
import { normalizePhone } from '@/lib/phone';

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

  // Identifiant : un email, ou un numéro de téléphone (comptes prestataires,
  // cf. users.login_phone). Le champ garde son nom `email` côté navigateur.
  const identifiant = (body.email ?? '').toLowerCase().trim();
  const password = body.password ?? '';
  if (!identifiant || !password) return NextResponse.json(INVALID, { status: 401 });
  const telephone = identifiant.includes('@') ? null : normalizePhone(identifiant);
  if (!identifiant.includes('@') && !telephone) return NextResponse.json(INVALID, { status: 401 });

  const db = serverDb();
  const { data: u, error } = telephone
    ? await db.from('users').select('*').eq('login_phone', telephone).maybeSingle()
    : await db.from('users').select('*').eq('email', identifiant).maybeSingle();
  if (error || !u) return NextResponse.json(INVALID, { status: 401 });

  // Compte supprimé par son titulaire : il ne se rouvre jamais, même si un
  // ancien mot de passe circule encore quelque part.
  if (u.deleted_at) return NextResponse.json(INVALID, { status: 401 });

  const { ok, needsRehash } = await verifyPassword(password, u.password_hash);
  if (!ok) return NextResponse.json(INVALID, { status: 401 });

  // Gating statut / rôle — identique à l'ancien loginUser.
  if (u.role === 'cleaner' && u.status === 'inactive') {
    return NextResponse.json({ error: 'Compte désactivé.' }, { status: 403 });
  }
  if (u.role === 'hotel') {
    const { data: h } = await db.from('hotels').select('status_account').eq('user_id', u.id).single();
    if (h?.status_account === 'suspended') {
      return NextResponse.json({ error: 'Compte suspendu. Contactez MonCleanerPro.' }, { status: 403 });
    }
    if (h?.status_account === 'pending' || h?.status_account === 'refused') {
      return NextResponse.json({ error: 'Compte en attente de validation.' }, { status: 403 });
    }
  }
  if (u.role === 'airbnb') {
    const { data: p } = await db.from('airbnb_partners').select('status_account').eq('user_id', u.id).single();
    if (p?.status_account === 'suspended') {
      return NextResponse.json({ error: 'Compte suspendu. Contactez MonCleanerPro.' }, { status: 403 });
    }
    if (p?.status_account === 'pending' || p?.status_account === 'refused') {
      return NextResponse.json({ error: 'Compte en attente de validation.' }, { status: 403 });
    }
  }

  // Prestataire suspendu : ni lui, ni ses agents ne se connectent.
  let agent = false;
  if (u.role === 'prestataire') {
    const { data: pr } = await db.from('prestataires').select('status').eq('user_id', u.id).maybeSingle();
    if (!pr) return NextResponse.json(INVALID, { status: 401 });
    if (u.status === 'pending') {
      return NextResponse.json({ error: 'Compte en attente de validation.' }, { status: 403 });
    }
    if (pr.status === 'suspended') {
      return NextResponse.json({ error: 'Compte suspendu. Contactez MonCleanerPro.' }, { status: 403 });
    }
  }
  if (u.role === 'cleaner') {
    // Agent d'un prestataire : best-effort (sans la migration, la colonne
    // n'existe pas et la requête échoue — le cleaner reste un cleaner).
    const { data: c } = await db.from('cleaners').select('prestataire_id, prestataires(status)')
      .eq('user_id', u.id).maybeSingle();
    if (c?.prestataire_id) {
      agent = true;
      if ((c.prestataires as { status?: string } | null)?.status === 'suspended') {
        return NextResponse.json({ error: 'Compte suspendu. Contactez votre prestataire.' }, { status: 403 });
      }
    }
  }

  // Migration transparente SHA-256 → bcrypt (non bloquante si elle échoue).
  if (needsRehash) {
    try { await db.from('users').update({ password_hash: await hashPassword(password) }).eq('id', u.id); }
    catch { /* on n'empêche pas la connexion */ }
  }

  const sessionUser: SessionUser = {
    id: u.id, name: u.name, email: u.email ?? '', role: u.role,
    phone: u.phone ?? undefined, isActive: u.status === 'active',
    ...(agent ? { agent: true } : {}),
  };
  await createSession(sessionUser);

  // On renvoie un objet compatible avec le type User (password vidé).
  return NextResponse.json({ user: { ...sessionUser, password: '' } });
}
