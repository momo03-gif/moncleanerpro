'use client';

import { useAuth } from '@/contexts/AuthContext';
import { getMissionsForCleaner, USERS, currentMonth } from '@/lib/mockData';

export default function CleanerProfil() {
  const { user } = useAuth();
  if (!user) return null;

  const fullUser = USERS.find(u => u.id === user.id);
  const missions = getMissionsForCleaner(user.id);
  const completed = missions.filter(m => m.status === 'completed');
  const month = currentMonth();
  const hotelHoursMonth = completed
    .filter(m => m.source === 'hotel' && m.date.startsWith(month))
    .reduce((s, m) => s + m.duration, 0);
  const completedMonth = completed.filter(m => m.date.startsWith(month)).length;
  const totalEarned = completed.reduce((s, m) => s + (m.cleanerGain ?? 0), 0);

  return (
    <div className="p-5">
      <div className="mb-6 pt-2">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Mon profil</h1>
      </div>

      {/* Avatar + info */}
      <div className="rounded-2xl p-6 border mb-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <div className="flex items-center gap-4 mb-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>
            {user.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#1A1A1A' }}>{user.name}</h2>
            <p className="text-sm" style={{ color: '#A8A09A' }}>{user.email}</p>
            {fullUser?.phone && <p className="text-sm" style={{ color: '#A8A09A' }}>{fullUser.phone}</p>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Heures hôtel', value: `${hotelHoursMonth}h`, gold: true, sub: 'ce mois' },
            { label: 'Missions', value: completedMonth, sub: 'ce mois' },
            { label: 'Gains', value: `${totalEarned}€`, sub: 'total' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center" style={{ backgroundColor: '#F8F6F2' }}>
              <p className="text-xl font-bold" style={{ color: s.gold ? '#C9A84C' : '#1A1A1A' }}>{s.value}</p>
              <p className="text-xs mt-0.5" style={{ color: '#1A1A1A' }}>{s.label}</p>
              <p className="text-xs" style={{ color: '#A8A09A' }}>{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Status */}
      <div className="rounded-2xl p-5 border mb-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <h3 className="font-semibold mb-4" style={{ color: '#1A1A1A' }}>Disponibilité</h3>
        <div className="flex gap-3">
          {[
            { label: 'Disponible', value: 'available', color: '#5A8A6A' },
            { label: 'En mission', value: 'busy', color: '#C48A2A' },
            { label: 'Hors ligne', value: 'offline', color: '#A8A09A' },
          ].map(s => (
            <div
              key={s.value}
              className="flex-1 rounded-xl p-3 text-center border-2 transition-all"
              style={{
                borderColor: fullUser?.status === s.value ? s.color : '#E8E4DC',
                backgroundColor: fullUser?.status === s.value ? `${s.color}12` : 'transparent',
              }}
            >
              <span className="w-2 h-2 rounded-full mx-auto block mb-2" style={{ backgroundColor: s.color }} />
              <p className="text-xs font-medium" style={{ color: fullUser?.status === s.value ? s.color : '#A8A09A' }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent missions */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
        <div className="px-5 py-4 border-b" style={{ borderColor: '#F2EFE9' }}>
          <h3 className="font-semibold" style={{ color: '#1A1A1A' }}>Historique récent</h3>
        </div>
        {missions.length === 0 ? (
          <div className="px-5 py-6 text-center text-sm" style={{ color: '#A8A09A' }}>Aucune mission</div>
        ) : (
          missions.slice(0, 5).map((m, i) => (
            <div key={m.id} className={`px-5 py-4 flex items-center gap-3 ${i < Math.min(missions.length, 5) - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: m.status === 'completed' ? '#5A8A6A15' : '#C9A84C12' }}>
                <span className="text-xs" style={{ color: m.status === 'completed' ? '#5A8A6A' : '#C9A84C' }}>✦</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{m.property}</p>
                <p className="text-xs" style={{ color: '#A8A09A' }}>{m.date} · {m.time}</p>
              </div>
              <span className="text-sm font-semibold shrink-0" style={{ color: '#1A1A1A' }}>{m.price}€</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
