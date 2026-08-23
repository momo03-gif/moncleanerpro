import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Liste des rendez-vous et changement de statut, côté administration.
//
// La table `appointments` porte des données personnelles (nom, email,
// téléphone) : elle n'est pas lisible avec la clé publique. L'écran admin lisait
// pourtant directement depuis le navigateur — il recevait zéro ligne sans la
// moindre erreur, et affichait donc une liste vide alors que les rendez-vous
// étaient bien enregistrés.

async function requireAdmin() {
  const s = await getSessionUser();
  return s && s.role === 'admin' ? s : null;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Réservé à l’administration.' }, { status: 403 });

  const { data, error } = await getSupabaseAdmin()
    .from('appointments').select('*')
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (error) {
    console.error('admin/appointments GET:', error.message);
    return NextResponse.json({ error: 'Lecture impossible.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    appointments: (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      refCode: r.ref_code ?? '',
      devisNumber: r.devis_number ?? undefined,
      clientName: r.client_name ?? '',
      clientEmail: r.client_email ?? undefined,
      clientPhone: r.client_phone ?? undefined,
      message: r.message ?? undefined,
      date: r.date,
      time: r.time,
      status: r.status ?? 'confirmed',
      createdAt: r.created_at ?? undefined,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Réservé à l’administration.' }, { status: 403 });

  let body: {
    action?: string; id?: string; status?: string;
    config?: { workingDays?: number[]; morning?: string[]; afternoon?: string[]; slotMin?: number };
  } = {};
  try { body = await req.json(); } catch { /* corps vide → refusé plus bas */ }

  // Disponibilités du calendrier. L'écran écrivait directement depuis le
  // navigateur : « new row violates row-level security policy ».
  if (body.action === 'config') {
    const c = body.config ?? {};
    const { error } = await getSupabaseAdmin().from('booking_config').upsert({
      id: 1,
      working_days: c.workingDays ?? [],
      morning: c.morning ?? [],
      afternoon: c.afternoon ?? [],
      slot_min: Number(c.slotMin) || 60,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error('admin/appointments config:', error.message);
      return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  if (!body.id || !['confirmed', 'cancelled', 'done'].includes(body.status ?? '')) {
    return NextResponse.json({ error: 'Rendez-vous et statut requis.' }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin()
    .from('appointments').update({ status: body.status }).eq('id', body.id);
  if (error) {
    console.error('admin/appointments POST:', error.message);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
