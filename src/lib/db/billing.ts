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
  // Par /api/factures : la même liste que voit le client, mais complète pour
  // l'admin — avec l'échéance, le règlement et la présence du document.
  try {
    const res = await fetch('/api/factures');
    if (!res.ok) throw new Error('lecture refusée');
    const { factures } = await res.json();
    return (factures ?? []).map((f: Record<string, unknown>) => ({
      id: f.id as string,
      number: (f.number as string) ?? '',
      partnerLabel: (f.partner_label as string) ?? '',
      partnerType: (f.partner_type as string) ?? '',
      periodFrom: (f.period_from as string) ?? '',
      periodTo: (f.period_to as string) ?? '',
      total: Number(f.total) || 0,
      lines: [],
      status: (f.status as string) ?? 'issued',
      createdAt: (f.created_at as string) ?? '',
      dueDate: (f.due_date as string) ?? null,
      paidAt: (f.paid_at as string) ?? null,
      hasFile: !!f.hasFile,
    }));
  } catch {
    // Repli sur l'ancienne route, qui porte le détail des lignes.
    try { const d = await getServer('/api/admin/finance?type=invoices'); return d.invoices ?? []; }
    catch { return []; }
  }
}

/** Dépose le PDF d'une facture. Réservé à l'administration (vérifié côté serveur). */
export async function uploadInvoiceFileDB(invoiceId: string, file: File): Promise<{ error: string | null }> {
  try {
    const form = new FormData();
    form.append('invoiceId', invoiceId);
    form.append('file', file);
    const res = await fetch('/api/factures', { method: 'POST', body: form });
    const d = await res.json().catch(() => ({}));
    return { error: res.ok ? null : String(d.error ?? 'Dépôt impossible.') };
  } catch { return { error: 'Connexion impossible. Réessayez.' }; }
}

/** Marque une facture réglée, ou revient en arrière. */
export async function setInvoicePaidDB(invoiceId: string, paid: boolean): Promise<{ error: string | null }> {
  try {
    const res = await fetch('/api/factures', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'paiement', id: invoiceId, paid }),
    });
    const d = await res.json().catch(() => ({}));
    return { error: res.ok ? null : String(d.error ?? 'Enregistrement impossible.') };
  } catch { return { error: 'Connexion impossible. Réessayez.' }; }
}

export async function saveInvoiceDB(fields: {
  number: string; partnerLabel: string; partnerType: string;
  periodFrom: string; periodTo: string; total: number; lines: InvoiceLine[];
}): Promise<{ error: string | null }> {
  try { const d = await postServer('/api/admin/finance', { type: 'invoice', ...fields }); return { error: d.error ?? null }; }
  catch (e: any) { return { error: e?.message ?? 'Erreur' }; }
}
