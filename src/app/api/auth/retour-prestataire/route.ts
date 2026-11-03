// ── POST /api/auth/retour-prestataire ────────────────────────────────────────
// Un prestataire en « mode terrain » (sa fiche agent personnelle, cf.
// lib/agentPerso.ts) revient à son espace prestataire, sans se reconnecter.
// Seul un compte à l'adresse réservée de SA fiche y a droit.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser, createSession } from '@/lib/session';
import { prestataireDeAgentPerso } from '@/lib/agentPerso';

export const runtime = 'nodejs';

export async function POST() {
  const session = await getSessionUser();
  const pid = session?.role === 'cleaner' ? prestataireDeAgentPerso(session.email) : null;
  if (!session || !pid) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });

  const db = getSupabaseAdmin();
  // La fiche doit bien être rattachée à ce prestataire (pas seulement l'adresse).
  const { data: fiche } = await db.from('cleaners').select('prestataire_id').eq('user_id', session.id).maybeSingle();
  if (fiche?.prestataire_id !== pid) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });

  const { data: pr } = await db.from('prestataires').select('user_id, status').eq('id', pid).maybeSingle();
  if (!pr || pr.status !== 'active') return NextResponse.json({ error: 'Compte suspendu. Contactez MonCleanerPro.' }, { status: 403 });
  const { data: u } = await db.from('users').select('id, name, email, phone, status, deleted_at').eq('id', pr.user_id).maybeSingle();
  if (!u || u.deleted_at || u.status === 'pending') return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });

  await createSession({ id: u.id, name: u.name, email: u.email, role: 'prestataire', phone: u.phone ?? undefined, isActive: u.status === 'active' });
  return NextResponse.json({ ok: true, redirect: '/prestataire' });
}
