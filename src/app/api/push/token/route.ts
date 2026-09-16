// ── /api/push/token — enregistrement d'un appareil natif (iOS) ───────────────────
// L'application mobile reçoit de l'OS un « device token » à chaque démarrage et
// nous l'envoie ici. C'est l'équivalent natif de l'abonnement Web Push.
//
// La table native_push_tokens est fermée au rôle anon (RLS) : l'écriture passe
// donc obligatoirement par cette route, qui identifie l'utilisateur par le
// cookie de session signé — impossible d'inscrire un appareil sur le compte
// d'un autre.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

const PLATFORMS = new Set(['ios', 'android']);
const ENVIRONMENTS = new Set(['production', 'sandbox']);

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  let b: { token?: string; platform?: string; environment?: string; appVersion?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }

  const token = (b.token ?? '').trim();
  const platform = (b.platform ?? '').toLowerCase();
  if (!token || !PLATFORMS.has(platform)) {
    return NextResponse.json({ error: 'token et platform requis.' }, { status: 400 });
  }
  const environment = ENVIRONMENTS.has(b.environment ?? '') ? b.environment : 'production';

  const { error } = await getSupabaseAdmin().from('native_push_tokens').upsert({
    user_id: user.id,
    role: user.role,
    platform,
    token,
    bundle_id: process.env.IOS_BUNDLE_ID || 'fr.moncleanerpro.app',
    environment,
    app_version: b.appVersion ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'token' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Appelée à la déconnexion : sans cela, le téléphone continuerait de recevoir
// les notifications du compte précédent (cas des téléphones partagés entre
// cleaners, fréquent sur le terrain).
export async function DELETE(req: Request) {
  let b: { token?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  const token = (b.token ?? '').trim();
  if (!token) return NextResponse.json({ error: 'token requis.' }, { status: 400 });

  await getSupabaseAdmin().from('native_push_tokens').delete().eq('token', token);
  return NextResponse.json({ ok: true });
}
