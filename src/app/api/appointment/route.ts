import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// ══════════════════════════════════════════════════════════════════════════════
//  Réservation de rendez-vous — route SERVEUR (service_role).
//  Enregistre le créneau ET notifie les admins. L'index unique (date, time) en
//  base empêche deux réservations sur le même créneau (course → message clair).
// ══════════════════════════════════════════════════════════════════════════════

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }

  const clientName = String(b?.clientName ?? '').trim();
  const clientEmail = String(b?.clientEmail ?? '').trim();
  const clientPhone = String(b?.clientPhone ?? '').trim();
  const message = String(b?.message ?? '').trim();
  const devisNumber = String(b?.devisNumber ?? '').trim();
  const date = String(b?.date ?? '').trim();           // YYYY-MM-DD
  const time = String(b?.time ?? '').trim();            // HH:MM
  if (!clientName || !clientEmail || !date || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    return NextResponse.json({ error: 'Informations de rendez-vous incomplètes.' }, { status: 200 });
  }
  const refCode = `RDV-${date.replace(/-/g, '')}-${time.replace(':', '')}`;

  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e) { console.error('appointment admin client:', e); return NextResponse.json({ error: 'Service indisponible.' }, { status: 200 }); }

  const { error } = await admin.from('appointments').insert({
    ref_code: refCode, devis_number: devisNumber || null,
    client_name: clientName, client_email: clientEmail, client_phone: clientPhone || null,
    message: message || null, date, time, status: 'confirmed',
  });
  if (error) {
    // 23505 = violation d'unicité (créneau déjà réservé).
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Ce créneau vient d’être réservé. Choisissez-en un autre.' }, { status: 200 });
    }
    console.error('appointment insert:', error.message);
    return NextResponse.json({ error: 'Réservation impossible, réessayez.' }, { status: 200 });
  }

  // Notifier les admins (best-effort).
  try {
    const { data: admins } = await admin.from('users').select('id').eq('role', 'admin');
    const [y, mo, d] = date.split('-');
    const msg = `${clientName} a réservé un rendez-vous le ${d}/${mo}/${y} à ${time}${devisNumber ? ` (devis ${devisNumber})` : ''}.`;
    const rows = (admins ?? []).map((u: { id: string }) => ({
      user_id: u.id, role: 'admin', title: 'Nouveau rendez-vous', message: msg, type: 'appointment_booked', mission_id: null,
    }));
    if (rows.length) {
      await admin.from('notifications').insert(rows);
      try {
        const origin = new URL(req.url).origin;
        fetch(`${origin}/api/push`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: (admins ?? []).map((u: { id: string }) => ({ userId: u.id, title: 'Nouveau rendez-vous', body: msg, url: '/admin/rendez-vous', tag: 'appointment_booked' })) }),
        }).catch(() => {});
      } catch { /* ignore */ }
    }
  } catch (e) { console.error('appointment notify:', e); }

  return NextResponse.json({ ok: true, refCode }, { status: 200 });
}
