'use client';

import type React from 'react';
import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import type { CompanyInfo, InvoiceLine } from '@/lib/types';
import { formatDuration } from '@/lib/format';
import { MISSION_TYPE_LABEL } from '@/lib/labels';

// ══════════════════════════════════════════════════════════════════════════════
//  Document imprimable FACTURE / DEVIS — gabarit unique, une seule identité.
//  Extrait de la page Facturation le jour où les devis ont pris leur propre
//  écran : les deux pages s'en servent, aucune ne doit dépendre de l'autre.
// ══════════════════════════════════════════════════════════════════════════════

const TYPE_LABEL = MISSION_TYPE_LABEL;

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

function fmtDateFR(d: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Document facture premium (imprimable), partagé live / historique ────────────
// Réutilisé tel quel pour les DEVIS (LOT 8) via docLabel / validUntil — même
// identité visuelle, aucune duplication du gabarit.
export function InvoiceDoc({ company, number, partnerLabel, partnerType, status, from, to, lines, total, editable, onAmount, docLabel = 'FACTURE', validUntil, totalLabel = 'Total TTC', totalIsHT = false }: {
  company: CompanyInfo;
  number: string; partnerLabel: string; partnerType?: string; status?: string;
  from: string; to: string;
  lines: (InvoiceLine & { id?: string; qty?: number })[];
  total: number;
  editable?: boolean;
  onAmount?: (id: string, v: string) => void;
  docLabel?: string;
  validUntil?: string;
  totalLabel?: string;
  totalIsHT?: boolean;   // true = le `total` fourni est HT (devis) → on ajoute la TVA
}) {
  const [qrSvg, setQrSvg] = useState('');

  const isDevis = docLabel === 'DEVIS';

  // ── Tenue sur UNE page A4 ────────────────────────────────────────────────────
  // Le gabarit était calibré pour des factures de quelques lignes ; un devis en
  // compte vite 8 à 10 (les modèles T4, Bureaux… en génèrent 6 à 8 d'un coup) et
  // débordait alors sur une 2ᵉ page quasi vide. On resserre le rythme vertical dès
  // que le document s'allonge : hauteur A4 utile ≈ 1024 px, l'ossature (en-tête,
  // client, totaux, pied) en consomme ~670 → il ne restait que ~9 lignes.
  // `dense` récupère ~180 px, `ultra` ~120 de plus, ce qui porte la capacité à une
  // vingtaine de lignes sans jamais rendre le document illisible.
  const dense = lines.length > 6;
  const ultra = lines.length > 12;
  const s = {
    logo: ultra ? 48 : dense ? 58 : 72,
    headPad: ultra ? 12 : dense ? 18 : 26,
    gap: ultra ? 12 : dense ? 18 : 26,       // écart entre les grands blocs
    rowPadY: ultra ? 5 : dense ? 7 : 11,
    boxPadY: ultra ? 10 : dense ? 12 : 16,
    thanksPadY: ultra ? 10 : dense ? 13 : 18,
    docSize: ultra ? 23 : dense ? 26 : 29,
  };

  // `total` reçu = TTC pour une FACTURE (logique conservée) ; = HT pour un DEVIS
  // (les prix saisis sont hors taxe → on AJOUTE la TVA 20 %). totalIsHT distingue.
  // Un devis HT applique toujours la TVA ; une facture selon le n° de TVA société.
  const vatApplicable = !!company.vat || totalIsHT;
  const subtotalHT = totalIsHT ? total : (vatApplicable ? total / 1.2 : total);
  const vatAmount = vatApplicable ? subtotalHT * 0.2 : 0;
  const totalTTC = subtotalHT + vatAmount;

  // Un DEVIS n'a pas de statut de paiement (ce n'est pas une facture) → badge « Devis ».
  const badge = docLabel === 'DEVIS'
    ? { label: 'Devis', color: '#9A7B22', bg: '#FBF4E2', border: '#EBD9A8' }
    : (STATUS_BADGE[status ?? 'pending'] ?? STATUS_BADGE.pending);
  const clientTypeLabel = CLIENT_TYPE_LABEL[partnerType ?? ''];   // undefined si type inconnu (ex. devis)
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
  const th: React.CSSProperties = { padding: `${s.rowPadY}px 12px`, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#E9E2D2' };
  const td: React.CSSProperties = { padding: `${s.rowPadY}px 12px`, fontSize: dense ? 11 : 11.5, color: '#4A443D', verticalAlign: 'middle' };
  const totRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B6259', padding: '4px 0' };
  const payKey: React.CSSProperties = { display: 'inline-block', width: 42, fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#B0A795' };

  return (
    <div className="invoice-print invoice-doc" style={{
      maxWidth: 840, margin: '0 auto', backgroundColor: '#FFFFFF', color: '#1A1A1A',
    }}>
      {/* ── EN-TÊTE ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, paddingBottom: s.headPad, borderBottom: '1px solid #ECE7DC' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <img src="/logo-full.png" alt="MonCleanerPro" style={{ height: s.logo, width: 'auto', display: 'block' }} />
          <div style={{ marginTop: dense ? 10 : 16, fontSize: 11, lineHeight: dense ? 1.6 : 1.85, color: '#6B6259' }}>
            {company.address && <div>{company.address}</div>}
            {(company.email || company.phone) && <div>{[company.email, company.phone].filter(Boolean).join('   ·   ')}</div>}
            {(company.siret || company.vat) && <div>{[company.siret && `SIRET ${company.siret}`, company.vat && `TVA ${company.vat}`].filter(Boolean).join('   ·   ')}</div>}
          </div>
        </div>
        <div style={{ textAlign: 'right', marginLeft: 'auto' }}>
          <p style={{ fontSize: s.docSize, fontWeight: 300, letterSpacing: '0.22em', color: '#0D0D0D', margin: 0 }}>{docLabel}</p>
          <p style={{ marginTop: 5, fontSize: 12, fontWeight: 700, color: '#C9A84C', letterSpacing: '0.04em' }}>{number}</p>
          <table style={{ marginLeft: 'auto', marginTop: dense ? 10 : 16, borderCollapse: 'collapse' }}>
            <tbody>
              <tr><td style={metaKey}>Émission</td><td style={metaVal}>{fmtDateFR(new Date().toISOString().split('T')[0])}</td></tr>
              {validUntil
                ? <tr><td style={metaKey}>Validité</td><td style={metaVal}>{fmtDateFR(validUntil)}</td></tr>
                : <tr><td style={metaKey}>Période</td><td style={metaVal}>{fmtDateFR(from)} – {fmtDateFR(to)}</td></tr>}
            </tbody>
          </table>
          <div style={{ marginTop: dense ? 9 : 13 }}>
            <span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 999, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', color: badge.color, backgroundColor: badge.bg, border: `1px solid ${badge.border}` }}>
              {badge.label}
            </span>
          </div>
        </div>
      </div>

      {/* ── CLIENT ── */}
      <div style={{ marginTop: s.gap }}>
        <p style={sectionLabel}>{isDevis ? 'Devis pour' : 'Facturé à'}</p>
        <div style={{ marginTop: 8, background: '#FAF8F3', border: '1px solid #EFE9DC', borderRadius: 14, padding: `${s.boxPadY}px 20px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <p style={{ fontSize: 15.5, fontWeight: 700, color: '#0D0D0D', margin: 0 }}>{partnerLabel}</p>
            <p style={{ fontSize: 11, color: '#8A8178', margin: '3px 0 0' }}>{clientTypeLabel ? `Client ${clientTypeLabel.toLowerCase()}` : 'Client'}</p>
          </div>
          {clientTypeLabel && (
            <span style={{ padding: '5px 13px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#9A7B22', background: '#F4E9CB', border: '1px solid #E7D6A6' }}>
              {clientTypeLabel}
            </span>
          )}
        </div>
      </div>

      {/* ── TABLEAU DES PRESTATIONS ── */}
      {/* Sur un DEVIS, Date et Durée ne portent aucune information (même date répétée
          à chaque ligne, durée inconnue avant intervention) : on les remplace par la
          quantité. Moins de colonnes = libellés qui ne se coupent plus sur 2 lignes,
          donc des lignes plus courtes. */}
      <div style={{ marginTop: s.gap, overflowX: 'auto' }}>
        <table style={{ width: '100%', minWidth: isDevis ? 380 : 480, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: '#0D0D0D' }}>
              {!isDevis && <th style={{ ...th, textAlign: 'left', borderTopLeftRadius: 10 }}>Date</th>}
              <th style={{ ...th, textAlign: 'left', ...(isDevis ? { borderTopLeftRadius: 10 } : {}) }}>{isDevis ? 'Prestation' : 'Appartement / Chambre'}</th>
              {!isDevis && <th style={{ ...th, textAlign: 'left' }}>Prestation</th>}
              <th style={{ ...th, textAlign: 'center' }}>{isDevis ? 'Qté' : 'Durée'}</th>
              <th style={{ ...th, textAlign: 'right' }}>P.U.</th>
              <th style={{ ...th, textAlign: 'right', borderTopRightRadius: 10 }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={l.id ?? i} style={{ borderBottom: '1px solid #F0EBE0', backgroundColor: i % 2 ? '#FBF9F4' : '#FFFFFF' }}>
                {!isDevis && <td style={{ ...td, whiteSpace: 'nowrap' }}>{fmtDateFR(l.date)}</td>}
                <td style={{ ...td, fontWeight: 600, color: '#1A1A1A' }}>{l.apartment || l.label}</td>
                {!isDevis && <td style={td}>{TYPE_LABEL[l.type] ?? l.type}</td>}
                <td style={{ ...td, textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {isDevis ? (l.qty ?? 1) : (l.duration ? formatDuration(Math.round(l.duration * 60)) : '—')}
                </td>
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
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: s.gap, alignItems: 'flex-start' }}>
        {/* Paiement */}
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <p style={sectionLabel}>Coordonnées de paiement</p>
          <div style={{ marginTop: dense ? 7 : 10, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            {/* QR de paiement : uniquement sur les FACTURES (un devis ne se paie pas). */}
            {docLabel !== 'DEVIS' && (qrSvg
              ? <div style={{ width: 92, height: 92, padding: 6, background: '#FFFFFF', border: '1px solid #EFE9DC', borderRadius: 12, flexShrink: 0 }} dangerouslySetInnerHTML={{ __html: qrSvg }} />
              : <div style={{ width: 92, height: 92, background: '#FAF8F3', border: '1px dashed #DAD2C2', borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, textAlign: 'center', color: '#B0A795', lineHeight: 1.4, padding: 8 }}>QR de paiement</div>)}
            <div style={{ fontSize: 11.5, lineHeight: dense ? 1.65 : 1.95, color: '#4A443D', minWidth: 0, overflowWrap: 'anywhere' }}>
              {company.iban && <div><span style={payKey}>IBAN</span> <span style={{ fontFamily: 'ui-monospace, monospace', letterSpacing: '0.02em' }}>{company.iban}</span></div>}
              {company.bic && <div><span style={payKey}>BIC</span> {company.bic}</div>}
              <div style={{ marginTop: 8, fontSize: 10.5, color: '#8A8178' }}>
                {docLabel === 'DEVIS'
                  ? <>Règlement accepté : espèces, chèque ou virement.</>
                  : <>Règlement par virement sous 30 jours.<br />Merci d'indiquer <strong style={{ color: '#6B6259' }}>{number}</strong> en référence.</>}
              </div>
            </div>
          </div>
        </div>

        {/* Totaux */}
        <div style={{ flex: '1 1 240px', minWidth: 220 }}>
          <div style={{ background: '#FAF8F3', border: '1px solid #EFE9DC', borderRadius: 14, padding: `${dense ? 10 : 14}px 18px` }}>
            <div style={totRow}><span>Sous-total HT</span><span style={{ fontWeight: 600, color: '#1A1A1A' }}>{money(subtotalHT)}</span></div>
            <div style={totRow}>
              <span>{vatApplicable ? 'TVA 20 %' : 'TVA'}</span>
              <span style={{ fontWeight: 600, color: '#1A1A1A' }}>{vatApplicable ? money(vatAmount) : 'Non applicable'}</span>
            </div>
          </div>
          <div style={{ marginTop: dense ? 7 : 10, background: '#C9A84C', borderRadius: 14, padding: `${dense ? 11 : 15}px 18px`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 6px 16px rgba(201,168,76,0.28)' }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1A1A1A' }}>{totalLabel}</span>
            <span style={{ fontSize: dense ? 20 : 22, fontWeight: 800, color: '#1A1A1A' }}>{money(totalTTC)}</span>
          </div>
          {!vatApplicable && <p style={{ fontSize: 9, color: '#B0A795', margin: '8px 2px 0', textAlign: 'right' }}>TVA non applicable — art. 293 B du CGI</p>}
        </div>
      </div>

      {/* ── REMERCIEMENT ── */}
      <div style={{ marginTop: s.gap, padding: `${s.thanksPadY}px 24px`, background: '#0D0D0D', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: dense ? 13.5 : 14.5, fontWeight: 700, color: '#FFFFFF', margin: 0 }}>Merci pour votre confiance.</p>
          <p style={{ fontSize: 10.5, color: '#A99F8C', margin: '4px 0 0' }}>L&apos;équipe {companyName}</p>
        </div>
        <span style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#C9A84C', color: '#0D0D0D', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 15 }}>M</span>
      </div>

      {/* ── PIED DE PAGE ── */}
      <div style={{ marginTop: dense ? 14 : 22, paddingTop: dense ? 10 : 14, borderTop: '1px solid #ECE7DC', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 9, color: '#B0A795', letterSpacing: '0.02em' }}>
        <span>{companyName}{(company.email || company.phone) ? ` · ${[company.email, company.phone].filter(Boolean).join(' · ')}` : ''}{company.siret ? ` · SIRET ${company.siret}` : ''}</span>
        {/* « Page 1/1 » n'est affirmé que tant que le document tient réellement sur
            une page ; au-delà d'une vingtaine de lignes il peut paginer. */}
        <span style={{ whiteSpace: 'nowrap' }}>Générée le {genDate}{ultra ? '' : ' · Page 1/1'}</span>
      </div>
    </div>
  );
}
