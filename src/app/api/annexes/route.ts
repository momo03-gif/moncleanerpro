import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { executerAnnexe } from '@/lib/annexes';

export const runtime = 'nodejs';

// Photos, rapports, réparations, cloche et abonnements push : lecture et
// écriture par le serveur, droits vérifiés sur la session (cf. lib/annexes.ts).
// Une seule entrée POST { op, … } : la plupart des lectures portent des listes
// d'identifiants qui n'ont rien à faire dans une URL.
export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  const r = await executerAnnexe(getSupabaseAdmin(), session, b);
  if (!r) return NextResponse.json({ error: 'Opération inconnue.' }, { status: 400 });
  return NextResponse.json(r.body, { status: r.status, headers: { 'Cache-Control': 'no-store' } });
}
