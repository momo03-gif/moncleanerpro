import { NextRequest, NextResponse } from 'next/server';
import { runReservationSync } from '@/lib/reservationSync';
import { generateRecurringMissions } from '@/lib/recurring';

export const runtime = 'nodejs';

// Synchronisation automatique de TOUS les flux actifs + matérialisation des
// missions de ménage. Protégée par CRON_SECRET (même schéma que /api/cron/reminders).
//
// NB : l'offre Vercel gratuite est limitée à 2 crons, déjà utilisés par les
// rappels. La synchro est donc aussi déclenchée en piggyback depuis
// /api/cron/reminders. Cette route reste disponible pour un déclenchement manuel
// (ops) ou pour basculer vers un cron dédié (Vercel Pro / Supabase pg_cron) sans
// changer de code.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    const key = new URL(req.url).searchParams.get('key');
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await runReservationSync();
    const imported = result.feeds.reduce((s, f) => s + f.imported, 0);
    let recurringGenerated = 0;
    try { recurringGenerated = (await generateRecurringMissions()).created; }
    catch (e) { console.error('recurring generation:', e); }
    return NextResponse.json({
      ok: true,
      feeds: result.feeds.length,
      imported,
      missionsCreated: result.materialized.created,
      recurringGenerated,
      errors: result.feeds.filter(f => !f.ok).map(f => ({ feedId: f.feedId, error: f.error })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('cron/reservations:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
