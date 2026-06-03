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
  pending:     { label: 'À assigner', color: '#6B7280', bg: '#6B728018' },
  accepted:    { label: 'En attente', color: '#C48A2A', bg: '#C48A2A15' },
  validated:   { label: 'Validée',    color: '#C9A84C', bg: '#C9A84C15' },
  in_progress: { label: 'En cours',   color: '#5B6EF5', bg: '#5B6EF518' },
  completed:   { label: 'Terminée',   color: '#5A8A6A', bg: '#5A8A6A15' },
  cancelled:   { label: 'Annulée',    color: '#B85A50', bg: '#B85A5015' },
};

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function getCalendarGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDow = first.getDay(); // 0=Sun
  const offset = startDow === 0 ? 6 : startDow - 1; // Monday-based
  const cells: (Date | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  return cells;
}

// ── Calendrier ────────────────────────────────────────────────────────────────

function MonthCalendar({
  selectedDate,
  missionDates,
  onSelect,
}: {
  selectedDate: string;
  missionDates: Set<string>;
  onSelect: (d: string) => void;
}) {
  const today = toDateStr(new Date());
  const [viewYear, setViewYear] = useState(() => new Date(selectedDate + 'T00:00:00').getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date(selectedDate + 'T00:00:00').getMonth());

  function prev() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function next() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  const cells = getCalendarGrid(viewYear, viewMonth);

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      {/* Header mois */}
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#F2EFE9' }}>
        <button onClick={prev} className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>←</button>
        <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
          {MONTHS_FR[viewMonth]} {viewYear}
        </span>
        <button onClick={next} className="w-8 h-8 flex items-center justify-center rounded-xl"
          style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>→</button>
      </div>

      {/* Jours de la semaine */}
      <div className="grid grid-cols-7 px-3 pt-3 pb-1">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="text-center">
            <span className="text-xs font-medium" style={{ color: '#A8A09A' }}>{d}</span>
          </div>
        ))}
      </div>

      {/* Grille jours */}
      <div className="grid grid-cols-7 px-3 pb-3 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = toDateStr(day);
          const isSelected = dateStr === selectedDate;
          const isToday = dateStr === today;
          const hasMission = missionDates.has(dateStr);

          return (
            <button key={i} onClick={() => onSelect(dateStr)}
              className="flex flex-col items-center justify-center h-9 rounded-xl transition-all relative"
              style={{
                backgroundColor: isSelected ? '#C9A84C' : isToday ? '#C9A84C18' : 'transparent',
                color: isSelected ? '#1A1A1A' : isToday ? '#C9A84C' : '#1A1A1A',
              }}>
              <span className="text-sm font-medium leading-none">{day.getDate()}</span>
              {hasMission && (
                <span className="w-1 h-1 rounded-full mt-0.5"
                  style={{ backgroundColor: isSelected ? '#1A1A1A' : '#C9A84C' }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Carte mission ─────────────────────────────────────────────────────────────

function MissionCard({ mission, onUpdate }: { mission: Mission; onUpdate: () => void }) {
  const [mapsOpen, setMapsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const st = STATUS_CFG[mission.status] ?? STATUS_CFG.pending;
  const canStart  = mission.status === 'accepted' || mission.status === 'validated' || mission.status === 'pending';
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
              <button onClick={() => setMapsOpen(true)}
                className="flex items-center gap-1 mt-0.5 text-left transition-colors"
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

// ── Dashboard cleaner ─────────────────────────────────────────────────────────

export default function CleanerDashboard() {
  const { user } = useAuth();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const today = toDateStr(new Date());
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

  // Dates qui ont au moins une mission non annulée
  const missionDates = new Set(missions.filter(m => m.status !== 'cancelled').map(m => m.date));

  const dayMissions = missions
    .filter(m => m.date === selectedDate && m.status !== 'cancelled')
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));

  const dayGain = dayMissions.filter(m => m.status === 'completed').reduce((s, m) => s + (m.cleanerGain ?? 0), 0);
  const isToday = selectedDate === today;

  return (
    <div className="p-5">
      {/* Greeting */}
      <div className="mb-5 pt-2">
        <p className="text-sm" style={{ color: '#A8A09A' }}>{greeting},</p>
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{user.name.split(' ')[0]} ✦</h1>
      </div>

      {/* Calendrier mensuel */}
      <div className="mb-5">
        <MonthCalendar
          selectedDate={selectedDate}
          missionDates={missionDates}
          onSelect={setSelectedDate}
        />
        {!isToday && (
          <button onClick={() => setSelectedDate(today)} className="w-full mt-2 py-2 rounded-xl text-xs font-medium"
            style={{ backgroundColor: '#F8F6F2', color: '#C9A84C' }}>
            Revenir à aujourd'hui
          </button>
        )}
      </div>

      {/* Stats du jour */}
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

      {/* Missions du jour sélectionné */}
      <h2 className="font-semibold mb-3" style={{ color: '#1A1A1A' }}>
        {isToday ? "Missions d'aujourd'hui" : `Missions du ${new Date(selectedDate + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`}
      </h2>

      {dayMissions.length === 0 ? (
        <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-xl mb-3">📅</p>
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
