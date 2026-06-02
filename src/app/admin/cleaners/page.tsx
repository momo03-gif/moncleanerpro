import { USERS, MISSIONS } from '@/lib/mockData';

const statusLabel: Record<string, string> = {
  available: 'Disponible',
  busy: 'En mission',
  offline: 'Hors ligne',
};

const statusColor: Record<string, string> = {
  available: '#5A8A6A',
  busy: '#C48A2A',
  offline: '#A8A09A',
};

export default function CleanersPage() {
  const cleaners = USERS.filter(u => u.role === 'cleaner');

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Cleaners</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>{cleaners.length} cleaners enregistrés</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {cleaners.map(cleaner => {
          const missions = MISSIONS.filter(m => m.cleanerId === cleaner.id);
          const completed = missions.filter(m => m.status === 'completed').length;
          const upcoming = missions.filter(m => ['accepted', 'in_progress'].includes(m.status)).length;

          return (
            <div key={cleaner.id} className="rounded-2xl p-6 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
              <div className="flex items-start gap-4 mb-5">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>
                  {cleaner.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold" style={{ color: '#1A1A1A' }}>{cleaner.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${statusColor[cleaner.status!]}18`, color: statusColor[cleaner.status!] }}>
                      {statusLabel[cleaner.status!]}
                    </span>
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: '#A8A09A' }}>{cleaner.email}</p>
                  <p className="text-sm" style={{ color: '#A8A09A' }}>{cleaner.phone}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#F8F6F2' }}>
                  <p className="text-lg font-bold" style={{ color: '#C9A84C' }}>⭐ {cleaner.rating}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>Note</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#F8F6F2' }}>
                  <p className="text-lg font-bold" style={{ color: '#1A1A1A' }}>{completed}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>Terminées</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#F8F6F2' }}>
                  <p className="text-lg font-bold" style={{ color: '#1A1A1A' }}>{upcoming}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>À venir</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
