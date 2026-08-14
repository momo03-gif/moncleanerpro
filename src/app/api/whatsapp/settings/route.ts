import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { normalizePhone } from '@/lib/phone';
import { isWhatsAppConfigured } from '@/lib/whatsapp';

export const runtime = 'nodejs';

// Réglage « recevoir les alertes sur WhatsApp » d'un utilisateur.
// Passe par le serveur parce que la table `users` est verrouillée en écriture
// (RLS) : le navigateur ne peut pas y toucher, et c'est très bien ainsi.
//
// Chacun ne règle QUE son propre compte : l'identité vient de la session
// signée, jamais du corps de la requête.

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  const { data } = await getSupabaseAdmin()
    .from('users').select('whatsapp_phone, whatsapp_enabled').eq('id', session.id).maybeSingle();

  return NextResponse.json({
    phone: data?.whatsapp_phone ?? null,
    enabled: !!data?.whatsapp_enabled,
    // Permet à l'interface de dire honnêtement « pas encore actif » plutôt que
    // de laisser croire que les messages partent.
    available: isWhatsAppConfigured(),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  let body: { phone?: string; enabled?: boolean } = {};
  try { body = await req.json(); } catch { /* corps vide → refusé plus bas */ }

  const enabled = !!body.enabled;
  const phone = normalizePhone(body.phone);
  if (enabled && !phone) {
    return NextResponse.json({ error: 'Numéro de téléphone invalide.' }, { status: 400 });
  }

  const { error } = await getSupabaseAdmin()
    .from('users')
    .update({ whatsapp_phone: phone, whatsapp_enabled: enabled })
    .eq('id', session.id);

  if (error) {
    console.error('whatsapp/settings:', error.message);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, phone, enabled });
}
