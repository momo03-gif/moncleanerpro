'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getMissionsForCleanerDB, startMissionDB, finishMissionDB, requestExtraTimeDB, withdrawMissionDB } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { Mission } from '@/lib/types';
import { sortMissionsByPriority } from '@/lib/missionOrder';
import { serviceLabel, SERVICE_BADGE, serviceParts } from '@/lib/service';
import { formatDuration, formatHour } from '@/lib/format';
import { getApproxPosition } from '@/lib/geo';
import MapsModal from '@/components/MapsModal';
import MissionPhotos from '@/components/MissionPhotos';
import Icon from '@/components/Icon';

// Incréments proposés pour une demande de temps supplémentaire (minutes).
const EXTRA_TIME_OPTIONS = [15, 30, 45, 60];

const TYPE_LABEL: Record<string, string> = {
  checkout: 'Check-out', checkin: 'Check-in', deep_clean: 'Grand ménage',
  regular: 'Ménage', menage: 'Ménage', grand_menage: 'Grand ménage',
};

function parseMissionNotes(notes: string | undefined | null) {
  if (!notes) return { portalCode: null, keyboxCode: null, extra: '' };
  let text = notes;
  let portalCode: string | null = null;
  let keyboxCode: string | null = null;
  const pm = text.match(/Code portail\s*:\s*([^·]+)/);
  if (pm) { portalCode = pm[1].trim(); text = text.replace(pm[0], ''); }
  const km = text.match(/Boîte à clé\s*:\s*([^·]+)/);
  if (km) { keyboxCode = km[1].trim(); text = text.replace(km[0], ''); }
  return { portalCode, keyboxCode, extra: text.replace(/·/g, '').trim() };
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'À assigner', color: '#6B7280', bg: '#6B728018' },
  accepted:    { label: 'En attente', color: '#C48A2A', bg: '#C48A2A15' },
  validated:   { label: 'Validée',    color: '#C9A84C', bg: '#C9A84C15' },
  in_progress: { label: 'En cours',   color: '#5B6EF5', bg: '#5B6EF518' },
  completed:   { label: 'Terminée',   color: '#5A8A6A', bg: '#5A8A6A15' },
  cancelled:   { label: 'Annulée',    color: '#B85A50', bg: '#B85A5015' },
};

function toDateStr(d: Date) {
  return d.toISOString().split('T')[0];
}

function formatDateFR(d: string) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

function getWeekBounds() {
  const d = new Date();
  const day = d.getDay();
  const start = new Date(d);
  start.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toDateStr(start), end: toDateStr(end) };
}

// ── Carte mission ─────────────────────────────────────────────────────────────

