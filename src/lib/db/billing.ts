// ── Paiements cleaners & Facturation (infos société + historique factures) ───────
// Extrait de db.ts.

import { supabase } from '../supabase';
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

function rowToInvoice(r: any): InvoiceRecord {
  return {
    id: r.id,
    number: r.number ?? '',
    partnerLabel: r.partner_label ?? '',
    partnerType: r.partner_type ?? '',
    periodFrom: r.period_from ?? '',
    periodTo: r.period_to ?? '',
    total: Number(r.total) || 0,
    lines: Array.isArray(r.lines) ? r.lines : [],
    status: r.status ?? 'issued',
    createdAt: r.created_at ?? '',
  };
}

export async function getInvoicesDB(): Promise<InvoiceRecord[]> {
  const { data, error } = await supabase.from('invoices').select('*').order('created_at', { ascending: false });
  if (error) console.error('getInvoicesDB error:', error.code, error.message);
  return (data ?? []).map(rowToInvoice);
}

export async function saveInvoiceDB(fields: {
  number: string; partnerLabel: string; partnerType: string;
  periodFrom: string; periodTo: string; total: number; lines: InvoiceLine[];
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('invoices').insert({
    number: fields.number,
    partner_label: fields.partnerLabel,
    partner_type: fields.partnerType,
    period_from: fields.periodFrom,
    period_to: fields.periodTo,
    total: fields.total,
    lines: fields.lines,
    status: 'issued',
  });
  return { error: error?.message ?? null };
}
