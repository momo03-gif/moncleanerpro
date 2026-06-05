'use client';

import { useState, useEffect, useMemo } from 'react';
import { getMissionsDB } from '@/lib/db';
import type { Mission } from '@/lib/types';
import { inputStyle } from '@/lib/ui';

// Libellé partenaire à facturer pour une mission
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

export default function FacturationPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const init = monthBounds();
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);
  const [partner, setPartner] = useState('');
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    getMissionsDB().then(m => { setMissions(m); setLoading(false); });
  }, []);

  // Missions terminées sur la période
  const done = useMemo(
    () => missions.filter(m => m.status === 'completed' && m.date >= from && m.date <= to),
    [missions, from, to],
  );

  // Liste des partenaires détectés (avec nb de missions terminées sur la période)
  const partners = useMemo(() => {
    const map = new Map<string, number>();
    done.forEach(m => map.set(partnerLabel(m), (map.get(partnerLabel(m)) ?? 0) + 1));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [done]);

  const lines = useMemo(
    () => done.filter(m => partnerLabel(m) === partner)
      .sort((a, b) => a.date.localeCompare(b.date)),
    [done, partner],
  );

  // Montant par défaut = prix de la mission ; éditable
  function amountOf(m: Mission): number {
    const v = amounts[m.id];
    if (v !== undefined) return Number(v) || 0;
    return m.price || 0;
  }
  const total = lines.reduce((s, m) => s + amountOf(m), 0);

  const today = new Date();
  const invoiceNo = partner
    ? `FAC-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}-${partner.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'XXXX'}`
    : '';

  function setThisMonth() { const b = monthBounds(); setFrom(b.from); setTo(b.to); }
  function setLastMonth() {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    const b = monthBounds(d); setFrom(b.from); setTo(b.to);
  }

  function buildText(): string {
    const head = `Facture ${invoiceNo} — ${partner}\nPériode : ${fmtDateFR(from)} au ${fmtDateFR(to)}\n\n`;
    const body = lines.map(m => `• ${fmtDateFR(m.date)} — ${m.property || TYPE_LABEL[m.type] || 'Ménage'} : ${amountOf(m).toFixed(2)} €`).join('\n');
    const foot = `\n\nTotal : ${total.toFixed(2)} €\n\nMonCleanerPro`;
    return head + body + foot;
  }

  function sendEmail() {
    const subject = encodeURIComponent(`Facture ${invoiceNo} — MonCleanerPro`);
    const body = encodeURIComponent(buildText());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }
  function sendWhatsApp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildText())}`, '_blank');
  }

  if (loading) return <div className="p-6 text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* ── Contrôles (non imprimés) ── */}
      <div className="print-hidden">
        <div className="mb-6">
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Facturation</h1>
          <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Générez une facture à partir des missions réalisées pour un partenaire</p>
        </div>

        <div className="rounded-2xl border p-5 mb-6 space-y-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          {/* Période */}
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

          {/* Partenaire */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Partenaire</label>
            <select value={partner} onChange={e => { setPartner(e.target.value); setAmounts({}); }}
              className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
              style={{ ...inputStyle, color: partner ? '#1A1A1A' : '#A8A09A' }}>
              <option value="">Sélectionner un partenaire</option>
              {partners.map(([name, count]) => <option key={name} value={name}>{name} ({count})</option>)}
            </select>
            {partners.length === 0 && (
              <p className="text-xs mt-2" style={{ color: '#A8A09A' }}>Aucune mission terminée sur cette période.</p>
            )}
          </div>

          {/* Actions */}
          {partner && lines.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button onClick={() => window.print()} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>🖨 Imprimer / PDF</button>
              <button onClick={sendEmail} className="px-5 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>✉ Email</button>
              <button onClick={sendWhatsApp} className="px-5 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#5A8A6A' }}>WhatsApp</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Facture (imprimable) ── */}
      {partner && lines.length > 0 ? (
        <div className="invoice-print rounded-2xl border p-6 md:p-10" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          {/* En-tête */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl font-bold" style={{ color: '#C9A84C' }}>✦</span>
                <span className="text-xl font-bold" style={{ color: '#1A1A1A' }}>MonCleanerPro</span>
              </div>
              <p className="text-xs" style={{ color: '#A8A09A' }}>Plateforme professionnelle de nettoyage</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold" style={{ color: '#1A1A1A' }}>FACTURE</p>
              <p className="text-xs" style={{ color: '#A8A09A' }}>{invoiceNo}</p>
              <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Émise le {fmtDateFR(today.toISOString().split('T')[0])}</p>
            </div>
          </div>

          {/* Destinataire + période */}
          <div className="flex flex-wrap justify-between gap-4 mb-8">
            <div>
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#A8A09A' }}>Facturé à</p>
              <p className="text-base font-semibold" style={{ color: '#1A1A1A' }}>{partner}</p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wider mb-1" style={{ color: '#A8A09A' }}>Période</p>
              <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{fmtDateFR(from)} → {fmtDateFR(to)}</p>
            </div>
          </div>

          {/* Lignes */}
          <table className="w-full text-sm mb-6" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E8E4DC' }}>
                <th className="text-left py-2 font-semibold" style={{ color: '#7A7068' }}>Date</th>
                <th className="text-left py-2 font-semibold" style={{ color: '#7A7068' }}>Prestation</th>
                <th className="text-right py-2 font-semibold" style={{ color: '#7A7068' }}>Montant</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid #F2EFE9' }}>
                  <td className="py-2.5" style={{ color: '#1A1A1A' }}>{fmtDateFR(m.date)}</td>
                  <td className="py-2.5" style={{ color: '#1A1A1A' }}>
                    {m.property || TYPE_LABEL[m.type] || 'Ménage'}
                    <span className="text-xs ml-2" style={{ color: '#A8A09A' }}>{TYPE_LABEL[m.type] ?? m.type}</span>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="inline-flex items-center gap-1">
                      <input type="number" min="0" step="0.01"
                        value={amounts[m.id] ?? String(m.price || 0)}
                        onChange={e => setAmounts(a => ({ ...a, [m.id]: e.target.value }))}
                        className="w-20 text-right px-2 py-1 rounded-lg border"
                        style={{ borderColor: '#E8E4DC', color: '#1A1A1A', outline: 'none' }} />
                      <span style={{ color: '#1A1A1A' }}>€</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total */}
          <div className="flex justify-end">
            <div className="w-full max-w-xs">
              <div className="flex justify-between py-2 text-sm" style={{ color: '#7A7068' }}>
                <span>{lines.length} mission{lines.length > 1 ? 's' : ''}</span>
                <span></span>
              </div>
              <div className="flex justify-between py-3 border-t" style={{ borderColor: '#1A1A1A' }}>
                <span className="font-bold" style={{ color: '#1A1A1A' }}>Total</span>
                <span className="font-bold text-lg" style={{ color: '#1A1A1A' }}>{total.toFixed(2)} €</span>
              </div>
            </div>
          </div>

          <p className="text-xs mt-10 pt-4 border-t" style={{ color: '#A8A09A', borderColor: '#F2EFE9' }}>
            Merci de votre confiance. — MonCleanerPro
          </p>
        </div>
      ) : (
        <div className="rounded-2xl p-10 text-center border print-hidden" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-2xl mb-3">🧾</p>
          <p className="font-medium text-sm" style={{ color: '#1A1A1A' }}>Choisissez une période puis un partenaire</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>La facture des missions terminées s'affichera ici</p>
        </div>
      )}
    </div>
  );
}
