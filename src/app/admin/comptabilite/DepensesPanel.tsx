'use client';

import { useState, useEffect, useCallback } from 'react';
import { getMissionsDB, getInvoicesDB, getCompanyInfoDB } from '@/lib/db';
import {
  getDepensesDB, createDepenseDB, deleteDepenseDB, uploadReceiptDB,
  DEPENSE_CATEGORIES, CATEGORIE_LABEL, type Depense,
} from '@/lib/depensesApi';
import type { Mission, InvoiceRecord, CompanyInfo } from '@/lib/types';
import { inputStyle } from '@/lib/ui';
import Loading from "@/components/Loading";

function money(n: number) { return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; }
function thisMonth() { return new Date().toISOString().slice(0, 7); }

// Dépenses & TVA + bénéfice net tout compris (ADMIN). Calculs vérifiables/exportables.
export default function DepensesPanel() {
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [company, setCompany] = useState<CompanyInfo>({});
  const [period, setPeriod] = useState(thisMonth());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [d, m, inv, c] = await Promise.all([getDepensesDB(), getMissionsDB(), getInvoicesDB(), getCompanyInfoDB()]);
    setDepenses(d); setMissions(m); setInvoices(inv); setCompany(c); setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading className="text-sm" />;

  const depPeriod = depenses.filter(d => d.date.startsWith(period));
  const tvaDeductible = depPeriod.reduce((s, d) => s + d.tvaMontant, 0);
  const depTtc = depPeriod.reduce((s, d) => s + d.montantTtc, 0);

  // TVA collectée (sur factures de la période) si TVA applicable.
  const vatApplicable = !!company.vat;
  const invPeriod = invoices.filter(i => (i.createdAt ?? '').slice(0, 7) === period);
  const caPeriod = invPeriod.reduce((s, i) => s + i.total, 0);
  const tvaCollectee = vatApplicable ? Math.round((caPeriod - caPeriod / 1.2) * 100) / 100 : 0;
  const tvaAReverser = Math.round((tvaCollectee - tvaDeductible) * 100) / 100;

  // Bénéfice net tout compris = revenus − salaires − dépenses (période).
  const completed = missions.filter(m => m.status === 'completed' && m.date.startsWith(period));
  const revenus = completed.reduce((s, m) => s + m.price, 0);
  const salaires = completed.reduce((s, m) => s + (m.cleanerGain ?? 0), 0);
  const beneficeNet = Math.round((revenus - salaires - depTtc) * 100) / 100;

  function exportCsv() {
    const head = ['Date', 'Catégorie', 'Fournisseur', 'Montant HT', 'TVA', 'Montant TTC', 'Note'];
    const rows = depenses.map(d => [d.date, CATEGORIE_LABEL[d.categorie] ?? d.categorie, d.fournisseur ?? '', d.montantHt, d.tvaMontant, d.montantTtc, (d.note ?? '').replace(/;/g, ',')].join(';'));
    const csv = ['﻿' + head.join(';'), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `depenses-${period}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Période */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="px-3 py-2 rounded-xl text-sm" style={{ ...inputStyle }} />
        <button onClick={exportCsv} className="px-4 py-2 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#7A7068', backgroundColor: '#FAFAF8' }}>Exporter (CSV)</button>
      </div>

      {/* Récap TVA + bénéfice */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi label="TVA collectée" value={money(tvaCollectee)} color="#5A8A6A" />
        <Kpi label="TVA déductible" value={money(tvaDeductible)} color="#5B6EF5" />
        <Kpi label="TVA à reverser" value={money(tvaAReverser)} color="#C48A2A" accent />
        <Kpi label="Bénéfice net (tout compris)" value={money(beneficeNet)} color="#1A1A1A" />
      </div>
      {!vatApplicable && <p className="text-xs mb-4" style={{ color: '#A8A09A' }}>TVA non applicable (aucun n° de TVA dans « Mes informations »).</p>}

      <DepenseForm onSaved={load} />

      {/* Liste */}
      <div className="rounded-2xl border overflow-hidden mt-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <div className="hidden md:grid grid-cols-6 px-5 py-3 text-xs font-semibold uppercase tracking-wide border-b" style={{ color: '#A8A09A', borderColor: '#F2EFE9', backgroundColor: '#FAFAF8' }}>
          <span>Date</span><span>Catégorie</span><span>Fournisseur</span><span>HT</span><span>TVA</span><span>TTC</span>
        </div>
        {depPeriod.length === 0 && <div className="py-10 text-center text-sm" style={{ color: '#A8A09A' }}>Aucune dépense ce mois</div>}
        {depPeriod.map((d, i) => (
          <div key={d.id} className={`px-5 py-3 flex flex-col md:grid md:grid-cols-6 gap-1 md:gap-0 md:items-center ${i < depPeriod.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
            <span className="text-sm" style={{ color: '#1A1A1A' }}>{d.date}</span>
            <span className="text-sm" style={{ color: '#7A7068' }}>{CATEGORIE_LABEL[d.categorie] ?? d.categorie}</span>
            <span className="text-sm" style={{ color: '#7A7068' }}>{d.fournisseur ?? '—'}</span>
            <span className="text-sm" style={{ color: '#1A1A1A' }}>{money(d.montantHt)}</span>
            <span className="text-sm" style={{ color: '#5B6EF5' }}>{money(d.tvaMontant)}</span>
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{money(d.montantTtc)}</span>
              <span className="flex items-center gap-2">
                {d.justificatifUrl && <a href={d.justificatifUrl} target="_blank" rel="noreferrer" className="text-xs" style={{ color: '#C9A84C' }}>Reçu</a>}
                <button onClick={() => deleteDepenseDB(d.id).then(load)} style={{ color: '#B85A50' }}>✕</button>
              </span>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

function Kpi({ label, value, color, accent }: { label: string; value: string; color: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl p-4 border" style={{ backgroundColor: accent ? '#C48A2A10' : '#FFFFFF', borderColor: accent ? '#C48A2A40' : '#E8E4DC' }}>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>{label}</p>
    </div>
  );
}

function DepenseForm({ onSaved }: { onSaved: () => void }) {
  const empty = { categorie: 'essence', fournisseur: '', montantHt: 0, tvaMontant: 0, date: new Date().toISOString().slice(0, 10), note: '' };
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const ttc = Math.round((Number(form.montantHt) + Number(form.tvaMontant)) * 100) / 100;

  async function submit() {
    setBusy(true);
    let url: string | undefined;
    if (file) { const up = await uploadReceiptDB(file); url = up.url ?? undefined; }
    await createDepenseDB({ ...form, montantHt: Number(form.montantHt) || 0, tvaMontant: Number(form.tvaMontant) || 0, montantTtc: ttc, justificatifUrl: url });
    setForm(empty); setFile(null); setBusy(false); onSaved();
  }

  return (
    <div className="rounded-2xl border p-5" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Nouvelle dépense</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <select value={form.categorie} onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))} className="px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }}>
          {DEPENSE_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORIE_LABEL[c]}</option>)}
        </select>
        <input value={form.fournisseur} onChange={e => setForm(f => ({ ...f, fournisseur: e.target.value }))} placeholder="Fournisseur" className="px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
        <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
        <input type="number" step="0.01" value={form.montantHt} onChange={e => setForm(f => ({ ...f, montantHt: Number(e.target.value) }))} placeholder="Montant HT" className="px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
        <input type="number" step="0.01" value={form.tvaMontant} onChange={e => setForm(f => ({ ...f, tvaMontant: Number(e.target.value) }))} placeholder="TVA (€)" className="px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
        <div className="flex items-center px-3 rounded-xl text-sm" style={{ ...inputStyle }}>TTC : {money(ttc)}</div>
        <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Note" className="sm:col-span-2 px-3 py-2.5 rounded-xl text-sm" style={{ ...inputStyle }} />
        <input type="file" accept="image/*,application/pdf" onChange={e => setFile(e.target.files?.[0] ?? null)} className="text-xs" style={{ color: '#7A7068' }} />
      </div>
      <button onClick={submit} disabled={busy} className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
        {busy ? 'Enregistrement...' : 'Ajouter la dépense'}
      </button>
    </div>
  );
}
