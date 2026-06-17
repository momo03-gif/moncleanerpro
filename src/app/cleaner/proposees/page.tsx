'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getPendingMissionsDB, acceptMissionDB } from '@/lib/db';
import type { Mission } from '@/lib/types';
import { formatDuration, formatHour } from '@/lib/format';

const typeLabel: Record<string, string> = {
  checkout: 'Check-out', checkin: 'Check-in',
  deep_clean: 'Grand ménage', regular: 'Régulier',
  menage: 'Ménage', grand_menage: 'Grand ménage',
};

export default function ProposedMissionsPage() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [declined, setDeclined] = useState<Set<string>>(new Set());
  const [accepting, setAccepting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const m = await getPendingMissionsDB();
    setMissions(m);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function accept(id: string) {
    if (!user) return;
    setAccepting(id);
    await acceptMissionDB(id, user.id);
    setAccepted(prev => new Set(prev).add(id));
    setAccepting(null);
    // Reload to remove this mission from the list
    await load();
  }

  function decline(id: string) {
    setDeclined(prev => new Set(prev).add(id));
  }

  const visible = missions.filter(m => !declined.has(m.id) && !accepted.has(m.id));

  if (loading) return <div className="p-5 pt-8 text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  return (
    <div className="p-5">
      <div className="mb-6 pt-2">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Missions proposées</h1>
        <p className="text-sm mt-1" style={{ color: '#9CA3AF' }}>{visible.length} disponible{visible.length > 1 ? 's' : ''}</p>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-2xl mb-3">✦</p>
          <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>Aucune mission disponible</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Revenez plus tard</p>
        </div>
      ) : (
        <div className="space-y-4">
          {visible.map(m => (
            <div key={m.id} className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold" style={{ color: '#1A1A1A' }}>{m.property}</h3>
                    <p className="text-sm mt-0.5" style={{ color: '#A8A09A' }}>{m.address}</p>
                  </div>
                  <span className="text-lg font-bold ml-4 shrink-0" style={{ color: '#C9A84C' }}>{m.cleanerGain ?? m.price}€</span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Date', value: m.date.split('-').slice(1).join('/') },
                    { label: 'Heure', value: m.time ? formatHour(m.time) : '—' },
                    { label: 'Durée', value: formatDuration(m.missionDurationMinutes ?? 0) },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: '#F8F6F2' }}>
                      <p className="text-xs" style={{ color: '#A8A09A' }}>{s.label}</p>
                      <p className="text-sm font-semibold mt-0.5" style={{ color: '#1A1A1A' }}>{s.value}</p>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>{typeLabel[m.type] ?? m.type}</span>
                  {m.requestedBy && (
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: '#C9A84C12', color: '#C9A84C' }}>{m.requestedBy}</span>
                  )}
                  {m.source && (
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: m.source === 'airbnb' ? '#C9A84C12' : '#F5F3EF', color: m.source === 'airbnb' ? '#C9A84C' : '#7A7068' }}>
                      {m.source === 'airbnb' ? 'Airbnb' : 'Hôtel'}
                    </span>
                  )}
                </div>

                {m.notes && (
                  <p className="text-xs px-3 py-2 rounded-xl mb-4" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>{m.notes}</p>
                )}

                <div className="flex gap-3">
                  <button onClick={() => decline(m.id)} className="flex-1 py-3 rounded-xl text-sm font-medium transition-all border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                    Refuser
                  </button>
                  <button onClick={() => accept(m.id)} disabled={accepting === m.id} className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
                    style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                    {accepting === m.id ? '...' : 'Accepter'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
