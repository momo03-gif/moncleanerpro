'use client';

import { useState, useEffect, useCallback } from 'react';
import { resolvePrimeRequestDB, currentPeriod, type PrimeRequest } from '@/lib/rhApi';
import { loadPayrollDB, recomputeAllCleanerRhDB, setPayAdjustmentDB, type Payslip } from '@/lib/payrollApi';
import Loading from "@/components/Loading";

// ── Fiche de paie mensuelle par cleaner (admin uniquement, LOT 3bis B/C). ───────
// Le cleaner ne voit JAMAIS ces montants : panneau réservé à l'écran admin.

function money(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

// Minutes → « 12h30 » (ou « 0h » si rien).
function hm(min: number) {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? `${h}h` : `${h}h${String(r).padStart(2, '0')}`;
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

  if (loading) return <Loading className="text-sm" />;

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
              {p.primes.map((pr, i) => (
                <Line key={i} label={`Prime : ${pr.nom}${pr.source === 'validee' ? ' (validée)' : ''}`} value={money(pr.montant)} color="#5A8A6A" />
              ))}
              {p.adjustment !== 0 && (
                <Line label={`Ajustement${p.adjustmentNote ? ` : ${p.adjustmentNote}` : ''}`} value={money(p.adjustment)} color={p.adjustment < 0 ? '#B85A50' : '#5A8A6A'} />
              )}
              {p.primes.length === 0 && p.adjustment === 0 && <p className="text-xs" style={{ color: '#A8A09A' }}>Aucune prime ce mois.</p>}
            </div>

            {/* Temps du mois : prévu (ménage accordé) vs réel (pointage, sinon prévu) */}
            <div className="px-5 py-4 border-t" style={{ borderColor: '#F2EFE9', backgroundColor: '#FAFAF8' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Temps du mois</p>
                <p className="text-xs" style={{ color: '#A8A09A' }}>
                  {p.time.pointedCount}/{p.time.missionsCount} mission{p.time.missionsCount > 1 ? 's' : ''} pointée{p.time.pointedCount > 1 ? 's' : ''}
                  {p.time.pointedCount < p.time.missionsCount && ' · le reste compté au temps accordé'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border px-3 py-2" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
                  <p className="text-xs" style={{ color: '#A8A09A' }}>Ménage accordé (prévu)</p>
                  <p className="text-base font-bold" style={{ color: '#1A1A1A' }}>{hm(p.time.plannedMinutes)}</p>
                </div>
                <div className="rounded-xl border px-3 py-2" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
                  <p className="text-xs" style={{ color: '#A8A09A' }}>Temps réel</p>
                  <p className="text-base font-bold" style={{ color: p.time.realMinutes > p.time.plannedMinutes ? '#B85A50' : '#5A8A6A' }}>{hm(p.time.realMinutes)}</p>
                </div>
              </div>
            </div>

            {/* Ajustement manuel de la paie (admin) */}
            <AdjustEditor
              cleanerId={id}
              period={period}
              initialAmount={p.adjustment}
              initialNote={p.adjustmentNote ?? ''}
              onSaved={load}
            />
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

// Éditeur d'ajustement manuel de la paie (delta € + raison). Le total est
// recalculé côté serveur, puis la liste est rechargée via onSaved.
function AdjustEditor({ cleanerId, period, initialAmount, initialNote, onSaved }: {
  cleanerId: string; period: string; initialAmount: number; initialNote: string; onSaved: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(initialAmount !== 0 || initialNote !== '');
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '');
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await setPayAdjustmentDB(cleanerId, period, Number(amount.replace(',', '.')) || 0, note);
    await onSaved();
    setSaving(false);
  }

  if (!open) {
    return (
      <div className="px-5 py-3 border-t" style={{ borderColor: '#F2EFE9' }}>
        <button onClick={() => setOpen(true)} className="text-xs font-semibold" style={{ color: '#C9A84C' }}>
          + Ajuster la paie
        </button>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 border-t space-y-3" style={{ borderColor: '#F2EFE9' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Ajustement de la paie</p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: '#A8A09A' }}>Montant (€, +/-)</label>
          <input value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" placeholder="0"
            className="w-28 px-3 py-2 rounded-xl border text-sm" style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }} />
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs mb-1" style={{ color: '#A8A09A' }}>Raison</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="ex. heures supplémentaires"
            className="w-full px-3 py-2 rounded-xl border text-sm" style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }} />
        </div>
        <button onClick={save} disabled={saving}
          className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
          style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
          {saving ? '...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
