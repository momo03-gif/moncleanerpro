import { NextResponse } from 'next/server';
import { exigerAdmin } from '@/lib/apiGuard';
import { getDepensesDB, createDepenseDB, deleteDepenseDB } from '@/lib/depenses';

// Dépenses (table protégée RLS) — SERVEUR (service_role). L'upload du reçu reste
// côté client (bucket Storage `receipts`, policies anon).
export const runtime = 'nodejs';

export async function POST(req: Request) {
  // Cette route lit et écrit en service_role : elle traverse tous les droits de
  // la base. Sans cette vérification, elle répondait à n'importe qui.
  const { refus } = await exigerAdmin();
  if (refus) return refus;

  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  const { op, args = {} } = body;

  try {
    switch (op) {
      case 'list':   return NextResponse.json(await getDepensesDB());
      case 'create': return NextResponse.json(await createDepenseDB(args));
      case 'delete': return NextResponse.json(await deleteDepenseDB(args.id));
      default: return NextResponse.json({ error: 'Opération inconnue.' }, { status: 400 });
    }
  } catch (e: any) {
    console.error('api/admin/depenses error:', op, e?.message);
    return NextResponse.json({ error: 'Erreur serveur dépenses.' }, { status: 500 });
  }
}