function MissionCard({ mission, userId, onUpdate }: { mission: Mission; userId: string; onUpdate: () => void }) {
  const [mapsOpen, setMapsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraMinutes, setExtraMinutes] = useState(30);
  const [extraReason, setExtraReason] = useState('');
  const [extraError, setExtraError] = useState('');
  const [geoError, setGeoError] = useState('');
  const st = STATUS_CFG[mission.status] ?? STATUS_CFG.pending;
  const canStart  = mission.status === 'accepted' || mission.status === 'validated' || mission.status === 'pending';
  const canFinish = mission.status === 'in_progress';
  const { portalCode, keyboxCode, extra } = parseMissionNotes(mission.notes);
  const notesIsLong = extra.length > 120;

  // Pointage : on capture une position approximative (best-effort) au démarrage
  // et à la fin. Le cleaner ne voit ni chrono ni durée réelle.
  async function start() {
    setBusy(true); setGeoError('');
    const pos = await getApproxPosition();
    const res = await startMissionDB(mission.id, userId, pos);
    setBusy(false);
    if (res.error) { setGeoError(res.error); return; }
    onUpdate();
  }

  async function finish() {
    setBusy(true); setGeoError('');
    const pos = await getApproxPosition();
    const res = await finishMissionDB(mission.id, userId, pos);
    setBusy(false);
    if (res.error) { setGeoError(res.error); return; }
    onUpdate();
  }

  async function withdraw() {
    if (!confirm('Se désister de cette mission ? Elle sera annulée et l’administrateur en sera informé.')) return;
    setBusy(true); setGeoError('');
    const res = await withdrawMissionDB(mission.id, userId);
    setBusy(false);
    if (res.error) { setGeoError(res.error); return; }
    onUpdate();
  }

  async function submitExtra() {
    setBusy(true); setExtraError('');
    const res = await requestExtraTimeDB({ missionId: mission.id, minutes: extraMinutes, reason: extraReason, userId });
    setBusy(false);
    if (res.error) { setExtraError(res.error); return; }
    setExtraOpen(false); setExtraReason('');
    onUpdate();
  }

  const extraStatus = mission.extraTimeStatus;

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      {mapsOpen && mission.address && <MapsModal address={mission.address} onClose={() => setMapsOpen(false)} />}

      {/* Header */}
      <div className="px-5 py-4 border-b" style={{ borderColor: '#F2EFE9' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>
              {new Date(mission.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
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
        {mission.nextArrival && (
          mission.nextArrival === mission.date ? (
            <div className="px-3 py-2.5 rounded-xl text-sm font-bold" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
              Arrivée client le jour même{mission.nextArrivalTime ? ` à ${formatHour(mission.nextArrivalTime)}` : ''} — terminer à temps
            </div>
          ) : (
            <p className="text-xs" style={{ color: '#7A7068' }}>
              Prochaine arrivée : {new Date(mission.nextArrival + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}{mission.nextArrivalTime ? ` à ${formatHour(mission.nextArrivalTime)}` : ''}
            </p>
          )
        )}
        <div className="flex flex-wrap items-center gap-3">
          {mission.time && (
            <div className="flex items-center gap-1.5">
              <span style={{ color: '#C9A84C' }}>◷</span>
              <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{formatHour(mission.time)}</span>
            </div>
          )}
          {(mission.missionDurationMinutes ?? 0) > 0 && (
            <div className="flex items-center gap-1.5">
              <span style={{ color: '#C9A84C' }}>⟳</span>
              <span className="text-sm" style={{ color: '#7A7068' }}>{formatDuration(mission.missionDurationMinutes)}</span>
            </div>
          )}
          <span className="text-xs px-2 py-0.5 rounded"
            style={{ backgroundColor: mission.source === 'airbnb' ? '#C9A84C15' : '#F5F3EF', color: mission.source === 'airbnb' ? '#C9A84C' : '#7A7068' }}>
            {mission.source === 'airbnb' ? 'Airbnb' : 'Hôtel'}
          </span>
          {/* Prestation à réaliser — toujours visible et explicite pour le cleaner. */}
          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded font-semibold"
            style={{ backgroundColor: SERVICE_BADGE[mission.service ?? 'cleaning'].bg, color: SERVICE_BADGE[mission.service ?? 'cleaning'].color }}>
            {serviceParts(mission.service).delivery && <Icon name="delivery" size={12} />}
            {serviceLabel(mission.service)}
          </span>
          {/* Type de ménage : pertinent uniquement si la prestation inclut le nettoyage. */}
          {serviceParts(mission.service).cleaning && (
            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>
              {TYPE_LABEL[mission.type] ?? mission.type}
            </span>
          )}
        </div>

        {mission.requestedBy && (
          <p className="text-xs" style={{ color: '#A8A09A' }}>
            Client : <span style={{ color: '#1A1A1A', fontWeight: 500 }}>{mission.requestedBy}</span>
          </p>
        )}

        {(portalCode || keyboxCode || extra) && (
          <>
            {(portalCode || keyboxCode) && (
              <div className="flex flex-wrap gap-2">
                {portalCode && (
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold"
                    style={{ backgroundColor: '#C9A84C20', color: '#C48A2A' }}>
                    <span className="font-sans font-normal" style={{ color: '#A8A09A' }}>Portail</span>
                    {portalCode}
                  </span>
                )}
                {keyboxCode && (
                  <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold"
                    style={{ backgroundColor: '#5B6EF518', color: '#5B6EF5' }}>
                    <span className="font-sans font-normal" style={{ color: '#A8A09A' }}>Clé</span>
                    {keyboxCode}
                  </span>
                )}
              </div>
            )}
            {extra && (
              <div className="px-3 py-2.5 rounded-xl" style={{ backgroundColor: '#F8F6F2' }}>
                <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: '#A8A09A' }}>Consignes</p>
                <p className="text-sm leading-snug" style={{
                  color: '#7A7068',
                  ...(notesIsLong && !notesOpen ? {
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                  } : {}),
                }}>
                  {extra}
                </p>
                {notesIsLong && (
                  <button onClick={() => setNotesOpen(o => !o)}
                    className="mt-1.5 text-xs font-medium"
                    style={{ color: '#C9A84C' }}>
                    {notesOpen ? 'Voir moins ↑' : 'Voir plus ↓'}
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {/* Consignes de livraison — affichées quand la mission inclut une livraison. */}
        {serviceParts(mission.service).delivery && mission.deliveryInstructions && (
          <div className="px-3 py-2.5 rounded-xl" style={{ backgroundColor: '#C48A2A12' }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1 flex items-center gap-1.5" style={{ color: '#C48A2A' }}>
              <Icon name="delivery" size={14} /> Livraison
            </p>
            <p className="text-sm leading-snug" style={{ color: '#7A7068' }}>{mission.deliveryInstructions}</p>
          </div>
        )}
      </div>

      {/* Photos avant/après + demande de temps supplémentaire */}
      {mission.status !== 'cancelled' && (
        <div className="px-5 pb-4 space-y-3">
          <MissionPhotos missionId={mission.id} mode="cleaner" userId={userId} />

          {/* Temps supplémentaire : utile si l'appartement est très sale (photos avant). */}
          {extraStatus === 'pending' ? (
            <div className="px-3 py-2.5 rounded-xl text-xs" style={{ backgroundColor: '#C9A84C15', color: '#C48A2A' }}>
              Demande de +{mission.extraTimeMinutes} min envoyée — en attente de validation.
            </div>
          ) : extraStatus === 'approved' ? (
            <div className="px-3 py-2.5 rounded-xl text-xs font-medium" style={{ backgroundColor: '#5A8A6A15', color: '#5A8A6A' }}>
              Temps supplémentaire accordé (+{mission.extraTimeMinutes} min).
            </div>
          ) : extraStatus === 'refused' ? (
            <div className="px-3 py-2.5 rounded-xl text-xs" style={{ backgroundColor: '#B85A5012', color: '#B85A50' }}>
              Demande de temps supplémentaire refusée.
            </div>
          ) : !extraOpen ? (
            <button onClick={() => setExtraOpen(true)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold border"
              style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
              ⏱ Demander plus de temps
            </button>
          ) : (
            <div className="rounded-xl p-3 space-y-2.5" style={{ backgroundColor: '#F8F6F2' }}>
              <p className="text-[11px]" style={{ color: '#7A7068' }}>
                Appartement très sale ? Ajoutez des photos « avant » et demandez du temps en plus.
              </p>
              <div className="flex gap-1.5">
                {EXTRA_TIME_OPTIONS.map(opt => (
                  <button key={opt} onClick={() => setExtraMinutes(opt)}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                    style={{ backgroundColor: extraMinutes === opt ? '#C9A84C' : '#FFFFFF', color: extraMinutes === opt ? '#1A1A1A' : '#7A7068', border: '1px solid #E8E4DC' }}>
                    +{opt}
                  </button>
                ))}
              </div>
              <input value={extraReason} onChange={e => setExtraReason(e.target.value)}
                placeholder="Motif (facultatif)"
                className="w-full px-3 py-2 rounded-lg text-sm border"
                style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF', color: '#1A1A1A', outline: 'none' }} />
              {extraError && <p className="text-[11px]" style={{ color: '#B85A50' }}>{extraError}</p>}
              <div className="flex gap-2">
                <button onClick={submitExtra} disabled={busy}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                  style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                  {busy ? '...' : `Demander +${extraMinutes} min`}
                </button>
                <button onClick={() => { setExtraOpen(false); setExtraError(''); }} disabled={busy}
                  className="px-4 py-2.5 rounded-xl text-xs border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {(canStart || canFinish) && (
        <div className="px-5 pb-5 space-y-2">
          {geoError && (
            <p className="text-xs px-3 py-2.5 rounded-xl" style={{ backgroundColor: '#B85A5012', color: '#B85A50' }}>{geoError}</p>
          )}
          {canStart && (
            <button onClick={start} disabled={busy}
              className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
              style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
              {busy ? '...' : 'Démarrer la mission'}
            </button>
          )}
          {canFinish && (
            <button onClick={finish} disabled={busy}
              className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
              style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>
              {busy ? '...' : '✓  Terminer la mission'}
            </button>
          )}
          <button onClick={withdraw} disabled={busy}
            className="w-full py-2 rounded-xl text-xs font-medium disabled:opacity-50 transition-all"
            style={{ color: '#B85A50' }}>
            Se désister
          </button>
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
  const [dateStart, setDateStart] = useState(today);
  const [dateEnd, setDateEnd] = useState(today);
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

  const isToday = dateStart === today && dateEnd === today;
  const isSingleDay = dateStart === dateEnd;
  const tomorrow = toDateStr(new Date(Date.now() + 86400000));
  const { start: weekStart, end: weekEnd } = getWeekBounds();

  const filteredMissions = sortMissionsByPriority(
    missions.filter(m => m.date >= dateStart && m.date <= dateEnd && m.status !== 'cancelled')
  );

  const completedCount = filteredMissions.filter(m => m.status === 'completed').length;

  function getPeriodLabel() {
    if (isToday) return "Missions d'aujourd'hui";
    if (isSingleDay) return `Missions du ${formatDateFR(dateStart)}`;
    return `Missions du ${formatDateFR(dateStart)} au ${formatDateFR(dateEnd)}`;
  }

  // Bornes "Toutes" : de la 1re à la dernière mission du cleaner
  const allDates = missions.map(m => m.date).filter(Boolean).sort();
  const allStart = allDates[0] ?? today;
  const allEnd = allDates[allDates.length - 1] ?? today;

  const quickFilters = [
    { label: "Auj.", start: today, end: today },
    { label: 'Demain', start: tomorrow, end: tomorrow },
    { label: 'Semaine', start: weekStart, end: weekEnd },
    { label: 'Toutes', start: allStart, end: allEnd },
  ];

  // Missions hors période (info quand la vue courante est vide)
  const outOfRangeCount = missions.filter(m => m.status !== 'cancelled' && (m.date < dateStart || m.date > dateEnd)).length;

  return (
    <div className="p-5">
      {/* Greeting */}
      <div className="mb-5 pt-2">
        <p className="text-sm" style={{ color: '#A8A09A' }}>{greeting},</p>
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{user.name.split(' ')[0]}</h1>
      </div>

      {/* Filtre par date */}
      <div className="rounded-2xl border p-4 mb-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Période</p>

        {/* Raccourcis */}
        <div className="flex gap-2 mb-3">
          {quickFilters.map(opt => {
            const isActive = dateStart === opt.start && dateEnd === opt.end;
            return (
              <button key={opt.label}
                onClick={() => { setDateStart(opt.start); setDateEnd(opt.end); }}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  backgroundColor: isActive ? '#C9A84C' : '#F5F3EF',
                  color: isActive ? '#1A1A1A' : '#7A7068',
                }}>
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Champs date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Du</label>
            <input
              type="date"
              value={dateStart}
              onChange={e => {
                setDateStart(e.target.value);
                if (e.target.value > dateEnd) setDateEnd(e.target.value);
              }}
              className="w-full px-3 py-2.5 rounded-xl text-sm border"
              style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8', color: '#1A1A1A', outline: 'none' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Au</label>
            <input
              type="date"
              value={dateEnd}
              min={dateStart}
              onChange={e => setDateEnd(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm border"
              style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8', color: '#1A1A1A', outline: 'none' }}
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-2xl p-4" style={{ backgroundColor: '#C9A84C' }}>
          <p className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{filteredMissions.length}</p>
          <p className="text-xs mt-1" style={{ color: '#7A6030' }}>
            Mission{filteredMissions.length > 1 ? 's' : ''}
          </p>
        </div>
        <div className="rounded-2xl p-4 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{completedCount}</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Terminée{completedCount > 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Liste missions */}
      <h2 className="font-semibold mb-3" style={{ color: '#1A1A1A' }}>{getPeriodLabel()}</h2>

      {filteredMissions.length === 0 ? (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <span className="mb-3" style={{ color: '#D4CEC4' }}><Icon name="today" size={30} /></span>
          <p className="font-medium text-sm" style={{ color: '#1A1A1A' }}>Aucune mission prévue</p>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>pour cette période</p>
          {outOfRangeCount > 0 && (
            <button onClick={() => { setDateStart(allStart); setDateEnd(allEnd); }}
              className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
              Voir mes {outOfRangeCount} mission{outOfRangeCount > 1 ? 's' : ''} sur d'autres dates →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMissions.map(m => <MissionCard key={m.id} mission={m} userId={user.id} onUpdate={load} />)}
        </div>
      )}
    </div>
  );
}
