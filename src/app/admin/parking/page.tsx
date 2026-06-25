'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { listParkingPaymentsClient } from '@/lib/parkingApi';
import type { ParkingPayment, ParkingStatus } from '@/lib/types';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';

const STATUS_CFG: Record<ParkingStatus, { label: string; color: string; bg: string }> = {
  paid:      { label: 'Payé',       color: '#5A8A6A', bg: '#5A8A6A15' },
  pending:   { label: 'En attente', color: '#C48A2A', bg: '#C48A2A15' },
  failed:    { label: 'Échec',      color: '#B85A50', bg: '#B85A5012' },
  cancelled: { label: 'Annulé',     color: '#A8A09A', bg: '#F5F3EF' },
};

const PROVIDER_LABEL: Record<string, string> = {
  manual: 'Saisie manuelle',
  paybyphone: 'PayByPhone',
};

function fmtDateTime(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' · ' +
    d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function AdminParkingPage() {
  const [payments, setPayments] = useState<ParkingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cleaner, setCleaner] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const rows = await listParkingPaymentsClient({
      from: from ? `${from}T00:00:00` : undefined,
      to: to ? `${to}T23:59:59` : undefined,
    });
    setPayments(Array.isArray(rows) ? rows : []);
    setLoading(false);
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  // Filtre livreur dérivé des paiements chargés (self-contained, pas de requête en plus).
  const cleanerOptions = useMemo(() => {
    const set = new Map<string, string>();
    payments.forEach(p => { if (p.cleanerId && p.cleanerName) set.set(p.cleanerId, p.cleanerName); });
    return Array.from(set, ([id, name]) => ({ id, name }));
  }, [payments]);

  const filtered = cleaner ? payments.filter(p => p.cleanerId === cleaner) : payments;
  const total = filtered.reduce((s, p) => s + (p.amount ?? 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: '#1A1A1A' }}>
          <Icon name="parking" size={22} /> Stationnement
        </h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Historique des paiements de parking des livreurs</p>
      </div>

      {/* Filtres */}
      <div className="rounded-2xl border p-4 mb-5 grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Du</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm border"
            style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8', color: '#1A1A1A', outline: 'none' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Au</label>
          <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm border"
            style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8', color: '#1A1A1A', outline: 'none' }} />
        </div>
        <div>
          <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Livreur</label>
          <select value={cleaner} onChange={e => setCleaner(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-sm border"
            style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8', color: '#1A1A1A', outline: 'none' }}>
            <option value="">Tous</option>
            {cleanerOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {/* Récap */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-2xl p-4 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{filtered.length}</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Paiement{filtered.length > 1 ? 's' : ''}</p>
        </div>
        <div className="rounded-2xl p-4 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{total.toFixed(2)} €</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Total stationnement</p>
        </div>
      </div>

      {loading ? (
        <Loading className="text-sm" />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <span className="mb-3" style={{ color: '#D4CEC4' }}><Icon name="parking" size={30} /></span>
          <p className="font-medium text-sm" style={{ color: '#1A1A1A' }}>Aucun paiement</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>sur cette période</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>
                  <th className="text-left font-medium px-4 py-3">Date</th>
                  <th className="text-left font-medium px-4 py-3">Livreur</th>
                  <th className="text-left font-medium px-4 py-3">Adresse</th>
                  <th className="text-right font-medium px-4 py-3">Montant</th>
                  <th className="text-left font-medium px-4 py-3">Statut</th>
                  <th className="text-left font-medium px-4 py-3">Source</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const st = STATUS_CFG[p.status as ParkingStatus] ?? STATUS_CFG.paid;
                  return (
                    <tr key={p.id} className="border-t" style={{ borderColor: '#F2EFE9' }}>
                      <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#7A7068' }}>{fmtDateTime(p.paidAt)}</td>
                      <td className="px-4 py-3" style={{ color: '#1A1A1A' }}>{p.cleanerName ?? '—'}</td>
                      <td className="px-4 py-3" style={{ color: '#7A7068' }}>
                        <span className="block max-w-[260px] truncate">{p.address || '—'}</span>
                        {p.property && <span className="block text-xs" style={{ color: '#A8A09A' }}>{p.property}</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium whitespace-nowrap" style={{ color: '#1A1A1A' }}>
                        {p.amount != null ? `${p.amount.toFixed(2)} €` : '—'}
                        {p.durationMinutes ? <span className="block text-xs font-normal" style={{ color: '#A8A09A' }}>{p.durationMinutes} min</span> : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#A8A09A' }}>{PROVIDER_LABEL[p.provider] ?? p.provider}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
