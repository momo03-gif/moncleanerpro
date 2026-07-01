// ── /api/cleaners ────────────────────────────────────────────────────────────
// Écritures sur la table `cleaners` (taux, salaires, capacités, statut, dispos,
// plaque) — déplacées côté serveur : la clé publique ne doit plus pouvoir écrire
// (sinon : faux cleaner / sabotage de salaire). service_role + session.
//   • Ops ADMIN (par cleaners.id) : activation, taux horaire, capacités, taux
//     livraison, type d'emploi.
//   • Ops SELF (par users.id) : un cleaner ne modifie que SA plaque / Son statut
//     de dispo / Ses jours travaillés.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser } from '@/lib/session';
import type { SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Résout users.id → cleaners.id (fallback : l'id passé, cas où cleaners = users.id).
async function resolveCleanerId(db: SupabaseClient, userId: string): Promise<string> {
  const { data } = await db.from('cleaners').select('id').eq('user_id', userId).single();
  return data?.id ?? userId;
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });
  const isAdmin = session.role === 'admin';
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  const db = getSupabaseAdmin();

  const adminOnly = () => NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  // Op « self » : le cleaner n'agit que sur son propre compte (admin : accès total).
  const selfDenied = (userId: string) => !isAdmin && userId !== session.id;

  try {
    switch (b.op) {
      // ── ADMIN (par cleaners.id) ──
      case 'setActive': {
        if (!isAdmin) return adminOnly();
        const { error } = await db.from('cleaners').update({ status: b.active ? 'active' : 'inactive' }).eq('id', b.id);
        return NextResponse.json({ ok: !error, error: error?.message ?? null });
      }
      case 'hourlyRate': {
        if (!isAdmin) return adminOnly();
        const { error } = await db.from('cleaners').update({ hourly_rate: b.hourlyRate }).eq('id', b.id);
        return NextResponse.json({ ok: !error, error: error?.message ?? null });
      }
      case 'capabilities': {
        if (!isAdmin) return adminOnly();
        const { error } = await db.from('cleaners').update({ can_clean: b.canClean, can_deliver: b.canDeliver }).eq('id', b.id);
        return NextResponse.json({ ok: !error, error: error?.message ?? null });
      }
      case 'deliveryRate': {
        if (!isAdmin) return adminOnly();
        const { error } = await db.from('cleaners').update({ delivery_rate: b.deliveryRate }).eq('id', b.id);
        return NextResponse.json({ ok: !error, error: error?.message ?? null });
      }
      case 'employmentType': {
        if (!isAdmin) return adminOnly();
        const { error } = await db.from('cleaners').update({ employment_type: b.employmentType }).eq('id', b.id);
        return NextResponse.json({ ok: !error, error: error?.message ?? null });
      }

      // ── SELF (par users.id) ──
      case 'licensePlate': {
        if (selfDenied(b.userId)) return adminOnly();
        const targetId = await resolveCleanerId(db, b.userId);
        const { error } = await db.from('cleaners').update({ license_plate: (b.plate ?? '').trim() || null }).eq('id', targetId);
        return NextResponse.json({ ok: !error, error: error?.message ?? null });
      }
      case 'status': {
        if (selfDenied(b.userId)) return adminOnly();
        const targetId = await resolveCleanerId(db, b.userId);
        const { error } = await db.from('cleaners').update({ status: b.status }).eq('id', targetId);
        return NextResponse.json({ ok: !error, error: error?.message ?? null });
      }
      case 'availableDays': {
        if (selfDenied(b.userId)) return adminOnly();
        const targetId = await resolveCleanerId(db, b.userId);
        const { error } = await db.from('cleaners').update({ available_days: b.days }).eq('id', targetId);
        return NextResponse.json({ ok: !error, error: error?.message ?? null });
      }

      default:
        return NextResponse.json({ error: 'Opération inconnue.' }, { status: 400 });
    }
  } catch (e: any) {
    console.error('api/cleaners error:', b?.op, e?.message);
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur.' }, { status: 500 });
  }
}
