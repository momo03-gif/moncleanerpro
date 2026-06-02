import { MISSIONS, USERS } from '@/lib/mockData';

export default function StatsPage() {
  const total = MISSIONS.length;
  const completed = MISSIONS.filter(m => m.status === 'completed').length;
  const pending = MISSIONS.filter(m => m.status === 'pending').length;
  const revenue = MISSIONS.filter(m => m.status === 'completed').reduce((s, m) => s + m.price, 0);
  const avgPrice = total > 0 ? Math.round(MISSIONS.reduce((s, m) => s + m.price, 0) / total) : 0;
  const cleaners = USERS.filter(u => u.role === 'cleaner');

  const byType: Record<string, number> = {};
  MISSIONS.forEach(m => { byType[m.type] = (byType[m.type] ?? 0) + 1; });

  const typeLabel: Record<string, string> = {
    checkout: 'Check-out',
    checkin: 'Check-in',
    deep_clean: 'Grand ménage',
    regular: 'Régulier',
  };

  const topCleaner = cleaners.reduce((best, c) => {
    const count = MISSIONS.filter(m => m.cleanerId === c.id && m.status === 'completed').length;
    const bestCount = MISSIONS.filter(m => m.cleanerId === best.id && m.status === 'completed').length;
    return count > bestCount ? c : best;
  }, cleaners[0]);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Statistiques</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Vue d'ensemble des performances</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total missions', value: total, icon: '◎' },
          { label: 'Taux de completion', value: `${Math.round((completed / total) * 100)}%`, icon: '◈' },
          { label: 'Revenus générés', value: `${revenue}€`, icon: '◇', accent: true },
          { label: 'Prix moyen', value: `${avgPrice}€`, icon: '◉' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl p-5 border" style={{ backgroundColor: kpi.accent ? '#C9A84C' : '#FFFFFF', borderColor: kpi.accent ? '#C9A84C' : '#E8E4DC' }}>
            <span className="text-2xl mb-3 block" style={{ color: kpi.accent ? '#7A6030' : '#C9A84C' }}>{kpi.icon}</span>
            <p className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{kpi.value}</p>
            <p className="text-xs mt-1" style={{ color: kpi.accent ? '#7A6030' : '#A8A09A' }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* By type */}
        <div className="rounded-2xl p-6 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <h2 className="font-semibold mb-5" style={{ color: '#1A1A1A' }}>Répartition par type</h2>
          <div className="space-y-4">
            {Object.entries(byType).map(([type, count]) => (
              <div key={type}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm" style={{ color: '#7A7068' }}>{typeLabel[type]}</span>
                  <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{count}</span>
                </div>
                <div className="h-1.5 rounded-full" style={{ backgroundColor: '#F2EFE9' }}>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: '#C9A84C', width: `${(count / total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top performer + mission status */}
        <div className="space-y-4">
          {topCleaner && (
            <div className="rounded-2xl p-6 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
              <h2 className="font-semibold mb-4" style={{ color: '#1A1A1A' }}>Meilleur cleaner</h2>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>
                  {topCleaner.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold" style={{ color: '#1A1A1A' }}>{topCleaner.name}</p>
                  <p className="text-sm" style={{ color: '#A8A09A' }}>
                    ⭐ {topCleaner.rating} · {MISSIONS.filter(m => m.cleanerId === topCleaner.id && m.status === 'completed').length} missions terminées
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl p-6 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
            <h2 className="font-semibold mb-4" style={{ color: '#1A1A1A' }}>Statuts</h2>
            <div className="space-y-3">
              {[
                { label: 'Terminées', count: completed, color: '#5A8A6A' },
                { label: 'En attente', count: pending, color: '#C48A2A' },
                { label: 'Acceptées', count: MISSIONS.filter(m => m.status === 'accepted').length, color: '#C9A84C' },
                { label: 'Annulées', count: MISSIONS.filter(m => m.status === 'cancelled').length, color: '#B85A50' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-sm" style={{ color: '#7A7068' }}>{s.label}</span>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
