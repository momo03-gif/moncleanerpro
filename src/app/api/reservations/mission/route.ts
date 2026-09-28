import { NextRequest, NextResponse } from 'next/server';
import { exigerAdmin } from '@/lib/apiGuard';
import { forcerMenagePourReservation } from '@/lib/reservationSync';

export const runtime = 'nodejs';

// Créer le ménage d'une réservation que la synchro n'a pas retenue.
//
// Les calendriers de certaines plateformes ne disent pas si une période est une
// réservation ou un blocage : Booking emploie le même intitulé pour les deux.
// Aucune règle ne peut trancher à tous les coups, alors l'exploitant tranche —
// il a l'information, le flux ne l'a pas. Réservé à l'administration : créer une
// mission engage un intervenant et une facturation.
//
// Body JSON : { reservationId }
export async function POST(req: NextRequest) {
  const { refus } = await exigerAdmin();
  if (refus) return refus;

  let body: { reservationId?: string } = {};
  try { body = await req.json(); } catch { /* corps vide → erreur plus bas */ }

  const id = (body.reservationId ?? '').trim();
  if (!id) return NextResponse.json({ ok: false, error: 'Réservation manquante.' }, { status: 400 });

  try {
    const res = await forcerMenagePourReservation(id);
    return NextResponse.json(res, { status: res.ok ? 200 : 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('reservations/mission:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
