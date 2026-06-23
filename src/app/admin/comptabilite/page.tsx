'use client';

import { useState, useEffect } from 'react';
import { getMissionsDB, getCleaners, getPaymentsDB } from '@/lib/db';
import type { Mission, Payment } from '@/lib/types';
import { currentMonth } from '@/lib/mockData';
import { formatDuration } from '@/lib/format';
import { serviceParts } from '@/lib/service';
import { loadPayrollDB, type PayrollRow } from '@/lib/payrollApi';
import PayrollPanel from './PayrollPanel';
import DepensesPanel from './DepensesPanel';

export default function ComptabilitePage() {
  const [tab, setTab] = useState<'global' | 'paie' | 'depenses'>('global');
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Comptabilité</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Vue financière globale &amp; fiches de paie</p>
      </div>
      <div className="flex gap-1 mb-6 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
        {([['global', 'Vue globale'], ['paie', 'Fiches de paie'], ['depenses', 'Dépenses & TVA']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ backgroundColor: tab === v ? '#FFFFFF' : 'transparent', color: tab === v ? '#1A1A1A' : '#A8A09A', boxShadow: tab === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'global' ? <GlobalView /> : tab === 'paie' ? <PayrollPanel /> : <DepensesPanel />}
    </div>
  );
}

function GlobalView() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [cleaners, setCleaners] = useState<any[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [payroll, setPayroll] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMissionsDB(), getCleaners(), getPaymentsDB(), loadPayrollDB(currentMonth())]).then(([m, c, p, pay]) => {
      setMissions(m); setCleaners(c); setPayments(p);
      setPayroll(pay.rows ?? []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-4 md:p-6 text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  const month = currentMonth();

  // Charges salariales RÉELLES du mois (fiches de paie) : primes + déplacements,
  // en plus du salaire de base. Le bénéfice « ce mois » les déduit pour refléter
  // le vrai coût employeur (avant : seul le salaire de base était compté).
  const primesMonth = Math.round(payroll.reduce((s, r) => s + r.payslip.primes.reduce((a, p) => a + p.montant, 0), 0) * 100) / 100;
  const travelMonth = Math.round(payroll.reduce((s, r) => s + (r.payslip.travelAmount ?? 0), 0) * 100) / 100;
  const completedMissions = missions.filter(m => m.status === 'completed');
  // Les livraisons ne sont pas facturées au client (à la charge de l'entreprise) :
  // leur prix n'entre PAS dans le CA. En revanche leur coût (cleanerGain) reste
  // compté dans les salaires/charges ci-dessous — c'est justement une charge.
  const isBillable = (m: Mission) => serviceParts(m.service).cleaning;
  const totalRevenue = completedMissions.reduce((s, m) => s + (isBillable(m) ? m.price : 0), 0);
  const totalSalaries = completedMissions.reduce((s, m) => s + (m.cleanerGain ?? 0), 0);
  const netProfit = totalRevenue - totalSalaries;

  const thisMonthMissions = completedMissions.filter(m => m.date.startsWith(month));
  const revenueMonth = thisMonthMissions.reduce((s, m) => s + (isBillable(m) ? m.price : 0), 0);
  const salariesMonth = thisMonthMissions.reduce((s, m) => s + (m.cleanerGain ?? 0), 0);
  // Coût employeur total du mois = base + primes + déplacements.
  const laborMonth = Math.round((salariesMonth + primesMonth + travelMonth) * 100) / 100;
  const profitMonth = Math.round((revenueMonth - laborMonth) * 100) / 100;

  const cleanerStats = cleaners.map(c => {
    const cm = completedMissions.filter(m => m.cleanerId === c.id);
    const cmMonth = cm.filter(m => m.date.startsWith(month));
    const paidIds = payments.filter(p => p.cleanerId === c.id && p.month === month).flatMap(p => p.missionIds);
    const unpaidAmount = cmMonth.filter(m => !paidIds.includes(m.id)).reduce((s, m) => s + (m.cleanerGain ?? 0), 0);
    const totalEarned = cm.reduce((s, m) => s + (m.cleanerGain ?? 0), 0);
    return { cleaner: c, missionCount: cm.length, missionCountMonth: cmMonth.length, totalEarned, unpaidAmount };
  });

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="rounded-2xl p-4 md:p-5 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-xs mb-2" style={{ color: '#A8A09A' }}>Revenus totaux</p>
          <p className="text-2xl font-bold" style={{ color: '#5A8A6A' }}>{totalRevenue}€</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>{completedMissions.length} missions terminées</p>
        </div>
        <div className="rounded-2xl p-4 md:p-5 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-xs mb-2" style={{ color: '#A8A09A' }}>Salaires cleaners</p>
          <p className="text-2xl font-bold" style={{ color: '#B85A50' }}>{totalSalaries}€</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Gains distribués</p>
        </div>
        <div className="rounded-2xl p-4 md:p-5 border" style={{ backgroundColor: '#C9A84C', borderColor: '#C9A84C' }}>
          <p className="text-xs mb-2" style={{ color: '#7A6030' }}>Bénéfice net</p>
          <p className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{netProfit}€</p>
          <p className="text-xs mt-1" style={{ color: '#7A6030' }}>Revenus − Salaires</p>
        </div>
      </div>

      <div className="rounded-2xl border p-5 mb-8" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7A7068' }}>Ce mois — {month}</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
          <div>
            <p className="text-xs mb-1" style={{ color: '#A8A09A' }}>Revenus</p>
            <p className="text-xl font-bold" style={{ color: '#5A8A6A' }}>{revenueMonth}€</p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#A8A09A' }}>Salaires base</p>
            <p className="text-xl font-bold" style={{ color: '#B85A50' }}>{salariesMonth}€</p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#A8A09A' }}>Primes</p>
            <p className="text-xl font-bold" style={{ color: '#C48A2A' }}>{primesMonth}€</p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#A8A09A' }}>Déplacements</p>
            <p className="text-xl font-bold" style={{ color: '#8B7A62' }}>{travelMonth}€</p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#A8A09A' }}>Bénéfice net</p>
            <p className="text-xl font-bold" style={{ color: '#C9A84C' }}>{profitMonth}€</p>
          </div>
        </div>
        <p className="text-[11px] mt-3" style={{ color: '#A8A09A' }}>
          Bénéfice = revenus − (salaires base + primes + déplacements). Coût employeur total ce mois : {laborMonth}€.
        </p>
      </div>

      <h2 className="font-semibold mb-4" style={{ color: '#1A1A1A' }}>Par cleaner</h2>
      <div className="rounded-2xl overflow-hidden border mb-8" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
        <div className="hidden md:grid grid-cols-5 px-5 py-3 text-xs font-semibold uppercase tracking-wide border-b" style={{ color: '#A8A09A', borderColor: '#F2EFE9', backgroundColor: '#FAFAF8' }}>
          <span className="col-span-2">Cleaner</span><span>Missions (mois)</span><span>Total gagné</span><span>À payer (mois)</span>
        </div>
        {cleanerStats.length === 0 && <div className="py-10 text-center text-sm" style={{ color: '#A8A09A' }}>Aucun cleaner</div>}
        {cleanerStats.map((s, i) => (
          <div key={s.cleaner.id} className={`px-5 py-4 flex flex-col md:grid md:grid-cols-5 gap-2 md:gap-0 md:items-center ${i < cleanerStats.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
            <div className="md:col-span-2 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>{s.cleaner.name.charAt(0)}</div>
              <div>
                <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{s.cleaner.name}</p>
                <p className="text-xs" style={{ color: '#A8A09A' }}>
                  {s.cleaner.hourly_rate ? `${s.cleaner.hourly_rate}€/h` : ''}
                </p>
              </div>
            </div>
            <div><p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{s.missionCountMonth}</p><p className="text-xs" style={{ color: '#A8A09A' }}>{s.missionCount} total</p></div>
            <div><p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{s.totalEarned}€</p></div>
            <div>
              <span className="text-sm font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: s.unpaidAmount > 0 ? '#C48A2A15' : '#5A8A6A15', color: s.unpaidAmount > 0 ? '#C48A2A' : '#5A8A6A' }}>
                {s.unpaidAmount > 0 ? `${s.unpaidAmount}€` : '✓ Payé'}
              </span>
            </div>
          </div>
        ))}
      </div>

      <h2 className="font-semibold mb-4" style={{ color: '#1A1A1A' }}>Détail missions terminées</h2>
      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
        <div className="hidden md:grid grid-cols-5 px-5 py-3 text-xs font-semibold uppercase tracking-wide border-b" style={{ color: '#A8A09A', borderColor: '#F2EFE9', backgroundColor: '#FAFAF8' }}>
          <span className="col-span-2">Propriété</span><span>Cleaner</span><span>Prix client</span><span>Gain cleaner</span>
        </div>
        {completedMissions.length === 0 && <div className="py-10 text-center text-sm" style={{ color: '#A8A09A' }}>Aucune mission terminée</div>}
        {completedMissions.sort((a, b) => b.date.localeCompare(a.date)).map((m, i) => (
          <div key={m.id} className={`px-5 py-4 flex flex-col md:grid md:grid-cols-5 gap-1 md:gap-0 md:items-center ${i < completedMissions.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
            <div className="md:col-span-2">
              <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{m.property}</p>
              <p className="text-xs" style={{ color: '#A8A09A' }}>{m.date} · {formatDuration(m.missionDurationMinutes)}</p>
            </div>
            <p className="text-sm" style={{ color: m.cleanerName ? '#1A1A1A' : '#A8A09A' }}>{m.cleanerName ?? '—'}</p>
            <p className="text-sm font-semibold" style={{ color: isBillable(m) ? '#5A8A6A' : '#A8A09A' }}>{isBillable(m) ? `${m.price}€` : '—'}</p>
            <p className="text-sm font-semibold" style={{ color: m.cleanerGain ? '#C9A84C' : '#A8A09A' }}>{m.cleanerGain ? `${m.cleanerGain}€` : '—'}</p>
          </div>
        ))}
      </div>
    </>
  );
}
