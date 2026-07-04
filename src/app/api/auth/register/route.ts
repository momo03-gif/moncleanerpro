// ── POST /api/auth/register ──────────────────────────────────────────────────────
// Inscription PUBLIQUE d'un partenaire (hôtel ou conciergerie/airbnb), en attente de
// validation admin. Déplacée côté serveur pour ne plus écrire dans `users` avec la
// clé publique. Compte créé en bcrypt et en statut 'pending'.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { hashPassword } from '@/lib/password';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }

  const type = b.type;
  const email = (b.email ?? '').toLowerCase().trim();
  if ((type !== 'hotel' && type !== 'airbnb') || !email || !b.password || !b.name) {
    return NextResponse.json({ error: 'Champs manquants.' }, { status: 400 });
  }

  const db = getSupabaseAdmin();
  try {
    const hash = await hashPassword(b.password);
    const { data: user, error } = await db.from('users')
      .insert({ email, password_hash: hash, role: type, name: b.name, phone: b.phone ?? null, status: 'pending' })
      .select('id').single();
    if (error || !user) {
      const msg = /duplicate|unique/i.test(error?.message ?? '') ? 'Un compte existe déjà avec cet email.' : (error?.message ?? 'Création impossible.');
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (type === 'hotel') {
      const { data: h, error: hErr } = await db.from('hotels').insert({
        user_id: user.id, hotel_name: b.name, address: b.address ?? null, email: b.email, phone: b.phone ?? null, status_account: 'pending',
      }).select('id').single();
      if (hErr) return NextResponse.json({ error: hErr.message }, { status: 400 });
      // Type de client (hôtel / EHPAD). Best-effort : sans effet si la colonne
      // client_type n'existe pas encore (le compte reste « hôtel » par défaut).
      if (h && b.clientType === 'ehpad') {
        await db.from('hotels').update({ client_type: 'ehpad' }).eq('id', h.id);
      }
    } else {
      const { error: pErr } = await db.from('airbnb_partners').insert({
        user_id: user.id, partner_name: b.name, email: b.email, phone: b.phone ?? null, status_account: 'pending',
      });
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur.' }, { status: 500 });
  }
}
