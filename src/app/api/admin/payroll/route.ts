import { NextResponse } from 'next/server';
import { getActiveCleanersDB } from '@/lib/db';
import { getPrimeRequestsDB, currentPeriod } from '@/lib/rh';
import { recomputeAllCleanerRhDB, computePayslipDB } from '@/lib/rhEngine';

// Fiches de paie + recalcul (LOT 3bis / LOT 4) — SERVEUR (service_role).
export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: any = {};
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 }); }
  const { op, period = currentPeriod() } = body;

  try {
    if (op === 'recompute') {
      return NextResponse.json(await recomputeAllCleanerRhDB(period));
    }
    if (op === 'load') {
      const cleaners = await getActiveCleanersDB();
      const [payslips, requests] = await Promise.all([
        Promise.all(cleaners.map(c => computePayslipDB(c.id, period))),
        getPrimeRequestsDB('en_attente'),
      ]);
      const rows = cleaners.map((c, i) => ({ id: c.id, name: c.name, payslip: payslips[i] }));
      return NextResponse.json({ rows, requests });
    }
    return NextResponse.json({ error: 'Opération inconnue.' }, { status: 400 });
  } catch (e: any) {
    console.error('api/admin/payroll error:', op, e?.message);
    return NextResponse.json({ error: 'Erreur serveur paie.' }, { status: 500 });
  }
}
