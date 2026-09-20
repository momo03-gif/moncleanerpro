import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// ── Le devis vu par le client, depuis son lien ───────────────────────────────
//
// Ici, pas de session : le client n'a pas de compte. C'est le JETON du lien qui
// fait foi — long, imprévisible, et propre à un seul devis. On ne renvoie donc
// que celui-là, et jamais la liste.
//
// Un jeton inconnu reçoit la même réponse qu'un jeton mal formé : « introuvable ».
// Rien dans la réponse ne permet de deviner qu'un devis existe ailleurs.

const INTROUVABLE = NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 });

function jetonValide(t: string | null): t is string {
  return !!t && t.length >= 12 && /^[A-Za-z0-9_-]+$/.test(t);
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token');
  if (!jetonValide(token)) return INTROUVABLE;

  const db = getSupabaseAdmin();
  const { data, error } = await db.from('devis').select('*').eq('public_token', token).maybeSingle();
  if (error || !data) return INTROUVABLE;
  return NextResponse.json({ devis: data });
}

export async function POST(req: NextRequest) {
  let b: { token?: string; status?: string } = {};
  try { b = await req.json(); } catch { return INTROUVABLE; }
  if (!jetonValide(b.token ?? null)) return INTROUVABLE;

  // Le client n'a que deux réponses possibles. Tout le reste appartient à
  // l'administration : il ne peut ni remettre un devis en brouillon, ni le
  // marquer facturé.
  if (b.status !== 'accepte' && b.status !== 'refuse') {
    return NextResponse.json({ error: 'Réponse invalide.' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  const { data: devis } = await db.from('devis')
    .select('id, status, invoice_id').eq('public_token', b.token!).maybeSingle();
  if (!devis) return INTROUVABLE;

  // Un devis déjà facturé ne se refuse plus : la prestation est engagée.
  if (devis.invoice_id) {
    return NextResponse.json({ error: 'Ce devis a déjà été facturé.' }, { status: 400 });
  }

  const { error } = await db.from('devis').update({ status: b.status }).eq('id', devis.id);
  if (error) { console.error('devis/public respond:', error.message); return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
