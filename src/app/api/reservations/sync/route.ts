import { NextRequest, NextResponse } from 'next/server';
import { exigerInterne, exigerSession } from '@/lib/apiGuard';
import { runReservationSync } from '@/lib/reservationSync';

export const runtime = 'nodejs';

// Synchronisation manuelle (bouton « Synchroniser maintenant » côté partenaire).
// Body JSON : { partnerId? , feedId? } — cible un partenaire ou un flux précis.
// Sans filtre, synchronise tous les flux actifs (réservé à un usage admin/cron).
export async function POST(req: NextRequest) {
  // Declencher une synchro fait partir des requetes vers les APIs de nos
  // clients : reserve aux personnes connectees (ou a un appel interne).
  const { refus } = await exigerInterne(req);
  if (refus) {
    const { refus: refusSession } = await exigerSession();
    if (refusSession) return refusSession;
  }

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
      // Ménages dont l'arrivée suivante a été mise à jour (réservation tombée
      // après la création du ménage) — utile pour vérifier que ça tourne.
      turnoversRefreshed: result.materialized.refreshed,
      // Ménages en attente remis d'aplomb sur la fiche logement.
      realigned: result.materialized.realigned,
      errors,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('reservations/sync:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
