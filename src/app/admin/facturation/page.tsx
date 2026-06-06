'use client';

import { useState, useEffect, useMemo } from 'react';
import { getMissionsDB, getCompanyInfoDB, saveCompanyInfoDB, getInvoicesDB, saveInvoiceDB } from '@/lib/db';
import type { Mission, CompanyInfo, InvoiceLine, InvoiceRecord } from '@/lib/types';
import { inputStyle } from '@/lib/ui';

function partnerLabel(m: Mission): string {
  if (m.source === 'airbnb') return m.partnerName || 'Airbnb (sans partenaire)';
  return m.requestedBy || m.property || 'Hôtel';
}

function monthBounds(d = new Date()) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const fmt = (x: Date) => x.toISOString().split('T')[0];
  return { from: fmt(first), to: fmt(last) };
}

function fmtDateFR(d: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const TYPE_LABEL: Record<string, string> = {
  checkout: 'Check-out', checkin: 'Check-in', deep_clean: 'Grand ménage',
  regular: 'Ménage', menage: 'Ménage', grand_menage: 'Grand ménage',
};

// ── Document facture (imprimable), partagé live / historique ────────────────────
function InvoiceDoc({ company, number, partnerLabel, from, to, lines, total, editable, onAmount }: {
  company: CompanyInfo;
  number: string; partnerLabel: string; from: string; to: string;
  lines: (InvoiceLine & { id?: string })[];
  total: number;
  editable?: boolean;
  onAmount?: (id: string, v: string) => void;
}) {
  return (
    <div className="invoice-print rounded-2xl border p-6 md:p-10" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      {/* En-tête société */}
      <div className="flex items-start justify-between mb-8 gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl font-bold" style={{ color: '#C9A84C' }}>✦</span>
            <span className="text-xl font-bold" style={{ color: '#1A1A1A' }}>{company.name || 'MonCleanerPro'}</span>
          </div>
          {company.address && <p className="text-xs" style={{ color: '#7A7068' }}>{company.address}</p>}
          <p className="text-xs" style={{ color: '#A8A09A' }}>
            {[company.email, company.phone].filter(Boolean).join(' · ')}
          </p>
          <p className="text-xs" style={{ color: '#A8A09A' }}>
            {[company.siret && `SIRET ${company.siret}`, company.vat && `TVA ${company.vat}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold" style={{ color: '#1A1A1A' }}>FACTURE</p>
          <p className="text-xs" style={{ color: '#A8A09A' }}>{number}</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Émise le {fmtDateFR(new Date().toISOString().split('T')[0])}</p>
        </div>
      </div>

      <div className="flex flex-wrap justify-between gap-4 mb-8">
        <div>
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#A8A09A' }}>Facturé à</p>
          <p className="text-base font-semibold" style={{ color: '#1A1A1A' }}>{partnerLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#A8A09A' }}>Période</p>
          <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{fmtDateFR(from)} → {fmtDateFR(to)}</p>
        </div>
      </div>

      <table className="w-full text-sm mb-6" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #E8E4DC' }}>
            <th className="text-left py-2 font-semibold" style={{ color: '#7A7068' }}>Date</th>
            <th className="text-left py-2 font-semibold" style={{ color: '#7A7068' }}>Prestation</th>
            <th className="text-right py-2 font-semibold" style={{ color: '#7A7068' }}>Montant</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={l.id ?? i} style={{ borderBottom: '1px solid #F2EFE9' }}>
              <td className="py-2.5" style={{ color: '#1A1A1A' }}>{fmtDateFR(l.date)}</td>
              <td className="py-2.5" style={{ color: '#1A1A1A' }}>
                {l.label}<span className="text-xs ml-2" style={{ color: '#A8A09A' }}>{TYPE_LABEL[l.type] ?? l.type}</span>
              </td>
              <td className="py-2.5 text-right">
                {editable && onAmount && l.id ? (
                  <span className="inline-flex items-center gap-1">
                    <input type="number" min="0" step="0.01" value={String(l.amount)}
                      onChange={e => onAmount(l.id!, e.target.value)}
                      className="w-20 text-right px-2 py-1 rounded-lg border"
                      style={{ borderColor: '#E8E4DC', color: '#1A1A1A', outline: 'none' }} />
                    <span style={{ color: '#1A1A1A' }}>€</span>
                  </span>
                ) : (
                  <span style={{ color: '#1A1A1A' }}>{l.amount.toFixed(2)} €</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-full max-w-xs">
          <div className="flex justify-between py-2 text-sm" style={{ color: '#7A7068' }}>
            <span>{lines.length} mission{lines.length > 1 ? 's' : ''}</span><span />
          </div>
          <div className="flex justify-between py-3 border-t" style={{ borderColor: '#1A1A1A' }}>
            <span className="font-bold" style={{ color: '#1A1A1A' }}>Total</span>
            <span className="font-bold text-lg" style={{ color: '#1A1A1A' }}>{total.toFixed(2)} €</span>
          </div>
        </div>
      </div>

      <p className="text-xs mt-10 pt-4 border-t" style={{ color: '#A8A09A', borderColor: '#F2EFE9' }}>
        Merci de votre confiance. — {company.name || 'MonCleanerPro'}
      </p>
    </div>
  );
}

export default function FacturationPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [company, setCompany] = useState<CompanyInfo>({});
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [viewing, setViewing] = useState<InvoiceRecord | null>(null);

  const init = monthBounds();
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [partner, setPartner] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [savedMsg, setSavedMsg] = useState('');

  const [showSettings, setShowSettings] = useState(false);
  const [companyForm, setCompanyForm] = useState<CompanyInfo>({});
  const [savingCompany, setSavingCompany] = useState(false);

  async function loadAll() {
    const [m, c, inv] = await Promise.all([getMissionsDB(), getCompanyInfoDB(), getInvoicesDB()]);
    setMissions(m); setCompany(c); setCompanyForm(c); setInvoices(inv);
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  const done = useMemo(
    () => missions.filter(m => m.status === 'completed' && m.date >= from && m.date <= to),
    [missions, from, to],
  );
  const partners = useMemo(() => {
    const map = new Map<string, number>();
    done.forEach(m => map.set(partnerLabel(m), (map.get(partnerLabel(m)) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [done]);

  const selMissions = useMemo(
    () => done.filter(m => partnerLabel(m) === partner).sort((a, b) => a.date.localeCompare(b.date)),
    [done, partner],
  );

  function amountOf(m: Mission): number {
    const v = amounts[m.id];
    if (v !== undefined) return Number(v) || 0;
    return m.price || 0;
  }
  const liveLines = selMissions.map(m => ({
    id: m.id, date: m.date, label: m.property || TYPE_LABEL[m.type] || 'Ménage', type: m.type, amount: amountOf(m),
  }));
  const total = liveLines.reduce((s, l) => s + l.amount, 0);
  const partnerType = selMissions[0]?.source ?? 'airbnb';

  const today = new Date();
  const invoiceNo = partner
    ? `FAC-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}-${partner.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'XXXX'}`
    : '';

  function setThisMonth() { const b = monthBounds(); setFrom(b.from); setTo(b.to); }
  function setLastMonth() { const d = new Date(); d.setMonth(d.getMonth() - 1); const b = monthBounds(d); setFrom(b.from); setTo(b.to); }

  function buildText(): string {
    const head = `Facture ${invoiceNo} — ${partner}\nPériode : ${fmtDateFR(from)} au ${fmtDateFR(to)}\n\n`;
    const body = liveLines.map(l => `• ${fmtDateFR(l.date)} — ${l.label} : ${l.amount.toFixed(2)} €`).join('\n');
    const foot = `\n\nTotal : ${total.toFixed(2)} €\n\n${company.name || 'MonCleanerPro'}`;
    return head + body + foot;
  }
  function sendEmail() {
    window.location.href = `mailto:?subject=${encodeURIComponent(`Facture ${invoiceNo} — ${company.name || 'MonCleanerPro'}`)}&body=${encodeURIComponent(buildText())}`;
  }
  function sendWhatsApp() { window.open(`https://wa.me/?text=${encodeURIComponent(buildText())}`, '_blank'); }

  async function handleSaveInvoice() {
    const lines: InvoiceLine[] = liveLines.map(({ date, label, type, amount }) => ({ date, label, type, amount }));
    const res = await saveInvoiceDB({ number: invoiceNo, partnerLabel: partner, partnerType, periodFrom: from, periodTo: to, total, lines });
    if (res.error) { setSavedMsg('Erreur : ' + res.error); return; }
    setSavedMsg('Facture enregistrée dans l\'historique ✓');
    setInvoices(await getInvoicesDB());
    setTimeout(() => setSavedMsg(''), 4000);
  }

  async function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    setSavingCompany(true);
    await saveCompanyInfoDB(companyForm);
    setCompany(companyForm);
    setShowSettings(false);
    setSavingCompany(false);
  }

  if (loading) return <div className="p-6 text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  const COMPANY_FIELDS: { label: string; key: keyof CompanyInfo; placeholder: string }[] = [
    { label: 'Nom / Raison sociale', key: 'name', placeholder: 'MonCleanerPro SARL' },
    { label: 'Adresse', key: 'address', placeholder: '10 rue Exemple, 69003 Lyon' },
    { label: 'SIRET', key: 'siret', placeholder: '123 456 789 00012' },
    { label: 'N° TVA', key: 'vat', placeholder: 'FR12345678901' },
    { label: 'Email', key: 'email', placeholder: 'contact@moncleanerpro.com' },
    { label: 'Téléphone', key: 'phone', placeholder: '06 12 34 56 78' },
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* ── Contrôles (non imprimés) ── */}
      <div className="print-hidden">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Facturation</h1>
            <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Factures des missions réalisées pour vos partenaires</p>
          </div>
          <button onClick={() => setShowSettings(s => !s)} className="px-4 py-2.5 rounded-xl text-sm font-semibold border shrink-0" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
            ⚙ Mes informations
          </button>
        </div>

        {/* Réglages société */}
        {showSettings && (
          <form onSubmit={handleSaveCompany} className="rounded-2xl border p-5 mb-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
            <h2 className="font-semibold mb-4" style={{ color: '#1A1A1A' }}>Informations de l'entreprise (affichées sur les factures)</h2>
            <div className="grid md:grid-cols-2 gap-3">
              {COMPANY_FIELDS.map(f => (
                <div key={f.key} className={f.key === 'address' ? 'md:col-span-2' : ''}>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7068' }}>{f.label}</label>
                  <input value={companyForm[f.key] ?? ''} onChange={e => setCompanyForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} className="w-full px-4 py-2.5 rounded-xl text-sm border" style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
                </div>
              ))}
            </div>
            <button type="submit" disabled={savingCompany} className="mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
              {savingCompany ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        )}

        {/* Onglets */}
        <div className="flex gap-1 mb-6 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
          {([['new', 'Nouvelle facture'], ['history', `Historique (${invoices.length})`]] as const).map(([v, label]) => (
            <button key={v} onClick={() => { setTab(v); setViewing(null); }} className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: tab === v ? '#FFFFFF' : 'transparent', color: tab === v ? '#1A1A1A' : '#A8A09A', boxShadow: tab === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── NOUVELLE FACTURE : contrôles ── */}
        {tab === 'new' && (
          <div className="rounded-2xl border p-5 mb-6 space-y-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Période</label>
              <div className="flex flex-wrap gap-2 mb-3">
                <button onClick={setThisMonth} className="px-3 py-1.5 rounded-xl text-xs font-medium border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Ce mois</button>
                <button onClick={setLastMonth} className="px-3 py-1.5 rounded-xl text-xs font-medium border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Mois dernier</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Du</label>
                  <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full px-4 py-2.5 rounded-xl text-sm border" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Au</label>
                  <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="w-full px-4 py-2.5 rounded-xl text-sm border" style={inputStyle} />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Partenaire</label>
              <select value={partner} onChange={e => { setPartner(e.target.value); setAmounts({}); }}
                className="w-full px-4 py-3 rounded-xl text-sm border appearance-none" style={{ ...inputStyle, color: partner ? '#1A1A1A' : '#A8A09A' }}>
                <option value="">Sélectionner un partenaire</option>
                {partners.map(([name, count]) => <option key={name} value={name}>{name} ({count})</option>)}
              </select>
              {partners.length === 0 && <p className="text-xs mt-2" style={{ color: '#A8A09A' }}>Aucune mission terminée sur cette période.</p>}
            </div>
            {partner && liveLines.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 items-center">
                <button onClick={() => window.print()} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>🖨 Imprimer / PDF</button>
                <button onClick={handleSaveInvoice} className="px-5 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: '#C9A84C', color: '#C9A84C' }}>💾 Enregistrer</button>
                <button onClick={sendEmail} className="px-5 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>✉ Email</button>
                <button onClick={sendWhatsApp} className="px-5 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#5A8A6A' }}>WhatsApp</button>
                {savedMsg && <span className="text-xs font-medium" style={{ color: '#5A8A6A' }}>{savedMsg}</span>}
              </div>
            )}
          </div>
        )}

        {/* ── HISTORIQUE : liste ── */}
        {tab === 'history' && !viewing && (
          invoices.length === 0 ? (
            <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
              <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune facture enregistrée</p>
            </div>
          ) : (
            <div className="space-y-2 mb-6">
              {invoices.map(inv => (
                <button key={inv.id} onClick={() => setViewing(inv)} className="w-full text-left rounded-2xl border px-5 py-4 flex items-center gap-4 transition-all" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{inv.partnerLabel}</p>
                    <p className="text-xs" style={{ color: '#A8A09A' }}>{inv.number} · {fmtDateFR(inv.periodFrom)} → {fmtDateFR(inv.periodTo)} · {inv.lines.length} mission{inv.lines.length > 1 ? 's' : ''}</p>
                  </div>
                  <span className="text-sm font-bold shrink-0" style={{ color: '#1A1A1A' }}>{inv.total.toFixed(2)} €</span>
                  <span className="text-xs shrink-0" style={{ color: '#C9A84C' }}>Voir →</span>
                </button>
              ))}
            </div>
          )
        )}

        {/* Barre d'action quand on visualise une facture de l'historique */}
        {tab === 'history' && viewing && (
          <div className="flex flex-wrap gap-2 mb-6 items-center">
            <button onClick={() => setViewing(null)} className="px-4 py-2.5 rounded-xl text-sm font-medium border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>← Retour</button>
            <button onClick={() => window.print()} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>🖨 Imprimer / PDF</button>
          </div>
        )}
      </div>

      {/* ── Rendu facture ── */}
      {tab === 'new' && partner && liveLines.length > 0 && (
        <InvoiceDoc company={company} number={invoiceNo} partnerLabel={partner} from={from} to={to}
          lines={liveLines} total={total} editable onAmount={(id, v) => setAmounts(a => ({ ...a, [id]: v }))} />
      )}
      {tab === 'new' && (!partner || liveLines.length === 0) && (
        <div className="rounded-2xl p-10 text-center border print-hidden" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-2xl mb-3">🧾</p>
          <p className="font-medium text-sm" style={{ color: '#1A1A1A' }}>Choisissez une période puis un partenaire</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>La facture des missions terminées s'affichera ici</p>
        </div>
      )}
      {tab === 'history' && viewing && (
        <InvoiceDoc company={company} number={viewing.number} partnerLabel={viewing.partnerLabel}
          from={viewing.periodFrom} to={viewing.periodTo} lines={viewing.lines} total={viewing.total} />
      )}
    </div>
  );
}
