import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { exigerAdmin } from '@/lib/apiGuard';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Administration de la réception directe (webhooks).
//
// Une URL par partenaire et par logiciel, porteuse d'un secret : c'est elle
// qu'on donne à la conciergerie pour qu'elle la colle dans son logiciel. Le
// secret EST l'authentification — l'éditeur ne signe pas toujours ses appels, et
// une URL impossible à deviner reste la garantie la plus simple à tenir.
//
// Body JSON : { action, partnerId?, source? }. Admin uniquement.
export async function POST(req: NextRequest) {
  const { refus } = await exigerAdmin();
  if (refus) return refus;

  let body: { action?: 'abonnement' | 'regenerer' | 'evenements'; partnerId?: string; source?: string } = {};
  try { body = await req.json(); } catch { /* corps vide → refusé plus bas */ }

  const action = body.action ?? 'abonnement';
  const source = (body.source ?? 'superhote').trim();
  const partnerId = (body.partnerId ?? '').trim();

  const db = getSupabaseAdmin();

  try {
    // ── Les derniers évènements reçus, pour voir ce que l'éditeur envoie ────
    // C'est ce qui manquait partout : sans l'évènement sous les yeux, on en est
    // réduit à deviner le nom des champs.
    if (action === 'evenements') {
      let q = db.from('webhook_events')
        .select('id, source, resultat, note, payload, created_at')
        .order('created_at', { ascending: false })
        .limit(20);
      if (partnerId) q = q.eq('partner_id', partnerId);
      const { data } = await q;
      return NextResponse.json({
        ok: true,
        evenements: (data ?? []).map(e => ({
          id: e.id, source: e.source, resultat: e.resultat, note: e.note,
          recuLe: e.created_at,
          // On rend la FORME, pas le contenu : le corps porte le nom et le
          // contact du voyageur de notre client.
          champs: Object.keys((e.payload ?? {}) as Record<string, unknown>).slice(0, 30),
        })),
      });
    }

    if (!partnerId) return NextResponse.json({ error: 'Partenaire manquant.' }, { status: 400 });

    if (action === 'regenerer') {
      const secret = randomBytes(24).toString('base64url');
      const { error } = await db.from('webhook_subscriptions')
        .update({ secret, active: true })
        .eq('partner_id', partnerId).eq('source', source);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, secret });
    }

    // ── L'abonnement du partenaire, créé s'il n'existe pas encore ───────────
    const { data: existant } = await db.from('webhook_subscriptions')
      .select('secret, active, last_seen_at')
      .eq('partner_id', partnerId).eq('source', source)
      .maybeSingle();
    if (existant) return NextResponse.json({ ok: true, ...existant });

    const secret = randomBytes(24).toString('base64url');
    const { error } = await db.from('webhook_subscriptions')
      .insert({ partner_id: partnerId, source, secret });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, secret, active: true, last_seen_at: null });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('reservations/webhook-admin:', message);
    // La migration `migration_webhooks.sql` n'est peut-être pas encore jouée :
    // on le dit en clair plutôt que de laisser une erreur Postgres à l'écran.
    const manque = /relation .*webhook_/i.test(message);
    return NextResponse.json({
      error: manque
        ? 'La table des webhooks n’existe pas encore : exécutez supabase/migration_webhooks.sql.'
        : message,
    }, { status: 500 });
  }
}
