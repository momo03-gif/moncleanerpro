// Façade CLIENT des fiches de paie (LOT 4) → routes serveur service_role.
import type { Payslip } from './rhEngine';
import type { PrimeRequest } from './rh';

export type { Payslip, PayslipPrime } from './rhEngine';

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
