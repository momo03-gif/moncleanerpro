import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import {
  createParkingPaymentDB, getMissionParkingDB, getParkingPaymentsDB, getMissionCleanerUserId, quoteParkingDB,
} from '@/lib/parking';

// Paiements de stationnement (table verrouillée RLS) — SERVEUR (service_role).
// L'identité provient de la session signée (cookie httpOnly), jamais du corps de
// requête : un livreur ne peut payer/consulter que SA mission ; la liste globale
// est réservée à l'admin.
export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  const { op, args = {} } = body;

  // Un livreur n'agit que sur une mission qui lui est assignée (admin : accès total).
  async function assertMissionAccess(missionId: string): Promise<boolean> {
    if (session!.role === 'admin') return true;
    if (!missionId) return false;
    const ownerUserId = await getMissionCleanerUserId(missionId);
    return ownerUserId != null && ownerUserId === session!.id;
  }

  try {
    switch (op) {
      case 'record': {
        if (!args.missionId) return NextResponse.json({ error: 'Mission manquante.' }, { status: 400 });
        if (!(await assertMissionAccess(args.missionId))) {
          return NextResponse.json({ error: "Cette mission ne vous est pas assignée." }, { status: 403 });
        }
        const amount = args.amount != null ? Number(args.amount) : undefined;
        if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
          return NextResponse.json({ error: 'Montant invalide.' }, { status: 400 });
        }
        const durationMinutes = args.durationMinutes != null ? Math.round(Number(args.durationMinutes)) : undefined;
        // Position du livreur (contrôle de proximité 200 m côté createParkingPaymentDB).
        const coords = (typeof args.lat === 'number' && typeof args.lng === 'number')
          ? { lat: args.lat, lng: args.lng } : null;
        const clientToken = typeof args.clientToken === 'string' ? args.clientToken : undefined;
        const paidAt = typeof args.paidAt === 'string' ? args.paidAt : undefined;
        return NextResponse.json(await createParkingPaymentDB({
          missionId: args.missionId, amount, durationMinutes, cleanerName: session.name, coords, clientToken, paidAt,
        }));
      }
      case 'mission': {
        if (!args.missionId) return NextResponse.json({ error: 'Mission manquante.' }, { status: 400 });
        if (!(await assertMissionAccess(args.missionId))) {
          return NextResponse.json({ error: "Cette mission ne vous est pas assignée." }, { status: 403 });
        }
        return NextResponse.json(await getMissionParkingDB(args.missionId));
      }
      case 'quote': {
        if (!args.missionId) return NextResponse.json({ error: 'Mission manquante.' }, { status: 400 });
        if (!(await assertMissionAccess(args.missionId))) {
          return NextResponse.json({ error: "Cette mission ne vous est pas assignée." }, { status: 403 });
        }
        const duration = args.durationMinutes != null ? Math.round(Number(args.durationMinutes)) : undefined;
        return NextResponse.json({ quote: await quoteParkingDB(args.missionId, duration) });
      }
      case 'list': {
        if (session.role !== 'admin') return NextResponse.json({ error: 'Accès réservé à l’administrateur.' }, { status: 403 });
        return NextResponse.json(await getParkingPaymentsDB({ from: args.from, to: args.to, cleanerId: args.cleanerId }));
      }
      default:
        return NextResponse.json({ error: 'Opération inconnue.' }, { status: 400 });
    }
  } catch (e: any) {
    console.error('api/parking error:', op, e?.message);
    return NextResponse.json({ error: 'Erreur serveur parking.' }, { status: 500 });
  }
}
