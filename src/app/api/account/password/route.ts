// ── POST /api/account/password — changer son mot de passe ───────────────────
//
//  Il n'existait aucun chemin pour cela : un client qui voulait changer son mot
//  de passe devait nous écrire, et nous le remplacions depuis l'administration —
//  ce qui veut dire que quelqu'un d'autre que lui le connaissait.
//
//  DEUX RÈGLES, PAS UNE DE PLUS
//   1. L'ancien mot de passe est exigé. Sans lui, un téléphone resté déverrouillé
//      suffirait à verrouiller le propriétaire hors de son propre compte.
//   2. Le nouveau est haché en bcrypt côté serveur (jamais en clair, jamais côté
//      navigateur). Au passage, un compte encore en SHA-256 est migré.
//
//  Ouvert à TOUS les rôles : un cleaner en a autant besoin qu'un client.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { hashPassword, verifyPassword } from '@/lib/password';

export const runtime = 'nodejs';

/** Longueur minimale — la même qu'à l'inscription, sinon la règle ne vaut rien. */
const MIN = 8;

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  let b: { current?: string; next?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }

  const current = b.current ?? '';
  const next = b.next ?? '';
  if (!current) return NextResponse.json({ error: 'Saisissez votre mot de passe actuel.' }, { status: 400 });
  if (next.length < MIN) {
    return NextResponse.json({ error: `Le nouveau mot de passe doit faire au moins ${MIN} caractères.` }, { status: 400 });
  }
  if (next === current) {
    return NextResponse.json({ error: 'Le nouveau mot de passe est identique à l’ancien.' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data: row } = await db.from('users')
    .select('id, password_hash, deleted_at').eq('id', session.id).single();
  if (!row || row.deleted_at) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });

  const { ok } = await verifyPassword(current, row.password_hash);
  if (!ok) return NextResponse.json({ error: 'Mot de passe actuel incorrect.' }, { status: 403 });

  const { error } = await db.from('users')
    .update({ password_hash: await hashPassword(next) }).eq('id', session.id);
  if (error) {
    console.error('account/password:', error.message);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }

  // La session reste valide : l'utilisateur vient de prouver qu'il est bien lui.
  // Le déconnecter ici ne protégerait personne et perdrait son écran en cours.
  return NextResponse.json({ ok: true });
}
