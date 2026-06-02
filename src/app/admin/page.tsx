import { MISSIONS, USERS, FINANCIAL } from '@/lib/mockData';
import Link from 'next/link';

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl p-5 border" style={{ backgroundColor: accent ? '#C9A84C' : '#FFFFFF', borderColor: accent ? '#C9A84C' : '#E8E4DC' }}>
      <p className="text-xs font-medium mb-3" style={{ color: accent ? '#7A6030' : '#A8A09A' }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color: '#1A1A1A' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: accent ? '#7A6030' : '#A8A09A' }}>{sub}</p>}
    </div>
  );
}

export default function AdminDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const todayMissions = MISSIONS.filter(m => m.date === today);
  const pendingMissions = MISSIONS.filter(m => m.status === 'pending');
  const cleaners = USERS.filter(u => u.role === 'cleaner');
  const totalRevenue = FINANCIAL.filter(f => f.type === 'income').reduce((s, f) => s + f.amount, 0);

  const recentMissions = [...MISSIONS].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const statusLabel: Record<string, string> = {
    pending: 'En attente',
    accepted: 'Acceptée',
    in_progress: 'En cours',
    completed: 'Terminée',
    cancelled: 'Annulée',
  };

  const statusColor: Record<string, string> = {
    pending: '#C48A2A',
    accepted: '#C9A84C',
    in_progress: '#8B7A62',
    completed: '#5A8A6A',
    cancelled: '#B85A50',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Tableau de bord</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Missions aujourd'hui" value={todayMissions.length} sub={`${todayMissions.filter(m => m.status === 'accepted').length} acceptées`} accent />
        <StatCard label="En attente" value={pendingMissions.length} sub="à assigner" />
        <StatCard label="Cleaners actifs" value={cleaners.filter(c => c.status !== 'offline').length} sub={`sur ${cleaners.length} total`} />
        <StatCard label="Revenus du mois" value={`${totalRevenue}€`} sub="ce mois" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent missions */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: '#1A1A1A' }}>Missions récentes</h2>
            <Link href="/admin/missions" className="text-sm" style={{ color: '#C9A84C' }}>Voir tout →</Link>
          </div>
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
            {recentMissions.map((m, i) => (
              <div key={m.id} className={`px-5 py-4 flex items-center gap-4 ${i < recentMissions.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{m.property}</p>
                  <p className="text-xs truncate" style={{ color: '#A8A09A' }}>{m.date} · {m.time} · {m.duration}h</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{m.price}€</span>
                  <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: `${statusColor[m.status]}18`, color: statusColor[m.status] }}>
                    {statusLabel[m.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cleaners */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: '#1A1A1A' }}>Cleaners</h2>
            <Link href="/admin/cleaners" className="text-sm" style={{ color: '#C9A84C' }}>Voir tout →</Link>
          </div>
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
            {cleaners.map((c, i) => (
              <div key={c.id} className={`px-5 py-4 flex items-center gap-3 ${i < cleaners.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{c.name}</p>
                  <p className="text-xs" style={{ color: '#A8A09A' }}>⭐ {c.rating} · {c.completedMissions} missions</p>
                </div>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.status === 'available' ? '#5A8A6A' : c.status === 'busy' ? '#C48A2A' : '#A8A09A' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
