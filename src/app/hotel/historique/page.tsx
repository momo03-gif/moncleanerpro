'use client';

import { useAuth } from '@/contexts/AuthContext';
import { getAnnouncesForHotel } from '@/lib/mockData';
import { AnnounceStatus } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = {
  menage: 'Ménage',
  checkin: 'Check-in',
  checkout: 'Check-out',
  grand_menage: 'Grand ménage',
};

// Hôtel voit seulement 3 statuts
const HOTEL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:    { label: 'En attente',  color: '#C48A2A', bg: '#C48A2A12' },
  validated:  { label: 'Validée',     color: '#C9A84C', bg: '#C9A84C12' },
  refused:    { label: 'Refusée',     color: '#B85A50', bg: '#B85A5012' },
  in_progress:{ label: 'Validée',     color: '#C9A84C', bg: '#C9A84C12' },
  completed:  { label: 'Validée',     color: '#C9A84C', bg: '#C9A84C12' },
};

function formatTime(t: string) { return t; }

export default function HotelHistoriquePage() {
  const { user } = useAuth();
  if (!user) return null;

  const announces = getAnnouncesForHotel(user.name).sort((a, b) => b.date.localeCompare(a.date));
  const pendingCount = announces.filter(a => a.status === 'pending').length;
  const validatedCount = announces.filter(a => ['validated', 'in_progress', 'completed'].includes(a.status)).length;

  return (
    <div className="p-5">
      <div className="mb-6 pt-2">
        <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Mes annonces</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>{announces.length} annonce{announces.length > 1 ? 's' : ''}</p>
      </div>

      {/* Summary pills */}
      <div className="flex gap-2 mb-6">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#C48A2A12', color: '#C48A2A' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#C48A2A' }} />
          {pendingCount} en attente
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#C9A84C12', color: '#C9A84C' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#C9A84C' }} />
          {validatedCount} validée{validatedCount > 1 ? 's' : ''}
        </div>
      </div>

      {announces.length === 0 ? (
        <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune annonce pour l'instant</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announces.map(a => {
            const st = HOTEL_STATUS[a.status];
            return (
              <div key={a.id} className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
                {/* Top strip */}
                <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: '#F2EFE9' }}>
                  <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{TYPE_LABEL[a.type]}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ backgroundColor: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                </div>

                {/* Body */}
                <div className="px-5 py-4">
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <p className="text-xs mb-1" style={{ color: '#A8A09A' }}>Période</p>
                      <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                        {new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {a.dateEnd && a.dateEnd !== a.date && (
                          <> → {new Date(a.dateEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs mb-1" style={{ color: '#A8A09A' }}>Horaires</p>
                      <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{a.timeStart} – {a.timeEnd}</p>
                    </div>
                    <div>
                      <p className="text-xs mb-1" style={{ color: '#A8A09A' }}>Personnes</p>
                      <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{a.guestCount}</p>
                    </div>
                  </div>

                  {a.instructions && (
                    <p className="text-xs px-3 py-2 rounded-xl" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>
                      {a.instructions}
                    </p>
                  )}

                  {a.cleanerName && (
                    <p className="text-xs mt-2" style={{ color: '#A8A09A' }}>
                      Cleaner assigné : <span style={{ color: '#C9A84C', fontWeight: 600 }}>{a.cleanerName}</span>
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
