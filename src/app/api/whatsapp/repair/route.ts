import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendWhatsAppTemplate, REPAIR_TEMPLATE } from '@/lib/whatsapp';

export const runtime = 'nodejs';

// Prévient la conciergerie sur WhatsApp qu'un dégât vient d'être signalé chez
// elle. Appelée en « best-effort » après la création d'une réparation : elle ne
// doit jamais faire échouer le signalement lui-même.
//
// Le destinataire n'est PAS choisi par l'appelant : on le résout côté serveur à
// partir du logement concerné (airbnbs.partner_id). Sinon n'importe qui pourrait
// faire envoyer un message à n'importe quel numéro.
//
// Body JSON : { airbnbId, description, reportedBy? }
export async function POST(req: NextRequest) {
  let body: { airbnbId?: string; description?: string; reportedBy?: string } = {};
  try { body = await req.json(); } catch { /* corps vide → refusé plus bas */ }

  if (!body.airbnbId || !body.description) {
    return NextResponse.json({ ok: false, error: 'airbnbId et description requis.' }, { status: 400 });
  }

  try {
    const admin = getSupabaseAdmin();

    // Le logement, et à travers lui son propriétaire de compte.
    const { data: apt } = await admin
      .from('airbnbs').select('name, partner_id').eq('id', body.airbnbId).maybeSingle();
    if (!apt?.partner_id) return NextResponse.json({ ok: true, sent: false, reason: 'no_partner' });

    // Consentement explicite : pas de case cochée, pas de message.
    const { data: user } = await admin
      .from('users').select('whatsapp_phone, whatsapp_enabled').eq('id', apt.partner_id).maybeSingle();
    if (!user?.whatsapp_enabled || !user.whatsapp_phone) {
      return NextResponse.json({ ok: true, sent: false, reason: 'opted_out' });
    }

    // Le modèle attend trois variables, et Meta refuse les sauts de ligne ou les
    // espaces doubles dans un paramètre : on aplatit la description.
    const description = body.description.replace(/\s+/g, ' ').trim().slice(0, 300);

    const result = await sendWhatsAppTemplate({
      to: user.whatsapp_phone as string,
      template: REPAIR_TEMPLATE,
      variables: [
        (apt.name as string) || 'Logement',
        description,
        body.reportedBy?.replace(/\s+/g, ' ').trim().slice(0, 60) || 'l’équipe',
      ],
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    // Journalisé, mais jamais remonté en erreur : le dégât est déjà enregistré.
    console.error('whatsapp/repair:', (e as Error)?.message);
    return NextResponse.json({ ok: true, sent: false, reason: 'server_error' });
  }
}
