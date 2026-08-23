import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const WD = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
function frDate(dateISO: string): string {
  const d = new Date(dateISO + 'T00:00:00');
  return `${WD[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// Envoi de l'email de confirmation au client (best-effort — n'échoue jamais la
// réservation). Réutilise la config SMTP Hostinger de l'app.
async function sendClientConfirmation(to: string, name: string, dateISO: string, time: string, refCode: string, devisNumber: string) {
  const user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  if (!user || !pass || !to) return;
  const host = process.env.SMTP_HOST || 'smtp.hostinger.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const from = process.env.SMTP_FROM || user;
  const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } });
  const when = `${frDate(dateISO)} à ${time}`;
  const text = `Bonjour ${name || ''},

Votre rendez-vous est bien enregistré :

  • Date : ${when}
  • Référence : ${refCode}${devisNumber ? `\n  • Devis : ${devisNumber}` : ''}

Nous vous recontactons pour confirmer les détails de l'intervention. Pour toute modification, répondez simplement à cet email.

À bientôt,
MonCleanerPro`;
  await transporter.sendMail({ from, to, subject: `Confirmation de votre rendez-vous — ${when}`, text });
}

// ══════════════════════════════════════════════════════════════════════════════
//  Réservation de rendez-vous — route SERVEUR (service_role).
//  Enregistre le créneau ET notifie les admins. L'index unique (date, time) en
//  base empêche deux réservations sur le même créneau (course → message clair).
// ══════════════════════════════════════════════════════════════════════════════

export const runtime = 'nodejs';

/**
 * Créneaux déjà réservés — lecture PUBLIQUE, volontairement limitée à la date et
 * l'heure. La table contient des données personnelles (nom, email, téléphone) et
 * n'est plus lisible avec la clé publique ; sans ce point d'entrée, la page de
 * réservation ne grise plus rien et deux clients peuvent prendre le même horaire.
 *
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD  → [{ date, time }]
 *   ?devis=DEV-0001                 → { date, time } | null
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const db = getSupabaseAdmin();

  // Jours ouvrés et créneaux : aucune donnée personnelle, mais la table n'est
  // plus lisible depuis le navigateur — sans ceci, la page de réservation
  // retombe sur les horaires par défaut et ignore ce qui est réglé en admin.
  if (searchParams.get('config')) {
    const { data } = await db.from('booking_config').select('*').eq('id', 1).maybeSingle();
    return NextResponse.json({ config: data ?? null });
  }

  const devis = searchParams.get('devis');
  if (devis) {
    const { data } = await db.from('appointments')
      .select('date, time').eq('devis_number', devis).eq('status', 'confirmed')
      .order('date', { ascending: true }).limit(1).maybeSingle();
    return NextResponse.json({ appointment: data ?? null });
  }

  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!from || !to) return NextResponse.json({ error: 'Période requise.' }, { status: 400 });

  const { data, error } = await db.from('appointments')
    .select('date, time').eq('status', 'confirmed').gte('date', from).lte('date', to);
  if (error) {
    console.error('appointment GET:', error.message);
    return NextResponse.json({ slots: [] });
  }
  return NextResponse.json({ slots: data ?? [] });
}

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

  // Email de confirmation au client (best-effort).
  try { await sendClientConfirmation(clientEmail, clientName, date, time, refCode, devisNumber); }
  catch (e) { console.error('appointment client email:', e); }

  return NextResponse.json({ ok: true, refCode }, { status: 200 });
}
