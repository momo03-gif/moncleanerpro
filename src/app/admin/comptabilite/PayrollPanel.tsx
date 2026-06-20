'use client';

import { useState, useEffect, useCallback } from 'react';
import { resolvePrimeRequestDB, currentPeriod, type PrimeRequest } from '@/lib/rhApi';
import { loadPayrollDB, recomputeAllCleanerRhDB, type Payslip } from '@/lib/payrollApi';

// ── Fiche de paie mensuelle par cleaner (admin uniquement, LOT 3bis B/C). ───────
// Le cleaner ne voit JAMAIS ces montants : panneau réservé à l'écran admin.

function money(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

interface Row { id: string; name: string; payslip: Payslip; }

export default function PayrollPanel() {
  const period = currentPeriod();
  const [rows, setRows] = useState<Row[]>([]);
  const [requests, setRequests] = useState<PrimeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  const load = useCallback(async () => {
    const { rows, requests } = await loadPayrollDB(period);
    setRows(rows ?? []);
    setRequests(requests ?? []);
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  async function recompute() {
    setRecomputing(true);
    await recomputeAllCleanerRhDB(period);
    await load();
    setRecomputing(false);
  }

  async function resolve(id: string, accept: boolean) {
    await resolvePrimeRequestDB(id, accept);
    await load();
  }

  const cleanerName = (id: string) => rows.find(r => r.id === id)?.name ?? 'Cleaner';

  if (loading) return <div className="text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Mois en cours — {period}</p>
        <button onClick={recompute} disabled={recomputing}
          className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
          style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
          {recomputing ? 'Recalcul...' : 'Recalculer la paie'}
        </button>
      </div>

      {/* Demandes de prime à valider */}
      {requests.length > 0 && (
        <div className="rounded-2xl border mb-6 overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: '#F2EFE9', backgroundColor: '#FAFAF8' }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#C48A2A' }}>Primes à valider · {requests.length}</p>
          </div>
          {requests.map((r, i) => (
            <div key={r.id} className={`px-5 py-4 flex flex-wrap items-center justify-between gap-3 ${i < requests.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
              <div>
                <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>
                  {cleanerName(r.cleanerId)} — éligible à <span style={{ color: '#C9A84C' }}>{r.type} ({money(r.montant)})</span>
                </p>
                <p className="text-xs" style={{ color: '#A8A09A' }}>Période {r.period}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => resolve(r.id, true)} className="px-4 py-2 rounded-xl text-xs font-semibold" style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>Accepter</button>
                <button onClick={() => resolve(r.id, false)} className="px-4 py-2 rounded-xl text-xs font-semibold border" style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>Refuser</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fiches de paie */}
      <div className="space-y-4">
        {rows.length === 0 && <div className="rounded-2xl border py-10 text-center text-sm" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF', color: '#A8A09A' }}>Aucun cleaner actif</div>}
        {rows.map(({ id, name, payslip: p }) => (
          <div key={id} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#F2EFE9' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>{name.charAt(0)}</div>
                <p className="font-semibold" style={{ color: '#1A1A1A' }}>{name}</p>
              </div>
              <div className="text-right">
                <p className="text-xs" style={{ color: '#A8A09A' }}>Total à payer</p>
                <p className="text-lg font-bold" style={{ color: '#1A1A1A' }}>{money(p.total)}</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-2">
              <Line label="Gain missions terminées" value={money(p.missionsGain)} color="#C9A84C" />
              <Line label={`Frais de déplacement (${p.travelMinutes} min)`} value={money(p.travelAmount)} color="#5B6EF5" />
              {p.primes.map((pr, i) => (
                <Line key={i} label={`Prime : ${pr.nom}${pr.source === 'validee' ? ' (validée)' : ''}`} value={money(pr.montant)} color="#5A8A6A" />
              ))}
              {p.primes.length === 0 && <p className="text-xs" style={{ color: '#A8A09A' }}>Aucune prime ce mois.</p>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Line({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm" style={{ color: '#7A7068' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color }}>{value}</span>
    </div>
  );
}
