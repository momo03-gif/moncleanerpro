'use client';

import { getMissions, getUsers, getPayments, currentMonth } from '@/lib/mockData';

export default function ComptabilitePage() {
  const missions = getMissions();
  const cleaners = getUsers().filter(u => u.role === 'cleaner');
  const payments = getPayments();
  const month = currentMonth();

  const completedMissions = missions.filter(m => m.status === 'completed');

  // Revenus = prix client de toutes les missions terminées
  const totalRevenue = completedMissions.reduce((s, m) => s + m.price, 0);

  // Salaires = gains cleaners des missions terminées
  const totalSalaries = completedMissions.reduce((s, m) => s + (m.cleanerGain ?? 0), 0);

  // Bénéfice net
  const netProfit = totalRevenue - totalSalaries;

  // Ce mois
  const thisMonthMissions = completedMissions.filter(m => m.date.startsWith(month));
  const revenueMonth = thisMonthMissions.reduce((s, m) => s + m.price, 0);
  const salariesMonth = thisMonthMissions.reduce((s, m) => s + (m.cleanerGain ?? 0), 0);
  const profitMonth = revenueMonth - salariesMonth;

  // Par cleaner
  const cleanerStats = cleaners.map(c => {
    const cm = completedMissions.filter(m => m.cleanerId === c.id);
    const cmMonth = cm.filter(m => m.date.startsWith(month));
    const paidIds = payments.filter(p => p.cleanerId === c.id && p.month === month).flatMap(p => p.missionIds);
    const unpaidAmount = cmMonth.filter(m => !paidIds.includes(m.id)).reduce((s, m) => s + (m.cleanerGain ?? 0), 0);
    const totalEarned = cm.reduce((s, m) => s + (m.cleanerGain ?? 0), 0);
    return { cleaner: c, missionCount: cm.length, missionCountMonth: cmMonth.length, totalEarned, unpaidAmount };
  });

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Comptabilité</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Vue financière globale</p>
      </div>

      {/* ── Global KPIs */}
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

      {/* ── Ce mois */}
      <div className="rounded-2xl border p-5 mb-8" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: '#7A7068' }}>Ce mois — {month}</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs mb-1" style={{ color: '#A8A09A' }}>Revenus</p>
            <p className="text-xl font-bold" style={{ color: '#5A8A6A' }}>{revenueMonth}€</p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#A8A09A' }}>Salaires</p>
            <p className="text-xl font-bold" style={{ color: '#B85A50' }}>{salariesMonth}€</p>
          </div>
          <div>
            <p className="text-xs mb-1" style={{ color: '#A8A09A' }}>Bénéfice</p>
            <p className="text-xl font-bold" style={{ color: '#C9A84C' }}>{profitMonth}€</p>
          </div>
        </div>
      </div>

      {/* ── Par cleaner */}
      <h2 className="font-semibold mb-4" style={{ color: '#1A1A1A' }}>Par cleaner</h2>
      <div className="rounded-2xl overflow-hidden border mb-8" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
        <div className="hidden md:grid grid-cols-5 px-5 py-3 text-xs font-semibold uppercase tracking-wide border-b" style={{ color: '#A8A09A', borderColor: '#F2EFE9', backgroundColor: '#FAFAF8' }}>
          <span className="col-span-2">Cleaner</span>
          <span>Missions (mois)</span>
          <span>Total gagné</span>
          <span>À payer (mois)</span>
        </div>
        {cleanerStats.map((s, i) => (
          <div key={s.cleaner.id} className={`px-5 py-4 flex flex-col md:grid md:grid-cols-5 gap-2 md:gap-0 md:items-center ${i < cleanerStats.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
            <div className="md:col-span-2 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>
                {s.cleaner.name.charAt(0)}
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{s.cleaner.name}</p>
                <p className="text-xs" style={{ color: '#A8A09A' }}>{s.cleaner.hourlyRateHotel ? `${s.cleaner.hourlyRateHotel}€/h hôtel` : ''}{s.cleaner.hourlyRateHotel && s.cleaner.rateAirbnb ? ' · ' : ''}{s.cleaner.rateAirbnb ? `${s.cleaner.rateAirbnb}€/apt` : ''}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{s.missionCountMonth}</p>
              <p className="text-xs" style={{ color: '#A8A09A' }}>{s.missionCount} total</p>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{s.totalEarned}€</p>
            </div>
            <div>
              <span className="text-sm font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: s.unpaidAmount > 0 ? '#C48A2A15' : '#5A8A6A15', color: s.unpaidAmount > 0 ? '#C48A2A' : '#5A8A6A' }}>
                {s.unpaidAmount > 0 ? `${s.unpaidAmount}€` : '✓ Payé'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* ── Détail missions terminées */}
      <h2 className="font-semibold mb-4" style={{ color: '#1A1A1A' }}>Détail missions terminées</h2>
      <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
        <div className="hidden md:grid grid-cols-5 px-5 py-3 text-xs font-semibold uppercase tracking-wide border-b" style={{ color: '#A8A09A', borderColor: '#F2EFE9', backgroundColor: '#FAFAF8' }}>
          <span className="col-span-2">Propriété</span>
          <span>Cleaner</span>
          <span>Prix client</span>
          <span>Gain cleaner</span>
        </div>
        {completedMissions.sort((a, b) => b.date.localeCompare(a.date)).map((m, i) => (
          <div key={m.id} className={`px-5 py-4 flex flex-col md:grid md:grid-cols-5 gap-1 md:gap-0 md:items-center ${i < completedMissions.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
            <div className="md:col-span-2">
              <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{m.property}</p>
              <p className="text-xs" style={{ color: '#A8A09A' }}>{m.date} · {m.duration}h</p>
            </div>
            <p className="text-sm" style={{ color: m.cleanerName ? '#1A1A1A' : '#A8A09A' }}>{m.cleanerName ?? '—'}</p>
            <p className="text-sm font-semibold" style={{ color: '#5A8A6A' }}>{m.price}€</p>
            <p className="text-sm font-semibold" style={{ color: m.cleanerGain ? '#C9A84C' : '#A8A09A' }}>{m.cleanerGain ? `${m.cleanerGain}€` : '—'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
