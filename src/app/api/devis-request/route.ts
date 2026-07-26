import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

// ══════════════════════════════════════════════════════════════════════════════
//  Demande de devis PUBLIQUE (page /devis-en-ligne) — route SERVEUR (service_role).
//  Enregistre le devis en BROUILLON (source 'public' → « à traiter » côté admin)
//  ET notifie tous les admins. Passe par le serveur pour ne PAS dépendre des droits
//  anonymes (lecture de `users`, écriture `notifications`) et bypasser la RLS.
//  Les notifications sont best-effort : elles ne doivent jamais faire échouer la
//  demande du client.
// ══════════════════════════════════════════════════════════════════════════════

export const runtime = 'nodejs';

interface Line { nom: string; quantite: number; prix_unitaire: number; total: number; }

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }

  const clientName = String(body?.clientName ?? '').trim();
  const clientEmail = String(body?.clientEmail ?? '').trim();
  const clientAddress = String(body?.clientAddress ?? '').trim();
  const description = String(body?.description ?? '').trim();
  const lines: Line[] = Array.isArray(body?.lines) ? (body.lines as Line[]) : [];
  const total = Number(body?.total) || 0;
  if (!clientName || !clientEmail) return NextResponse.json({ error: 'Nom et email requis.' }, { status: 200 });

  let admin;
  try { admin = getSupabaseAdmin(); }
  catch (e) { console.error('devis-request admin client:', e); return NextResponse.json({ error: 'Service indisponible.' }, { status: 200 }); }

  // Numéro DEV-AAAA-0001 (incrément annuel).
  const year = new Date().getFullYear();
  const { data: existing } = await admin.from('devis').select('number').like('number', `DEV-${year}-%`);
  const max = (existing ?? []).reduce((m: number, r: { number: string }) => {
    const n = parseInt(String(r.number).split('-')[2] ?? '0', 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  const number = `DEV-${year}-${String(max + 1).padStart(4, '0')}`;

  const { error } = await admin.from('devis').insert({
    number, partner_label: clientName || 'Demande en ligne', partner_type: 'devis',
    client_name: clientName, client_email: clientEmail, client_address: clientAddress || null,
    description: description || null, lines, total, status: 'brouillon', source: 'public',
  });
  if (error) { console.error('devis-request insert:', error.message); return NextResponse.json({ error: "Enregistrement impossible, réessayez." }, { status: 200 }); }

  // Notifier les admins (best-effort).
  try {
    const { data: admins } = await admin.from('users').select('id').eq('role', 'admin');
    const message = `${clientName} a demandé un devis en ligne${total ? ` (~${Math.round(total)} €)` : ''}. À traiter.`;
    const rows = (admins ?? []).map((u: { id: string }) => ({
      user_id: u.id, role: 'admin', title: 'Nouvelle demande de devis',
      message, type: 'devis_request', mission_id: null,
    }));
    if (rows.length) {
      await admin.from('notifications').insert(rows);
      // Push best-effort (ne bloque pas la réponse).
      try {
        const origin = new URL(req.url).origin;
        fetch(`${origin}/api/push`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: (admins ?? []).map((u: { id: string }) => ({
              userId: u.id, title: 'Nouvelle demande de devis', body: message,
              url: '/admin/facturation', tag: 'devis_request',
            })),
          }),
        }).catch(() => {});
      } catch { /* ignore */ }
    }
  } catch (e) { console.error('devis-request notify:', e); }

  return NextResponse.json({ ok: true, number }, { status: 200 });
}
