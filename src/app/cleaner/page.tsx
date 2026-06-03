'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMissionsForCleanerDB, updateMissionStatusDB } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { Mission, MissionStatus } from '@/lib/types';
import MapsModal from '@/components/MapsModal';

const TYPE_LABEL: Record<string, string> = {
  checkout: 'Check-out', checkin: 'Check-in', deep_clean: 'Grand ménage',
  regular: 'Ménage', menage: 'Ménage', grand_menage: 'Grand ménage',
};

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'Prévue',   color: '#C48A2A', bg: '#C48A2A15' },
  accepted:    { label: 'Prévue',   color: '#C9A84C', bg: '#C9A84C15' },
  in_progress: { label: 'En cours', color: '#8B7A62', bg: '#8B7A6215' },
  completed:   { label: 'Terminée', color: '#5A8A6A', bg: '#5A8A6A15' },
  cancelled:   { label: 'Annulée',  color: '#B85A50', bg: '#B85A5015' },
};

function formatDateLabel(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function shiftDate(d: string, n: number) {
  const date = new Date(d + 'T00:00:00');
  date.setDate(date.getDate() + n);
  return date.toISOString().split('T')[0];
}

function MissionCard({ mission, onUpdate }: { mission: Mission; onUpdate: () => void }) {
  const [mapsOpen, setMapsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const st = STATUS_CFG[mission.status] ?? STATUS_CFG.pending;
  const canStart  = mission.status === 'accepted' || mission.status === 'pending';
  const canFinish = mission.status === 'in_progress';

  async function act(status: MissionStatus) {
    setBusy(true);
    await updateMissionStatusDB(mission.id, status);
    onUpdate();
    setBusy(false);
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      {mapsOpen && mission.address && <MapsModal address={mission.address} onClose={() => setMapsOpen(false)} />}

      {/* Header */}
      <div className="px-5 py-4 border-b" style={{ borderColor: '#F2EFE9' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold" style={{ color: '#1A1A1A' }}>{mission.property || 'Mission'}</h3>
            {mission.address && (
              <button onClick={() => setMapsOpen(true)} className="flex items-center gap-1 mt-0.5 text-left transition-colors"
                style={{ color: '#A8A09A' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#C9A84C')}
                onMouseLeave={e => (e.currentTarget.style.color = '#A8A09A')}>
                <span className="text-xs shrink-0">◎</span>
                <span className="text-xs truncate max-w-[220px]">{mission.address}</span>
              </button>
            )}
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
            style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
        </div>
      </div>

      {/* Infos */}
      <div className="px-5 py-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {mission.time && (
            <div className="flex items-center gap-1.5">
              <span style={{ color: '#C9A84C' }}>◷</span>
              <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{mission.time}</span>
            </div>
          )}
          {mission.duration > 0 && (
            <div className="flex items-center gap-1.5">
              <span style={{ color: '#C9A84C' }}>⟳</span>
              <span className="text-sm" style={{ color: '#7A7068' }}>{mission.duration}h</span>
            </div>
          )}
          <span className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: mission.source === 'airbnb' ? '#C9A84C15' : '#F5F3EF', color: mission.source === 'airbnb' ? '#C9A84C' : '#7A7068' }}>
            {mission.source === 'airbnb' ? 'Airbnb' : 'Hôtel'}
          </span>
          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>
            {TYPE_LABEL[mission.type] ?? mission.type}
          </span>
          <span className="ml-auto text-base font-bold" style={{ color: '#1A1A1A' }}>
            {mission.cleanerGain ?? mission.price}€
          </span>
        </div>

        {mission.requestedBy && (
          <p className="text-xs" style={{ color: '#A8A09A' }}>
            Client : <span style={{ color: '#1A1A1A', fontWeight: 500 }}>{mission.requestedBy}</span>
          </p>
        )}

        {mission.notes && (
          <div className="px-3 py-2.5 rounded-xl" style={{ backgroundColor: '#F8F6F2' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#A8A09A' }}>Consignes</p>
            <p className="text-sm leading-snug" style={{ color: '#7A7068' }}>{mission.notes}</p>
          </div>
        )}
      </div>

      {/* Actions */}
      {(canStart || canFinish) && (
        <div className="px-5 pb-5">
          {canStart && (
            <button onClick={() => act('in_progress')} disabled={busy}
              className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
              style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
              {busy ? '...' : '▶  Démarrer la mission'}
            </button>
          )}
          {canFinish && (
            <button onClick={() => act('completed')} disabled={busy}
              className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
              style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>
              {busy ? '...' : '✓  Terminer la mission'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function CleanerDashboard() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const load = useCallback(async () => {
    if (!user) return;
    const m = await getMissionsForCleanerDB(user.id);
    setMissions(m);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase.channel('cleaner-missions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, user]);

  if (!user) return null;
  if (loading) return <div className="p-5 pt-8 text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  const isToday = selectedDate === today;
  const dayMissions = missions
    .filter(m => m.date === selectedDate && m.status !== 'cancelled')
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const dayGain = dayMissions.filter(m => m.status === 'completed').reduce((s, m) => s + (m.cleanerGain ?? 0), 0);

  return (
    <div className="p-5">
      {/* Greeting */}
      <div className="mb-5 pt-2">
        <p className="text-sm" style={{ color: '#A8A09A' }}>{greeting},</p>
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{user.name.split(' ')[0]} ✦</h1>
      </div>

      {/* Date navigator */}
      <div className="rounded-2xl border mb-5 overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <div className="flex items-center justify-between px-4 py-3.5">
          <button onClick={() => setSelectedDate(d => shiftDate(d, -1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-lg transition-all"
            style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>←</button>
          <div className="text-center">
            <p className="text-sm font-semibold capitalize" style={{ color: '#1A1A1A' }}>
              {formatDateLabel(selectedDate)}
            </p>
            {isToday && <p className="text-xs mt-0.5" style={{ color: '#C9A84C' }}>Aujourd'hui</p>}
          </div>
          <button onClick={() => setSelectedDate(d => shiftDate(d, 1))}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-lg transition-all"
            style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>→</button>
        </div>
        {!isToday && (
          <div className="px-4 pb-3">
            <button onClick={() => setSelectedDate(today)}
              className="w-full py-2 rounded-xl text-xs font-medium"
              style={{ backgroundColor: '#F8F6F2', color: '#C9A84C' }}>
              Revenir à aujourd'hui
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-2xl p-4" style={{ backgroundColor: '#C9A84C' }}>
          <p className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{dayMissions.length}</p>
          <p className="text-xs mt-1" style={{ color: '#7A6030' }}>
            Mission{dayMissions.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="rounded-2xl p-4 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{dayGain}€</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Gain terminé</p>
        </div>
      </div>

      {/* Missions */}
      {dayMissions.length === 0 ? (
        <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-2xl mb-3">📅</p>
          <p className="font-medium text-sm" style={{ color: '#1A1A1A' }}>Aucune mission prévue</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>pour cette date</p>
        </div>
      ) : (
        <div className="space-y-3">
          {dayMissions.map(m => <MissionCard key={m.id} mission={m} onUpdate={load} />)}
        </div>
      )}
    </div>
  );
}
