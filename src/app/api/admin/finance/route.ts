// ── /api/admin/finance ───────────────────────────────────────────────────────────
// Données financières sensibles (paiements/salaires versés, infos société dont IBAN)
// déplacées côté serveur : la clé publique ne doit plus pouvoir les lire/écrire.
// Réservé aux ADMINS (session), exécuté en service_role.

import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';

async function requireAdmin() {
  const s = await getSessionUser();
  return s && s.role === 'admin' ? s : null;
}

function rowToInvoice(r: any) {
  return {
    id: r.id,
    number: r.number ?? '',
    partnerLabel: r.partner_label ?? '',
    partnerType: r.partner_type ?? '',
    periodFrom: r.period_from ?? '',
    periodTo: r.period_to ?? '',
    total: Number(r.total) || 0,
    lines: Array.isArray(r.lines) ? r.lines : [],
    status: r.status ?? 'issued',
    createdAt: r.created_at ?? '',
  };
}

export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  const type = new URL(req.url).searchParams.get('type');
  const db = getSupabaseAdmin();

  if (type === 'payments') {
    const { data } = await db.from('payments').select('*').order('created_at', { ascending: false });
    const payments = (data ?? []).map((p: any) => ({
      id: p.id, cleanerId: p.cleaner_id, cleanerName: p.cleaner_name ?? '', amount: Number(p.amount),
      missionIds: p.missions_ids ?? [], date: p.paid_at ?? p.created_at?.split('T')[0] ?? '', month: p.period ?? '',
    }));
    return NextResponse.json({ payments });
  }

  if (type === 'company') {
    const { data, error } = await db.from('company_info').select('*').eq('id', 1).single();
    if (error || !data) return NextResponse.json({ company: {} });
    return NextResponse.json({ company: {
      name: data.name ?? undefined, address: data.address ?? undefined, siret: data.siret ?? undefined,
      vat: data.vat ?? undefined, email: data.email ?? undefined, phone: data.phone ?? undefined,
      iban: data.iban ?? undefined, bic: data.bic ?? undefined,
    } });
  }

  if (type === 'invoices') {
    const { data } = await db.from('invoices').select('*').order('created_at', { ascending: false });
    return NextResponse.json({ invoices: (data ?? []).map(rowToInvoice) });
  }

  return NextResponse.json({ error: 'Type inconnu.' }, { status: 400 });
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 });
  let b: any;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  const db = getSupabaseAdmin();

  try {
    if (b.type === 'payment') {
      await db.from('payments').insert({
        cleaner_id: b.cleanerId, cleaner_name: b.cleanerName, amount: b.amount,
        missions_ids: b.missionIds, period: b.month, status: 'paid',
        paid_at: new Date().toISOString().split('T')[0],
      });
      return NextResponse.json({ ok: true });
    }

    if (b.type === 'company') {
      const { error } = await db.from('company_info').upsert({
        id: 1,
        name: b.name || null, address: b.address || null, siret: b.siret || null, vat: b.vat || null,
        email: b.email || null, phone: b.phone || null, iban: b.iban || null, bic: b.bic || null,
        updated_at: new Date().toISOString(),
      });
      return NextResponse.json({ ok: !error, error: error?.message ?? null });
    }

    if (b.type === 'invoice') {
      const { error } = await db.from('invoices').insert({
        number: b.number, partner_label: b.partnerLabel, partner_type: b.partnerType,
        period_from: b.periodFrom, period_to: b.periodTo, total: b.total, lines: b.lines,
        status: 'issued',
      });
      return NextResponse.json({ ok: !error, error: error?.message ?? null });
    }

    return NextResponse.json({ error: 'Type inconnu.' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Erreur serveur.' }, { status: 500 });
  }
}
