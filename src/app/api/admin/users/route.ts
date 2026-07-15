// ── POST /api/admin/users ────────────────────────────────────────────────────────
// Opérations sensibles sur la table `users`, déplacées CÔTÉ SERVEUR pour qu'elles ne
// soient plus faisables avec la clé publique (sinon : création de faux admin, vol de
// mot de passe…). Réservé aux ADMINS (session), exécuté en service_role.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser } from '@/lib/session';
import { hashPassword } from '@/lib/password';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  }

  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }

  const db = getSupabaseAdmin();

  try {
    switch (b.action) {
      case 'createCleaner': {
        const hash = await hashPassword(b.password || 'cleaner123');
        const { data: user, error } = await db.from('users')
          .insert({ email: (b.email ?? '').toLowerCase().trim(), password_hash: hash, role: 'cleaner', name: b.name, phone: b.phone ?? null, status: 'active' })
          .select('id').single();
        if (error || !user) return NextResponse.json({ error: error?.message ?? 'Création impossible.' }, { status: 400 });
        const { error: cErr } = await db.from('cleaners').insert({
          user_id: user.id, name: b.name, email: b.email, phone: b.phone ?? null,
          hourly_rate: b.hourlyRate ?? 0, can_clean: b.canClean ?? true,
          can_deliver: b.canDeliver ?? false, delivery_rate: b.deliveryRate ?? 0, status: 'active',
        });
        if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });
        return NextResponse.json({ ok: true, id: user.id });
      }

      case 'updateCleanerInfo': {
        const { error } = await db.from('cleaners').update({ name: b.name, email: b.email, phone: b.phone ?? null }).eq('id', b.id);
        const { data: c } = await db.from('cleaners').select('user_id').eq('id', b.id).single();
        const userId = c?.user_id ?? b.id;
        await db.from('users').update({ name: b.name, email: (b.email ?? '').toLowerCase().trim(), phone: b.phone ?? null }).eq('id', userId);
        return NextResponse.json({ ok: true, error: error?.message ?? null });
      }

      case 'deleteCleaner': {
        const { data: c } = await db.from('cleaners').select('user_id').eq('id', b.id).single();
        const userId = c?.user_id ?? b.id;
        await db.from('cleaners').delete().eq('id', b.id);
        await db.from('users').delete().eq('id', userId);
        return NextResponse.json({ ok: true });
      }

      case 'setCleanerPassword': {
        const hash = await hashPassword(b.password);
        const { data: c } = await db.from('cleaners').select('user_id').eq('id', b.cleanerId).single();
        const userId = c?.user_id ?? b.cleanerId;
        await db.from('users').update({ password_hash: hash }).eq('id', userId);
        return NextResponse.json({ ok: true });
      }

      case 'approveHotel': {
        await db.from('hotels').update({ status_account: 'approved' }).eq('id', b.id);
        const { data } = await db.from('hotels').select('user_id').eq('id', b.id).single();
        if (data?.user_id) await db.from('users').update({ status: 'active' }).eq('id', data.user_id);
        return NextResponse.json({ ok: true });
      }

      case 'approveAirbnb': {
        await db.from('airbnb_partners').update({ status_account: 'approved' }).eq('id', b.id);
        const { data } = await db.from('airbnb_partners').select('user_id').eq('id', b.id).single();
        if (data?.user_id) await db.from('users').update({ status: 'active' }).eq('id', data.user_id);
        return NextResponse.json({ ok: true });
      }

      // ── Administration des comptes PARTENAIRES (hôtels & conciergeries) ──────
      // kind: 'hotel' → table hotels / colonne nom hotel_name
      //       'airbnb' → table airbnb_partners / colonne nom partner_name
      case 'updatePartnerInfo': {
        const isAirbnb = b.kind === 'airbnb';
        const table = isAirbnb ? 'airbnb_partners' : 'hotels';
        const nameCol = isAirbnb ? 'partner_name' : 'hotel_name';
        const email = (b.email ?? '').toLowerCase().trim();
        const patch: any = { [nameCol]: b.name, email, phone: b.phone ?? null };
        if (!isAirbnb && b.address !== undefined) patch.address = b.address ?? null;
        const { data: row, error } = await db.from(table).update(patch).eq('id', b.id).select('user_id').single();
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        const userId = row?.user_id ?? b.userId;
        if (userId) await db.from('users').update({ name: b.name, email, phone: b.phone ?? null }).eq('id', userId);
        return NextResponse.json({ ok: true });
      }

      case 'setPartnerPassword': {
        const table = b.kind === 'airbnb' ? 'airbnb_partners' : 'hotels';
        const { data: row } = await db.from(table).select('user_id').eq('id', b.id).single();
        const userId = row?.user_id ?? b.userId;
        if (!userId) return NextResponse.json({ error: 'Compte introuvable.' }, { status: 404 });
        await db.from('users').update({ password_hash: await hashPassword(b.password) }).eq('id', userId);
        return NextResponse.json({ ok: true });
      }

      case 'setPartnerStatus': {
        // Suspend (bloque la connexion) / réactive un compte partenaire.
        // Le gating de connexion se fait sur status_account, pas users.status.
        const table = b.kind === 'airbnb' ? 'airbnb_partners' : 'hotels';
        const status = b.suspend ? 'suspended' : 'approved';
        const { error } = await db.from(table).update({ status_account: status }).eq('id', b.id);
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        return NextResponse.json({ ok: true });
      }

      case 'deletePartner': {
        // Supprime la fiche partenaire + son compte users. Les missions liées
        // sont conservées (FK partner_id ON DELETE SET NULL).
        const table = b.kind === 'airbnb' ? 'airbnb_partners' : 'hotels';
        const { data: row } = await db.from(table).select('user_id').eq('id', b.id).single();
        const userId = row?.user_id ?? b.userId;
        await db.from(table).delete().eq('id', b.id);
        if (userId) await db.from('users').delete().eq('id', userId);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur.' }, { status: 500 });
  }
}
