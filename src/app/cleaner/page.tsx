'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMissionsForCleanerDB } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { Mission } from '@/lib/types';

const TYPE_LABEL: Record<string, string> = { checkout: 'Check-out', checkin: 'Check-in', deep_clean: 'Grand ménage', regular: 'Régulier', menage: 'Ménage', grand_menage: 'Grand ménage' };
const STATUS_COLOR: Record<string, string> = { accepted: '#C9A84C', in_progress: '#8B7A62', completed: '#5A8A6A' };

function MissionCard({ mission }: { mission: Mission }) {
  const today = new Date().toISOString().split('T')[0];
  const st = STATUS_COLOR[mission.status] ?? '#A8A09A';
  const stLabel = mission.status === 'accepted' ? 'Acceptée' : mission.status === 'in_progress' ? 'En cours' : 'Terminée';

  return (
    <div className="rounded-2xl p-5 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold truncate" style={{ color: '#1A1A1A' }}>{mission.property}</h3>
          <p className="text-sm mt-0.5 truncate" style={{ color: '#A8A09A' }}>{mission.address}</p>
        </div>
        <span className="text-xs px-2 py-1 rounded-lg ml-3 shrink-0" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>{TYPE_LABEL[mission.type]}</span>
      </div>
      <div className="flex items-center gap-4 mt-4">
        <div className="flex items-center gap-1.5"><span style={{ color: '#C9A84C' }}>◷</span><span className="text-sm" style={{ color: '#7A7068' }}>{mission.time}</span></div>
        <div className="flex items-center gap-1.5"><span style={{ color: '#C9A84C' }}>⟳</span><span className="text-sm" style={{ color: '#7A7068' }}>{mission.duration}h</span></div>
        <div className="ml-auto"><span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{mission.cleanerGain ?? mission.price}€</span></div>
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t" style={{ borderColor: '#F2EFE9' }}>
        <span className="text-sm" style={{ color: '#A8A09A' }}>{mission.date === today ? "Aujourd'hui" : mission.date}</span>
        <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: `${st}18`, color: st }}>{stLabel}</span>
      </div>
    </div>
  );
}

export default function CleanerDashboard() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const load = useCallback(async () => {
    if (!user) return;
    const m = await getMissionsForCleanerDB(user.id);
    setMissions(m); setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase.channel('cleaner-missions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions', filter: `cleaner_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, user]);

  if (!user) return null;

  const todayMissions = missions.filter(m => m.date === today && ['accepted', 'in_progress'].includes(m.status));
  const upcoming = missions.filter(m => m.date > today && ['accepted', 'in_progress'].includes(m.status));
  const todayGain = todayMissions.reduce((s, m) => s + (m.cleanerGain ?? 0), 0);

  if (loading) return <div className="p-5 pt-8 text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  return (
    <div className="p-5">
      <div className="mb-6 pt-2">
        <p className="text-sm" style={{ color: '#A8A09A' }}>{greeting},</p>
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{user.name.split(' ')[0]} ✦</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-2xl p-4" style={{ backgroundColor: '#C9A84C' }}>
          <p className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{todayMissions.length}</p>
          <p className="text-xs mt-1" style={{ color: '#7A6030' }}>Mission{todayMissions.length > 1 ? 's' : ''} aujourd'hui</p>
        </div>
        <div className="rounded-2xl p-4 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{todayGain}€</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Gain du jour</p>
        </div>
      </div>

      <h2 className="font-semibold mb-3" style={{ color: '#1A1A1A' }}>Missions du jour</h2>
      {todayMissions.length === 0 ? (
        <div className="rounded-2xl p-8 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune mission aujourd'hui</p>
        </div>
      ) : (
        <div className="space-y-3 mb-6">{todayMissions.map(m => <MissionCard key={m.id} mission={m} />)}</div>
      )}

      {upcoming.length > 0 && (
        <>
          <h2 className="font-semibold mb-3 mt-6" style={{ color: '#1A1A1A' }}>À venir</h2>
          <div className="space-y-3">{upcoming.map(m => <MissionCard key={m.id} mission={m} />)}</div>
        </>
      )}
    </div>
  );
}
