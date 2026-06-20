import { NextRequest, NextResponse } from 'next/server';
import { runReservationSync } from '@/lib/reservationSync';

export const runtime = 'nodejs';

// Synchronisation manuelle (bouton « Synchroniser maintenant » côté partenaire).
// Body JSON : { partnerId? , feedId? } — cible un partenaire ou un flux précis.
// Sans filtre, synchronise tous les flux actifs (réservé à un usage admin/cron).
export async function POST(req: NextRequest) {
  let body: { partnerId?: string; feedId?: string } = {};
  try { body = await req.json(); } catch { /* corps vide accepté */ }

  try {
    const result = await runReservationSync({ partnerId: body.partnerId, feedId: body.feedId });
    const imported = result.feeds.reduce((s, f) => s + f.imported, 0);
    const errors = result.feeds.filter(f => !f.ok).map(f => f.error);
    return NextResponse.json({
      ok: true,
      feeds: result.feeds.length,
      imported,
      missionsCreated: result.materialized.created,
      errors,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('reservations/sync:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
