// ── Paiements cleaners & Facturation (infos société + historique factures) ───────
// Extrait de db.ts.

import { getServer, postServer } from './shared';
import type { Payment, CompanyInfo, InvoiceLine, InvoiceRecord } from '../types';

// ── PAYMENTS (salaires versés — sensibles → route serveur admin) ────────────────

export async function getPaymentsDB(): Promise<Payment[]> {
  try { const d = await getServer('/api/admin/finance?type=payments'); return d.payments ?? []; }
  catch { return []; }
}

export async function createPaymentDB(fields: {
  cleanerId: string; cleanerName: string; amount: number; missionIds: string[]; month: string;
}) {
  try { await postServer('/api/admin/finance', { type: 'payment', ...fields }); }
  catch (e) { console.error('createPaymentDB:', e); }
}

// ── FACTURATION : infos société (IBAN sensible → route serveur admin) ────────────

export async function getCompanyInfoDB(): Promise<CompanyInfo> {
  try { const d = await getServer('/api/admin/finance?type=company'); return d.company ?? {}; }
  catch { return {}; }
}

export async function saveCompanyInfoDB(fields: CompanyInfo): Promise<{ error: string | null }> {
  try { const d = await postServer('/api/admin/finance', { type: 'company', ...fields }); return { error: d.error ?? null }; }
  catch (e: any) { return { error: e?.message ?? 'Erreur' }; }
}

// Factures émises (données financières → route serveur admin, comme payments/company).

export async function getInvoicesDB(): Promise<InvoiceRecord[]> {
  try { const d = await getServer('/api/admin/finance?type=invoices'); return d.invoices ?? []; }
  catch { return []; }
}

export async function saveInvoiceDB(fields: {
  number: string; partnerLabel: string; partnerType: string;
  periodFrom: string; periodTo: string; total: number; lines: InvoiceLine[];
}): Promise<{ error: string | null }> {
  try { const d = await postServer('/api/admin/finance', { type: 'invoice', ...fields }); return { error: d.error ?? null }; }
  catch (e: any) { return { error: e?.message ?? 'Erreur' }; }
}
