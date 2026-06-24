// ── Paiements cleaners & Facturation (infos société + historique factures) ───────
// Extrait de db.ts.

import { supabase } from '../supabase';
import type { Payment, CompanyInfo, InvoiceLine, InvoiceRecord } from '../types';

// ── PAYMENTS ──────────────────────────────────────────────────────────────────

export async function getPaymentsDB(): Promise<Payment[]> {
  const { data } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
  return (data ?? []).map(p => ({
    id: p.id,
    cleanerId: p.cleaner_id,
    cleanerName: p.cleaner_name ?? '',
    amount: Number(p.amount),
    missionIds: p.missions_ids ?? [],
    date: p.paid_at ?? p.created_at?.split('T')[0] ?? '',
    month: p.period ?? '',
  }));
}

export async function createPaymentDB(fields: {
  cleanerId: string; cleanerName: string; amount: number; missionIds: string[]; month: string;
}) {
  await supabase.from('payments').insert({
    cleaner_id: fields.cleanerId,
    cleaner_name: fields.cleanerName,
    amount: fields.amount,
    missions_ids: fields.missionIds,
    period: fields.month,
    status: 'paid',
    paid_at: new Date().toISOString().split('T')[0],
  });
}

// ── FACTURATION (infos société + historique) ───────────────────────────────────

export async function getCompanyInfoDB(): Promise<CompanyInfo> {
  const { data, error } = await supabase.from('company_info').select('*').eq('id', 1).single();
  if (error || !data) return {};
  return {
    name: data.name ?? undefined,
    address: data.address ?? undefined,
    siret: data.siret ?? undefined,
    vat: data.vat ?? undefined,
    email: data.email ?? undefined,
    phone: data.phone ?? undefined,
    iban: data.iban ?? undefined,
    bic: data.bic ?? undefined,
  };
}

export async function saveCompanyInfoDB(fields: CompanyInfo): Promise<{ error: string | null }> {
  const { error } = await supabase.from('company_info').upsert({
    id: 1,
    name: fields.name || null,
    address: fields.address || null,
    siret: fields.siret || null,
    vat: fields.vat || null,
    email: fields.email || null,
    phone: fields.phone || null,
    iban: fields.iban || null,
    bic: fields.bic || null,
    updated_at: new Date().toISOString(),
  });
  return { error: error?.message ?? null };
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
