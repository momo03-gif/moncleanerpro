// Façade CLIENT des fiches de paie (LOT 4) → routes serveur service_role.
import type { Payslip, PayDetail } from './rhEngine';
import type { PrimeRequest } from './rh';

export type { Payslip, PayslipPrime, PayslipTimeCompare, PayDetail, PayDetailMission } from './rhEngine';

export interface PayrollRow { id: string; name: string; payslip: Payslip; }

async function call<T>(op: string, period?: string): Promise<T> {
  const res = await fetch('/api/admin/payroll', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op, period }),
  });
  return res.json() as Promise<T>;
}

export const loadPayrollDB = (period: string) => call<{ rows: PayrollRow[]; requests: PrimeRequest[] }>('load', period);
export const recomputeAllCleanerRhDB = (period: string) => call<{ count: number }>('recompute', period);

// Détail des missions d'un cleaner sur une plage de dates (fiche ouverte au clic).
export async function loadCleanerDetailDB(cleanerId: string, from: string, to: string) {
  const res = await fetch('/api/admin/payroll', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op: 'detail', cleanerId, from, to }),
  });
  return res.json() as Promise<PayDetail>;
}

// Ajustement manuel de la paie d'un cleaner pour un mois (delta €, +/-).
export async function setPayAdjustmentDB(cleanerId: string, period: string, amount: number, note?: string) {
  const res = await fetch('/api/admin/payroll', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op: 'adjust', cleanerId, period, amount, note }),
  });
  return res.json() as Promise<{ ok?: boolean; error?: string }>;
}
