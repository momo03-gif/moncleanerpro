'use client';

import type React from 'react';
import { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import { getMissionsDB, getCompanyInfoDB, saveCompanyInfoDB, getInvoicesDB, saveInvoiceDB } from '@/lib/db';
import type { Mission, CompanyInfo, InvoiceLine, InvoiceRecord } from '@/lib/types';
import { inputStyle } from '@/lib/ui';
import { formatDuration } from '@/lib/format';
import Icon from '@/components/Icon';
import DevisPanel from './DevisPanel';

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

const CLIENT_TYPE_LABEL: Record<string, string> = {
  hotel: 'Hôtel', airbnb: 'Airbnb', conciergerie: 'Conciergerie', bureau: 'Bureau',
};

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending: { label: 'En attente', color: '#A87B1E', bg: '#FBF4E2', border: '#EBD9A8' },
  issued:  { label: 'En attente', color: '#A87B1E', bg: '#FBF4E2', border: '#EBD9A8' },
  paid:    { label: 'Payée',      color: '#4E7D5E', bg: '#EAF3EC', border: '#BFD9C6' },
  overdue: { label: 'En retard',  color: '#B85A50', bg: '#FBECEA', border: '#EAC4BE' },
};

function money(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// ── Document facture premium (imprimable), partagé live / historique ────────────
// Réutilisé tel quel pour les DEVIS (LOT 8) via docLabel / validUntil — même
// identité visuelle, aucune duplication du gabarit.
export function InvoiceDoc({ company, number, partnerLabel, partnerType, status, from, to, lines, total, editable, onAmount, docLabel = 'FACTURE', validUntil }: {
  company: CompanyInfo;
  number: string; partnerLabel: string; partnerType?: string; status?: string;
  from: string; to: string;
  lines: (InvoiceLine & { id?: string })[];
  total: number;
  editable?: boolean;
  onAmount?: (id: string, v: string) => void;
  docLabel?: string;
  validUntil?: string;
}) {
  const [qrSvg, setQrSvg] = useState('');

  const vatApplicable = !!company.vat;
  const totalTTC = total;                                    // montant facturé inchangé (logique conservée)
  const subtotalHT = vatApplicable ? totalTTC / 1.2 : totalTTC;
  const vatAmount = totalTTC - subtotalHT;

  const badge = STATUS_BADGE[status ?? 'pending'] ?? STATUS_BADGE.pending;
  const clientType = CLIENT_TYPE_LABEL[partnerType ?? ''] ?? 'Client';
  const companyName = company.name || 'MonCleanerPro';
  const genDate = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  // QR de paiement SEPA (EPC) — généré uniquement si un IBAN est renseigné
  useEffect(() => {
    const iban = (company.iban ?? '').replace(/\s/g, '');
    if (!iban) { setQrSvg(''); return; }
    const epc = ['BCD', '002', '1', 'SCT', (company.bic ?? '').replace(/\s/g, ''), companyName,
      iban, `EUR${totalTTC.toFixed(2)}`, '', '', number].join('\n');
    let cancelled = false;
    QRCode.toString(epc, { type: 'svg', margin: 0, color: { dark: '#1A1A1A', light: '#FFFFFF' } })
      .then(svg => { if (!cancelled) setQrSvg(svg); })
      .catch(() => { if (!cancelled) setQrSvg(''); });
    return () => { cancelled = true; };
  }, [company.iban, company.bic, companyName, totalTTC, number]);

  // Styles réutilisés
  const sectionLabel: React.CSSProperties = { fontSize: 9.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#B0A795' };
  const metaKey: React.CSSProperties = { textAlign: 'right', padding: '2px 12px 2px 0', fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#B0A795', whiteSpace: 'nowrap' };
  const metaVal: React.CSSProperties = { textAlign: 'right', fontWeight: 600, fontSize: 11.5, color: '#1A1A1A', whiteSpace: 'nowrap' };
  const th: React.CSSProperties = { padding: '11px 12px', fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#E9E2D2' };
  const td: React.CSSProperties = { padding: '11px 12px', fontSize: 11.5, color: '#4A443D', verticalAlign: 'middle' };
  const totRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B6259', padding: '4px 0' };
  const payKey: React.CSSProperties = { display: 'inline-block', width: 42, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B0A795' };

  return (
    <div className="invoice-print invoice-doc" style={{
      maxWidth: 840, margin: '0 auto', backgroundColor: '#FFFFFF', color: '#1A1A1A',
    }}>
      {/* ── EN-TÊTE ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, paddingBottom: 26, borderBottom: '1px solid #ECE7DC' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: '#0D0D0D', color: '#C9A84C', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 14, lineHeight: 1 }}>M</span>
            <span style={{ fontSize: 19, fontWeight: 800, letterSpacing: '0.14em', color: '#0D0D0D' }}>MONCLEANERPRO</span>
          </div>
          <p style={{ margin: '7px 0 0 31px', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.34em', textTransform: 'uppercase', color: '#C9A84C' }}>Nettoyage Professionnel</p>
          <div style={{ marginTop: 18, fontSize: 11, lineHeight: 1.85, color: '#6B6259' }}>
            {company.address && <div>{company.address}</div>}
            {(company.email || company.phone) && <div>{[company.email, company.phone].filter(Boolean).join('   ·   ')}</div>}
            {(company.siret || company.vat) && <div>{[company.siret && `SIRET ${company.siret}`, company.vat && `TVA ${company.vat}`].filter(Boolean).join('   ·   ')}</div>}
          </div>
        </div>
        <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
          <p style={{ fontSize: 29, fontWeight: 300, letterSpacing: '0.22em', color: '#0D0D0D', margin: 0 }}>{docLabel}</p>
          <p style={{ marginTop: 5, fontSize: 12, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.04em' }}>{number}</p>
          <table style={{ marginLeft: 'auto', marginTop: 16, borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={metaKey}>Émission</td><td style={metaVal}>{fmtDateFR(new Date().toISOString().split('T')[0])}</td></tr>
              {validUntil
                ? <tr><td style={metaKey}>Validité</td><td style={metaVal}>{fmtDateFR(validUntil)}</td></tr>
                : <tr><td style={metaKey}>Période</td><td style={metaVal}>{fmtDateFR(from)} – {fmtDateFR(to)}</td></tr>}
            </tbody>
          </table>
          <div style={{ marginTop: 13 }}>
            <span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', color: badge.color, backgroundColor: badge.bg, border: `1px solid ${badge.border}` }}>
              {badge.label}
            </span>
          </div>
        </div>
      </div>

      {/* ── CLIENT ── */}
      <div style={{ marginTop: 26 }}>
        <p style={sectionLabel}>Facturé à</p>
        <div style={{ marginTop: 8, background: '#FAF8F3', border: '1px solid #EFE9DC', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ fontSize: 15.5, fontWeight: 700, color: '#0D0D0D', margin: 0 }}>{partnerLabel}</p>
            <p style={{ fontSize: 11, color: '#8A8178', margin: '3px 0 0' }}>Client {clientType.toLowerCase()}</p>
          </div>
          <span style={{ padding: '5px 13px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9A7B22', background: '#F4E9CB', border: '1px solid #E7D6A6' }}>
            {clientType}
          </span>
        </div>
      </div>

      {/* ── TABLEAU DES PRESTATIONS ── */}
      <div style={{ marginTop: 26, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: 480, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#0D0D0D' }}>
              <th style={{ ...th, textAlign: 'left', borderTopLeftRadius: 10 }}>Date</th>
              <th style={{ ...th, textAlign: 'left' }}>Appartement / Chambre</th>
              <th style={{ ...th, textAlign: 'left' }}>Prestation</th>
              <th style={{ ...th, textAlign: 'center' }}>Durée</th>
              <th style={{ ...th, textAlign: 'right' }}>P.U.</th>
              <th style={{ ...th, textAlign: 'right', borderTopRightRadius: 10 }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id ?? i} style={{ borderBottom: '1px solid #F0EBE0', backgroundColor: i % 2 ? '#FBF9F4' : '#FFFFFF' }}>
                <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDateFR(l.date)}</td>
                <td style={{ ...td, fontWeight: 600, color: '#1A1A1A' }}>{l.apartment || l.label}</td>
                <td style={td}>{TYPE_LABEL[l.type] ?? l.type}</td>
                <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>{l.duration ? formatDuration(Math.round(l.duration * 60)) : '—'}</td>
                <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{l.unitPrice != null ? money(l.unitPrice) : '—'}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: '#1A1A1A', whiteSpace: 'nowrap' }}>
                  {editable && onAmount && l.id ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" min="0" step="0.01" value={String(l.amount)}
                        onChange={e => onAmount(l.id!, e.target.value)}
                        style={{ width: 72, textAlign: 'right', padding: '4px 8px', borderRadius: 8, border: '1px solid #E8E4DC', color: '#1A1A1A', outline: 'none' }} />
                      <span>€</span>
                    </span>
                  ) : money(l.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── PAIEMENT + TOTAUX ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 28, alignItems: 'flex-start' }}>
        {/* Paiement */}
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <p style={sectionLabel}>Coordonnées de paiement</p>
          <div style={{ marginTop: 10, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {qrSvg
              ? <div style={{ width: 92, height: 92, padding: 6, background: '#FFFFFF', border: '1px solid #EFE9DC', borderRadius: 12, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: qrSvg }} />
              : <div style={{ width: 92, height: 92, background: '#FAF8F3', border: '1px dashed #DAD2C2', borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, textAlign: 'center', color: '#B0A795', lineHeight: 1.4, padding: 8 }}>QR de paiement</div>}
            <div style={{ fontSize: 11.5, lineHeight: 1.95, color: '#4A443D', minWidth: 0, overflowWrap: 'anywhere' }}>
              {company.iban && <div><span style={payKey}>IBAN</span> <span style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.02em' }}>{company.iban}</span></div>}
              {company.bic && <div><span style={payKey}>BIC</span> {company.bic}</div>}
              <div style={{ marginTop: 8, fontSize: 10.5, color: '#8A8178' }}>
                Règlement par virement sous 30 jours.<br />Merci d'indiquer <strong style={{ color: '#6B6259' }}>{number}</strong> en référence.
              </div>
            </div>
          </div>
        </div>

        {/* Totaux */}
        <div style={{ flex: '1 1 240px', minWidth: 220 }}>
          <div style={{ background: '#FAF8F3', border: '1px solid #EFE9DC', borderRadius: 14, padding: '14px 18px' }}>
            <div style={totRow}><span>Sous-total HT</span><span style={{ fontWeight: 600, color: '#1A1A1A' }}>{money(subtotalHT)}</span></div>
            <div style={totRow}>
              <span>{vatApplicable ? 'TVA 20 %' : 'TVA'}</span>
              <span style={{ fontWeight: 600, color: '#1A1A1A' }}>{vatApplicable ? money(vatAmount) : 'Non applicable'}</span>
            </div>
          </div>
          <div style={{ marginTop: 10, background: '#C9A84C', borderRadius: 14, padding: '15px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 6px 16px rgba(201,168,76,0.28)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1A1A1A' }}>Total TTC</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: '#1A1A1A' }}>{money(totalTTC)}</span>
          </div>
          {!vatApplicable && <p style={{ fontSize: 9, color: '#B0A795', margin: '8px 2px 0', textAlign: 'right' }}>TVA non applicable — art. 293 B du CGI</p>}
        </div>
      </div>

      {/* ── REMERCIEMENT ── */}
      <div style={{ marginTop: 30, padding: '18px 24px', background: '#0D0D0D', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 14.5, fontWeight: 700, color: '#FFFFFF', margin: 0 }}>Merci pour votre confiance.</p>
          <p style={{ fontSize: 10.5, color: '#A99F8C', margin: '4px 0 0' }}>L'équipe {companyName}</p>
        </div>
        <span style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#C9A84C', color: '#0D0D0D', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15 }}>M</span>
      </div>

      {/* ── PIED DE PAGE ── */}
      <div style={{ marginTop: 22, paddingTop: 14, borderTop: '1px solid #ECE7DC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 9, color: '#B0A795', letterSpacing: '0.02em' }}>
        <span>{companyName}{(company.email || company.phone) ? ` · ${[company.email, company.phone].filter(Boolean).join(' · ')}` : ''}{company.siret ? ` · SIRET ${company.siret}` : ''}</span>
        <span style={{ whiteSpace: 'nowrap' }}>Générée le {genDate} · Page 1/1</span>
      </div>
    </div>
  );
}

export default function FacturationPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [company, setCompany] = useState<CompanyInfo>({});
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<'new' | 'history' | 'devis'>('new');
  const [viewing, setViewing] = useState<InvoiceRecord | null>(null);

  const init = monthBounds();
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [partner, setPartner] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [savedMsg, setSavedMsg] = useState('');
  const [recipient, setRecipient] = useState('');
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState('');

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
    id: m.id, date: m.date,
    label: m.property || TYPE_LABEL[m.type] || 'Ménage',
    type: m.type,
    apartment: m.property || (m.source === 'hotel' ? (m.requestedBy || 'Chambre') : 'Logement'),
    cleaner: m.cleanerName || '—',
    duration: m.duration || 0,
    unitPrice: amountOf(m),
    amount: amountOf(m),
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
  function buildHtml(): string {
    const companyName = company.name || 'MonCleanerPro';
    const info = [company.address, [company.email, company.phone].filter(Boolean).join('  ·  '),
      [company.siret && `SIRET ${company.siret}`, company.vat && `TVA ${company.vat}`].filter(Boolean).join('  ·  ')]
      .filter(Boolean).map(x => `<div style="color:#B8AE9E;font-size:11px;line-height:1.7">${x}</div>`).join('');
    const rows = liveLines.map((l, i) =>
      `<tr style="background:${i % 2 ? '#FAF8F3' : '#FFFFFF'}">
        <td style="padding:10px 12px;font-size:13px;color:#4A443D;border-bottom:1px solid #F0EBE0">${fmtDateFR(l.date)}</td>
        <td style="padding:10px 12px;font-size:13px;color:#1A1A1A;font-weight:600;border-bottom:1px solid #F0EBE0">${l.apartment || l.label}</td>
        <td style="padding:10px 12px;font-size:13px;color:#4A443D;border-bottom:1px solid #F0EBE0">${TYPE_LABEL[l.type] ?? l.type}</td>
        <td style="padding:10px 12px;font-size:13px;color:#1A1A1A;font-weight:700;text-align:right;border-bottom:1px solid #F0EBE0">${money(l.amount)}</td></tr>`).join('');
    return `<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;max-width:640px;margin:0 auto;background:#FFFFFF;border:1px solid #ECE7DC;border-radius:16px;overflow:hidden">
      <div style="background:#0D0D0D;padding:26px 30px">
        <div style="font-size:18px;font-weight:800;letter-spacing:0.12em;color:#FFFFFF"><span style="display:inline-block;width:24px;height:24px;border-radius:6px;background:#C9A84C;color:#0D0D0D;font-weight:800;text-align:center;line-height:24px;font-size:13px;margin-right:6px;vertical-align:middle">M</span>MONCLEANERPRO</div>
        <div style="font-size:10px;font-weight:600;letter-spacing:0.3em;text-transform:uppercase;color:#C9A84C;margin-top:5px;margin-left:24px">Nettoyage Professionnel</div>
      </div>
      <div style="padding:28px 30px">
        ${info}
        <p style="margin:20px 0 2px;font-size:20px;font-weight:300;letter-spacing:0.16em;color:#0D0D0D">FACTURE <span style="font-weight:700;font-size:14px;color:#C9A84C">${invoiceNo}</span></p>
        <p style="margin:6px 0 2px;font-size:13px">Facturé à : <strong>${partner}</strong></p>
        <p style="margin:0 0 16px;color:#8A8178;font-size:12px">Période : ${fmtDateFR(from)} – ${fmtDateFR(to)}</p>
        <table style="width:100%;border-collapse:collapse;border-radius:10px;overflow:hidden">
          <tr style="background:#0D0D0D">
            <th style="text-align:left;padding:10px 12px;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#E9E2D2">Date</th>
            <th style="text-align:left;padding:10px 12px;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#E9E2D2">Appartement</th>
            <th style="text-align:left;padding:10px 12px;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#E9E2D2">Prestation</th>
            <th style="text-align:right;padding:10px 12px;font-size:10px;letter-spacing:0.08em;text-transform:uppercase;color:#E9E2D2">Montant</th>
          </tr>
          ${rows}
        </table>
        <table style="width:100%;margin-top:18px"><tr>
          <td></td>
          <td style="width:220px">
            <div style="background:#C9A84C;border-radius:12px;padding:14px 18px;text-align:right">
              <span style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#1A1A1A">Total TTC</span>
              <div style="font-size:21px;font-weight:800;color:#1A1A1A;margin-top:2px">${money(total)}</div>
            </div>
          </td>
        </tr></table>
        ${company.iban ? `<p style="margin:18px 0 0;font-size:12px;color:#4A443D">Paiement par virement — IBAN <strong style="font-family:monospace">${company.iban}</strong>${company.bic ? ` · BIC ${company.bic}` : ''}</p>` : ''}
        <p style="margin:22px 0 0;font-size:14px;font-weight:700;color:#0D0D0D">Merci pour votre confiance.</p>
        <p style="margin:4px 0 0;font-size:12px;color:#8A8178">L'équipe ${companyName}</p>
      </div>
    </div>`;
  }

  async function sendInvoiceEmail() {
    if (!recipient) { setSendMsg("Renseignez l'email du destinataire."); return; }
    setSending(true); setSendMsg('');
    try {
      const res = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-mail-key': process.env.NEXT_PUBLIC_MAIL_KEY ?? '' },
        body: JSON.stringify({
          to: recipient,
          subject: `Facture ${invoiceNo} — ${company.name || 'MonCleanerPro'}`,
          text: buildText(), html: buildHtml(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setSendMsg('Erreur : ' + (data.error || res.status)); }
      else {
        setSendMsg('Facture envoyée à ' + recipient + ' ✓');
        if (partner) await handleSaveInvoice(); // archive auto à l'envoi
      }
    } catch (e: any) { setSendMsg('Erreur : ' + e.message); }
    setSending(false);
  }

  function sendWhatsApp() { window.open(`https://wa.me/?text=${encodeURIComponent(buildText())}`, '_blank'); }

  async function handleSaveInvoice() {
    const lines: InvoiceLine[] = liveLines.map(({ date, label, type, amount, apartment, cleaner, duration, unitPrice }) =>
      ({ date, label, type, amount, apartment, cleaner, duration, unitPrice }));
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
    { label: 'IBAN', key: 'iban', placeholder: 'FR76 1234 5678 9012 3456 7890 123' },
    { label: 'BIC', key: 'bic', placeholder: 'AGRIFRPP123' },
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
            Mes informations
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
          {([['new', 'Nouvelle facture'], ['history', `Historique (${invoices.length})`], ['devis', 'Devis']] as const).map(([v, label]) => (
            <button key={v} onClick={() => { setTab(v); setViewing(null); }} className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ backgroundColor: tab === v ? '#FFFFFF' : 'transparent', color: tab === v ? '#1A1A1A' : '#A8A09A', boxShadow: tab === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'devis' && <DevisPanel company={company} />}

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
              <div className="pt-1 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <button onClick={() => window.print()} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Imprimer / PDF</button>
                  <button onClick={handleSaveInvoice} className="px-5 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: '#C9A84C', color: '#C9A84C' }}>Enregistrer</button>
                  <button onClick={sendWhatsApp} className="px-5 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#5A8A6A' }}>WhatsApp</button>
                  {savedMsg && <span className="text-xs font-medium" style={{ color: '#5A8A6A' }}>{savedMsg}</span>}
                </div>
                {/* Envoi email réel (SMTP) */}
                <div className="flex flex-wrap gap-2 items-center pt-3 border-t" style={{ borderColor: '#F2EFE9' }}>
                  <input type="email" value={recipient} onChange={e => setRecipient(e.target.value)}
                    placeholder="email du partenaire" className="flex-1 min-w-[200px] px-4 py-2.5 rounded-xl text-sm border" style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
                  <button onClick={sendInvoiceEmail} disabled={sending} className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#1A1A1A', color: '#FFFFFF' }}>
                    {sending ? 'Envoi...' : 'Envoyer la facture'}
                  </button>
                  {sendMsg && <span className="text-xs font-medium" style={{ color: sendMsg.startsWith('Erreur') ? '#B85A50' : '#5A8A6A' }}>{sendMsg}</span>}
                </div>
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
            <button onClick={() => window.print()} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Imprimer / PDF</button>
          </div>
        )}
      </div>

      {/* ── Rendu facture ── */}
      {tab === 'new' && partner && liveLines.length > 0 && (
        <InvoiceDoc company={company} number={invoiceNo} partnerLabel={partner} partnerType={partnerType} status="pending"
          from={from} to={to} lines={liveLines} total={total} editable onAmount={(id, v) => setAmounts(a => ({ ...a, [id]: v }))} />
      )}
      {tab === 'new' && (!partner || liveLines.length === 0) && (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center border print-hidden" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <span className="mb-3" style={{ color: '#D4CEC4' }}><Icon name="invoice" size={30} /></span>
          <p className="font-medium text-sm" style={{ color: '#1A1A1A' }}>Choisissez une période puis un partenaire</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>La facture des missions terminées s'affichera ici</p>
        </div>
      )}
      {tab === 'history' && viewing && (
        <InvoiceDoc company={company} number={viewing.number} partnerLabel={viewing.partnerLabel}
          partnerType={viewing.partnerType} status={viewing.status}
          from={viewing.periodFrom} to={viewing.periodTo} lines={viewing.lines} total={viewing.total} />
      )}
    </div>
  );
}
