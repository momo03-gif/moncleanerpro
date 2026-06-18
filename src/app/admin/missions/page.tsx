'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getMissionsDB, getHotelRequestsDB, getActiveCleanersDB,
  createMissionDB, createMissionsBatchDB, validateRequestDB, refuseRequestDB,
  getApprovedHotelsDB, getAirbnbs,
  updateMissionStatusDB, assignCleanerToMissionDB, assignCleanerToMissionsDB,
  updateMissionDB, deleteMissionDB, isMissionLocked,
} from '@/lib/db';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Mission, HotelAnnounce, MissionType, MissionSource, Apartment, MissionStatus } from '@/lib/types';
import { computeCleanerGain, DURATION_PRESETS } from '@/lib/pay';
import { groupMissionsByCleaner } from '@/lib/missionOrder';
import { formatDuration, formatHour, DEPARTURE_TIMES, ARRIVAL_TIMES } from '@/lib/format';
import { inputStyle } from '@/lib/ui';
import MapsModal from '@/components/MapsModal';
import DateRangeFilter from '@/components/DateRangeFilter';
import { presetRange, inRange, type DateRange } from '@/lib/dateRange';

// ── Status config (cycle complet) ─────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'À assigner', color: '#6B7280', bg: '#6B728018' },
  accepted:    { label: 'En attente', color: '#C48A2A', bg: '#C48A2A15' },
  validated:   { label: 'Validée',    color: '#C9A84C', bg: '#C9A84C15' },
  in_progress: { label: 'En cours',   color: '#5B6EF5', bg: '#5B6EF518' },
  completed:   { label: 'Terminée',   color: '#5A8A6A', bg: '#5A8A6A15' },
  cancelled:   { label: 'Annulée',    color: '#B85A50', bg: '#B85A5015' },
};

const ST_REQ: Record<string, { label: string; color: string }> = {
  pending:     { label: 'En attente', color: '#C48A2A' },
  validated:   { label: 'Validée',    color: '#C9A84C' },
  refused:     { label: 'Refusée',    color: '#B85A50' },
  in_progress: { label: 'En cours',   color: '#8B7A62' },
  completed:   { label: 'Terminée',   color: '#5A8A6A' },
};

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

const SOURCE_LABEL: Record<string, string> = { hotel: 'Hôtel', airbnb: 'Airbnb' };

const TABS = ['Annonces hôtel', 'Missions', 'Créer'] as const;

const emptyForm = {
  source: 'hotel' as MissionSource,
  hotelId: '', airbnbId: '',
  property: '', address: '',
  cleanerId: '', date: '', time: '',
  durationMinutes: '60', price: '',
  nextArrival: '', nextArrivalTime: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ── Encart « gain cleaner » calculé en direct ─────────────────────────────────
function GainPreview({ gain, cleaner, minutes }: { gain: number; cleaner: any; minutes: string }) {
  const rate = cleaner?.hourly_rate ?? 0;
  return (
    <div className="md:col-span-2 rounded-xl px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#C9A84C12', border: '1px solid #C9A84C40' }}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Gain cleaner (auto)</p>
        <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>
          {cleaner ? `${rate}€/h × ${minutes || 0} min ÷ 60` : 'Sélectionnez un cleaner pour calculer le gain'}
        </p>
      </div>
      <span className="text-xl font-bold" style={{ color: '#C9A84C' }}>{gain}€</span>
    </div>
  );
}

// ── Carte mission admin ───────────────────────────────────────────────────────

function AdminMissionCard({ mission, cleaners, onRefresh, selectable, selected, onToggleSelect }: {
  mission: Mission;
  cleaners: any[];
  onRefresh: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const { user } = useAuth();
  const [assignOpen, setAssignOpen] = useState(false);
  const [newCleaner, setNewCleaner] = useState('');
  const [busy, setBusy] = useState(false);
  const [mapsOpen, setMapsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [editForm, setEditForm] = useState({
    date: mission.date, time: mission.time,
    durationMinutes: String(mission.missionDurationMinutes ?? 60),
    type: mission.type, price: String(mission.price ?? 0),
  });
  const st = STATUS_CFG[mission.status] ?? STATUS_CFG.pending;
  const { portalCode, keyboxCode, extra } = parseMissionNotes(mission.notes);
  const notesIsLong = extra.length > 120;

  async function changeStatus(s: MissionStatus) {
    setBusy(true);
    await updateMissionStatusDB(mission.id, s, { id: user?.id ?? '', role: 'admin' });
    onRefresh();
    setBusy(false);
  }

  function openEdit() {
    setEditForm({
      date: mission.date, time: mission.time,
      durationMinutes: String(mission.missionDurationMinutes ?? 60),
      type: mission.type, price: String(mission.price ?? 0),
    });
    setActionError('');
    setEditOpen(true);
  }

  // Aperçu du gain recalculé en direct dans le formulaire d'édition.
  const editCleaner = cleaners.find(c => c.id === mission.cleanerId);
  const editGainPreview = computeCleanerGain(editCleaner?.hourly_rate ?? mission.cleanerHourlyRateSnapshot ?? 0, Number(editForm.durationMinutes) || 0);

  async function saveEdit() {
    if (!user) return;
    setBusy(true); setActionError('');
    const res = await updateMissionDB(mission.id, { id: user.id, role: 'admin' }, {
      dateFrom: editForm.date,
      timeFrom: editForm.time,
      missionDurationMinutes: Number(editForm.durationMinutes) || 0,
      type: editForm.type,
      price: Number(editForm.price) || 0,  // prix CLIENT uniquement
    });
    setBusy(false);
    if (res.error) { setActionError(res.error); return; }
    setEditOpen(false);
    onRefresh();
  }

  async function handleDelete() {
    if (!user) return;
    if (!confirm('Supprimer définitivement cette mission ?')) return;
    setBusy(true); setActionError('');
    const res = await deleteMissionDB(mission.id, { id: user.id, role: 'admin' });
    setBusy(false);
    if (res.error) { setActionError(res.error); return; }
    onRefresh();
  }

  async function handleAssign() {
    if (!newCleaner) return;
    const c = cleaners.find(x => x.id === newCleaner);
    // Le gain cleaner est recalculé côté serveur : taux horaire × durée mission / 60.
    setBusy(true);
    await assignCleanerToMissionDB(mission.id, newCleaner, c?.name ?? '');
    setAssignOpen(false);
    setNewCleaner('');
    onRefresh();
    setBusy(false);
  }

  const isTerminal = mission.status === 'completed' || mission.status === 'cancelled';
  const source = mission.source ?? 'hotel';

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      {mapsOpen && mission.address && <MapsModal address={mission.address} onClose={() => setMapsOpen(false)} />}

      {/* ── Header : source + type / statut */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: '#F2EFE9' }}>
        <div className="flex items-center gap-2">
          {selectable && (
            <button onClick={() => onToggleSelect?.(mission.id)} aria-label="Sélectionner"
              className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all"
              style={{ borderColor: selected ? '#C9A84C' : '#C8C2BA', backgroundColor: selected ? '#C9A84C' : '#FFFFFF' }}>
              {selected && <span className="text-xs font-bold" style={{ color: '#1A1A1A' }}>✓</span>}
            </button>
          )}
          <span className="text-xs px-2.5 py-1 rounded-lg font-semibold"
            style={{ backgroundColor: source === 'airbnb' ? '#C9A84C15' : '#F5F3EF', color: source === 'airbnb' ? '#C9A84C' : '#7A7068' }}>
            {SOURCE_LABEL[source]}
          </span>
          <span className="text-xs" style={{ color: '#A8A09A' }}>{TYPE_LABEL[mission.type] ?? mission.type}</span>
          {mission.zoneName && (
            <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: '#7A7068' }} title={mission.zoneName}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: mission.zoneColor ?? '#9CA3AF' }} />
              {mission.zoneName}
            </span>
          )}
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
          style={{ backgroundColor: st.bg, color: st.color }}>
          {st.label}
        </span>
      </div>

      {/* ── Corps */}
      <div className="px-5 py-4 space-y-3">
        {/* Nom + adresse */}
        <div className="min-w-0">
          <h3 className="font-semibold text-base truncate" style={{ color: '#1A1A1A' }}>{mission.property || 'Mission'}</h3>
          {mission.address && (
            <button onClick={() => setMapsOpen(true)}
              className="flex items-center gap-1 mt-0.5 text-left transition-colors max-w-full min-w-0"
              style={{ color: '#A8A09A' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#C9A84C')}
              onMouseLeave={e => (e.currentTarget.style.color = '#A8A09A')}>
              <span className="text-xs shrink-0">◎</span>
              <span className="text-xs truncate">{mission.address}</span>
            </button>
          )}
        </div>

        {/* Date / heure / durée */}
        <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: '#7A7068' }}>
          <span>{formatDate(mission.date)}</span>
          {mission.time && <span>{source === 'airbnb' ? 'Départ ' : '◷ '}{formatHour(mission.time)}</span>}
          {(mission.missionDurationMinutes ?? 0) > 0 && <span>⟳ {formatDuration(mission.missionDurationMinutes)}</span>}
        </div>

        {mission.nextArrival && (
          mission.nextArrival === mission.date ? (
            <div className="px-3 py-2 rounded-xl text-xs font-bold" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
              Arrivée client le jour même{mission.nextArrivalTime ? ` à ${formatHour(mission.nextArrivalTime)}` : ''}
            </div>
          ) : (
            <p className="text-xs" style={{ color: '#7A7068' }}>
              Prochaine arrivée : {formatDate(mission.nextArrival)}{mission.nextArrivalTime ? ` à ${formatHour(mission.nextArrivalTime)}` : ''}
            </p>
          )
        )}

        {/* Cleaner + durée + taux + prix client + gain cleaner */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Cleaner</p>
            <p className="text-sm font-medium" style={{ color: mission.cleanerName ? '#1A1A1A' : '#C48A2A' }}>
              {mission.cleanerName ?? 'Non assigné'}
            </p>
          </div>
          {mission.requestedBy && (
            <div>
              <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Client</p>
              <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{mission.requestedBy}</p>
            </div>
          )}
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Durée</p>
            <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{formatDuration(mission.missionDurationMinutes)}</p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Taux cleaner</p>
            <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{mission.cleanerHourlyRateSnapshot != null ? `${mission.cleanerHourlyRateSnapshot}€/h` : '—'}</p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Prix client</p>
            <p className="text-sm font-semibold" style={{ color: '#5A8A6A' }}>{mission.price}€</p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Gain cleaner</p>
            <p className="text-sm font-semibold" style={{ color: '#C9A84C' }}>{mission.cleanerGain ?? 0}€</p>
          </div>
        </div>

        {/* Codes accès + consignes */}
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
              <div className="px-3 py-2.5 rounded-xl text-xs leading-snug" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>
                <p style={notesIsLong && !notesOpen ? {
                  overflow: 'hidden', display: '-webkit-box',
                  WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
                } : {}}>
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
      </div>

      {/* ── Actions */}
      <div className="px-5 pb-4 border-t pt-3 space-y-2" style={{ borderColor: '#F2EFE9' }}>
        {actionError && (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#B85A5012', color: '#B85A50' }}>{actionError}</p>
        )}

        {isTerminal ? (
          /* Mission clôturée → verrouillée : consultation + facturation uniquement */
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl" style={{ backgroundColor: '#F8F6F2' }}>
            <span className="text-xs" style={{ color: '#7A7068' }}>
              {mission.status === 'completed' ? '🔒 Mission terminée — verrouillée' : '🔒 Mission annulée — verrouillée'}
            </span>
            {mission.status === 'completed' && (
              <a href="/admin/facturation" className="text-xs font-semibold shrink-0" style={{ color: '#C9A84C' }}>Facturation →</a>
            )}
          </div>
        ) : editOpen ? (
          /* Formulaire de modification (admin) */
          <div className="space-y-3 rounded-xl p-3" style={{ backgroundColor: '#F8F6F2' }}>
            <div className="grid grid-cols-2 gap-2" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Date</label>
                <input type="date" value={editForm.date} onChange={e => setEditForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>{source === 'airbnb' ? 'Heure départ clients' : 'Heure'}</label>
                {source === 'airbnb' ? (
                  <select value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border appearance-none" style={inputStyle}>
                    <option value="">Choisir</option>
                    {DEPARTURE_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
                  </select>
                ) : (
                  <input type="time" value={editForm.time} onChange={e => setEditForm(f => ({ ...f, time: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
                )}
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Temps de nettoyage (min)</label>
                <input type="number" min="5" step="5" value={editForm.durationMinutes} onChange={e => setEditForm(f => ({ ...f, durationMinutes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Type</label>
                <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value as MissionType }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border appearance-none" style={inputStyle}>
                  <option value="regular">Ménage</option>
                  <option value="checkout">Check-out</option>
                  <option value="checkin">Check-in</option>
                  <option value="deep_clean">Grand ménage</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Prix client (€)</label>
                <input type="number" min="0" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Gain cleaner (auto)</label>
                <div className="w-full px-3 py-2 rounded-lg text-sm border font-semibold" style={{ ...inputStyle, color: '#C9A84C' }}>
                  {editGainPreview}€
                </div>
              </div>
            </div>
            <p className="text-[11px]" style={{ color: '#A8A09A' }}>
              Gain = taux cleaner {editCleaner?.hourly_rate ?? mission.cleanerHourlyRateSnapshot ?? 0}€/h × {editForm.durationMinutes || 0} min ÷ 60. Le prix client est indépendant.
            </p>
            <div className="flex gap-2">
              <button onClick={saveEdit} disabled={busy}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                {busy ? '...' : 'Enregistrer'}
              </button>
              <button onClick={() => { setEditOpen(false); setActionError(''); }} disabled={busy}
                className="px-4 py-2.5 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Annuler</button>
            </div>
          </div>
        ) : assignOpen ? (
          /* Assigner / réassigner un cleaner */
          <div className="flex gap-2">
            <select value={newCleaner} onChange={e => setNewCleaner(e.target.value)}
              className="flex-1 px-3 py-2 rounded-xl text-sm border appearance-none"
              style={{ ...inputStyle, color: newCleaner ? '#1A1A1A' : '#A8A09A' }}>
              <option value="">Choisir un cleaner</option>
              {cleaners.map(c => <option key={c.id} value={c.id}>{c.name}{c.status === 'offline' ? ' · Hors ligne' : ''}</option>)}
            </select>
            <button onClick={handleAssign} disabled={!newCleaner || busy}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>OK</button>
            <button onClick={() => { setAssignOpen(false); setNewCleaner(''); }}
              className="px-3 py-2 rounded-xl text-sm"
              style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>✕</button>
          </div>
        ) : (
          <>
            <div className="flex gap-2 flex-wrap">
              {/* Statut suivant logique */}
              {mission.status === 'pending' && (
                <button onClick={() => setAssignOpen(true)} disabled={busy}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                  + Assigner un cleaner
                </button>
              )}
              {mission.status === 'accepted' && (
                <>
                  <button onClick={() => changeStatus('validated')} disabled={busy}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                    style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                    ✓ Valider
                  </button>
                  <button onClick={() => setAssignOpen(true)} disabled={busy}
                    className="px-4 py-2.5 rounded-xl text-sm border disabled:opacity-50"
                    style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                    Réassigner
                  </button>
                </>
              )}
              {mission.status === 'validated' && (
                <button onClick={() => setAssignOpen(true)} disabled={busy}
                  className="px-4 py-2.5 rounded-xl text-sm border disabled:opacity-50"
                  style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                  Réassigner cleaner
                </button>
              )}
              {mission.status === 'in_progress' && (
                <button onClick={() => changeStatus('completed')} disabled={busy}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>
                  ✓ Terminer
                </button>
              )}
              {/* Annuler (transition de statut) toujours dispo */}
              <button onClick={() => changeStatus('cancelled')} disabled={busy}
                className="px-4 py-2.5 rounded-xl text-sm border disabled:opacity-50"
                style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>
                Annuler
              </button>
            </div>

            {/* Modifier / Supprimer (créateur = admin ici) */}
            <div className="flex gap-2">
              <button onClick={openEdit} disabled={busy}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border disabled:opacity-50"
                style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                Modifier
              </button>
              <button onClick={handleDelete} disabled={busy}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border disabled:opacity-50"
                style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>
                Supprimer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function MissionsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<typeof TABS[number]>('Annonces hôtel');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [requests, setRequests] = useState<HotelAnnounce[]>([]);
  const [cleaners, setCleaners] = useState<any[]>([]);
  const [hotels, setHotels] = useState<any[]>([]);
  const [airbnbs, setAirbnbs] = useState<Apartment[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCleaner, setBulkCleaner] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [range, setRange] = useState<DateRange>(() => presetRange('today'));
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedCleaner, setSelectedCleaner] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState(emptyForm);
  // Création groupée (plusieurs appartements en une opération)
  const [createMode, setCreateMode] = useState<'single' | 'batch'>('single');
  const [batchApts, setBatchApts] = useState<Set<string>>(new Set());
  const [batchDate, setBatchDate] = useState('');
  const [batchTime, setBatchTime] = useState('');
  const [batchCleaner, setBatchCleaner] = useState('');
  const [batchZone, setBatchZone] = useState('all');
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchError, setBatchError] = useState('');
  const [batchDone, setBatchDone] = useState('');

  const load = useCallback(async () => {
    const [m, r, c, h, a] = await Promise.all([
      getMissionsDB(), getHotelRequestsDB(), getActiveCleanersDB(),
      getApprovedHotelsDB(), getAirbnbs(),
    ]);
    setMissions(m); setRequests(r); setCleaners(c);
    setHotels(h); setAirbnbs(a);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch1 = supabase.channel('rt-requests').on('postgres_changes', { event: '*', schema: 'public', table: 'hotel_requests' }, load).subscribe();
    const ch2 = supabase.channel('rt-missions').on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, load).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [load]);

  async function handleValidate(id: string) {
    if (!selectedCleaner) return;
    const c = cleaners.find(x => x.id === selectedCleaner);
    await validateRequestDB(id, selectedCleaner, c?.name ?? '');
    setAssigningId(null); setSelectedCleaner('');
    await load();
  }

  async function handleRefuse(id: string) { await refuseRequestDB(id); await load(); }

  function selectHotel(hotelId: string) {
    const h = hotels.find(x => x.id === hotelId);
    setForm(p => ({ ...p, hotelId, property: h?.hotel_name ?? '', address: h?.address ?? '' }));
  }

  function selectAirbnb(airbnbId: string) {
    const a = airbnbs.find(x => x.id === airbnbId);
    const matchedCleaner = a?.cleanerId
      ? cleaners.find(c => c.id === a.cleanerId || c.user_id === a.cleanerId)
      : null;
    setForm(p => ({
      ...p, airbnbId,
      property: a?.name ?? '',
      address: a?.address ?? '',
      cleanerId: matchedCleaner?.id ?? '',
      price: a?.clientPrice != null ? String(a.clientPrice) : p.price,  // prix CLIENT (facturation)
      durationMinutes: a?.estimatedCleaningMinutes != null ? String(a.estimatedCleaningMinutes) : p.durationMinutes,
    }));
  }

  // Gain cleaner calculé en direct : taux horaire × durée mission / 60.
  const formCleaner = cleaners.find(c => c.id === form.cleanerId);
  const formGain = computeCleanerGain(formCleaner?.hourly_rate ?? 0, Number(form.durationMinutes) || 0);

  function cleanerWarning(cleanerId: string, date: string): string | null {
    if (!cleanerId || !date) return null;
    const c = cleaners.find(x => x.id === cleanerId);
    if (!c) return null;
    if (c.status === 'offline') return 'Ce cleaner est hors ligne. Vous pouvez quand même assigner.';
    if (c.status === 'busy') return 'ℹ️ Ce cleaner est actuellement en mission.';
    if (c.available_days?.length > 0) {
      const day = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      if (!c.available_days.includes(day)) return `Ce cleaner n'est pas disponible ce jour-là. Vous pouvez quand même assigner.`;
    }
    return null;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError('');

    if (form.source === 'airbnb' && !form.airbnbId) {
      setCreateError('Veuillez sélectionner un appartement.');
      setCreating(false);
      return;
    }
    if (form.source === 'hotel' && !form.property.trim()) {
      setCreateError('Veuillez renseigner le nom de la propriété.');
      setCreating(false);
      return;
    }
    if (!form.date) {
      setCreateError('Veuillez renseigner la date.');
      setCreating(false);
      return;
    }
    if (!form.time) {
      setCreateError('Veuillez renseigner l\'heure.');
      setCreating(false);
      return;
    }

    const c = cleaners.find(x => x.id === form.cleanerId);
    const type: MissionType = form.source === 'airbnb' ? 'regular' : 'checkout';

    // Mission Airbnb : on la lie à l'appartement (source de vérité pour
    // l'adresse et les codes d'accès) et au partenaire propriétaire s'il existe.
    const apt = form.source === 'airbnb' ? airbnbs.find(a => a.id === form.airbnbId) : undefined;

    setCreateError('');
    const result = await createMissionDB({
      type, source: form.source,
      propertyName: form.property,
      address: form.address,
      dateFrom: form.date,
      timeFrom: form.time,
      timeTo: '',
      missionDurationMinutes: Number(form.durationMinutes) || 60,
      cleanerHourlyRate: c?.hourly_rate ?? 0,
      apartmentDefaultDuration: apt?.estimatedCleaningMinutes,
      cleanerId: form.cleanerId || undefined,
      cleanerName: c?.name,
      price: Number(form.price) || 0,  // prix CLIENT (facturation)
      airbnbId: apt?.id,
      partnerId: apt?.partnerId,
      nextArrival: form.nextArrival || undefined,
      nextArrivalTime: form.nextArrivalTime || undefined,
      createdBy: user?.id,
      createdByRole: 'admin',
    });

    if (result.error) {
      setCreateError(`Erreur Supabase : ${result.error}`);
      setCreating(false);
      return;
    }

    setFilter('all');
    setForm(emptyForm);
    await load();
    setTab('Missions');
    setCreating(false);
  }

  // ── Création groupée : une mission par appartement sélectionné ──
  function toggleBatchApt(id: string) {
    setBatchDone('');
    setBatchApts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleBatchCreate() {
    setBatchError(''); setBatchDone('');
    if (batchApts.size === 0) { setBatchError('Sélectionnez au moins un appartement.'); return; }
    if (!batchDate) { setBatchError('Choisissez la date de nettoyage.'); return; }

    const c = cleaners.find(x => x.id === batchCleaner);
    const selected = airbnbs.filter(a => batchApts.has(a.id));
    const apartments = selected.map(a => ({
      airbnbId: a.id,
      partnerId: a.partnerId,
      price: a.clientPrice ?? 0,                       // prix CLIENT repris de la fiche
      durationMinutes: a.estimatedCleaningMinutes ?? 60,
      defaultDuration: a.estimatedCleaningMinutes ?? undefined,
    }));

    setBatchBusy(true);
    const res = await createMissionsBatchDB({
      apartments,
      dateFrom: batchDate,
      timeFrom: batchTime,
      cleanerId: batchCleaner || undefined,
      cleanerName: c?.name,
      cleanerHourlyRate: c?.hourly_rate ?? 0,
      createdBy: user?.id,
      createdByRole: 'admin',
    });
    setBatchBusy(false);

    if (res.error) { setBatchError(`Erreur Supabase : ${res.error}`); return; }
    setBatchDone(`${res.count} mission${res.count > 1 ? 's' : ''} créée${res.count > 1 ? 's' : ''}.`);
    setBatchApts(new Set());
    setBatchDate(''); setBatchTime(''); setBatchCleaner('');
    setFilter('all');
    await load();
    setTab('Missions');
  }

  const pendingReqs = requests.filter(r => r.status === 'pending').length;

  // Zones présentes parmi les appartements (filtre de la création groupée).
  const batchZones = (() => {
    const map = new Map<string, string>();
    airbnbs.forEach(a => { if (a.zoneName) map.set(a.zoneName, a.zoneColor ?? '#9CA3AF'); });
    return Array.from(map.entries()).map(([name, color]) => ({ name, color }));
  })();
  const batchVisibleApts = batchZone === 'all' ? airbnbs : airbnbs.filter(a => (a.zoneName ?? '') === batchZone);

  const FILTERS = [
    { value: 'all',         label: 'Toutes' },
    { value: 'pending',     label: 'À assigner' },
    { value: 'accepted',    label: 'En attente' },
    { value: 'validated',   label: 'Validées' },
    { value: 'in_progress', label: 'En cours' },
    { value: 'completed',   label: 'Terminées' },
    { value: 'cancelled',   label: 'Annulées' },
  ];

  // 1) on restreint à la période, 2) au statut, 3) à la zone sélectionnée
  const dateScoped = missions.filter(m => inRange(m.date, range));
  const statusScoped = filter === 'all' ? dateScoped : dateScoped.filter(m => m.status === filter);
  const filtered = zoneFilter === 'all' ? statusScoped : statusScoped.filter(m => (m.zoneName ?? '') === zoneFilter);

  // Zones présentes dans les missions de la période (pour le filtre).
  const zonesInScope = (() => {
    const map = new Map<string, string>(); // name → color
    dateScoped.forEach(m => { if (m.zoneName) map.set(m.zoneName, m.zoneColor ?? '#9CA3AF'); });
    return Array.from(map.entries()).map(([name, color]) => ({ name, color }));
  })();

  // ── Sélection groupée (tournée par zone) ──
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAllVisible() {
    setSelectedIds(new Set(filtered.filter(m => m.status !== 'completed' && m.status !== 'cancelled').map(m => m.id)));
  }
  function clearSelection() { setSelectedIds(new Set()); }

  async function handleBulkAssign() {
    if (!bulkCleaner || selectedIds.size === 0) return;
    const c = cleaners.find(x => x.id === bulkCleaner);
    setBulkBusy(true);
    await assignCleanerToMissionsDB(Array.from(selectedIds), bulkCleaner, c?.name ?? '');
    setBulkBusy(false);
    clearSelection();
    setBulkCleaner('');
    await load();
  }

  // Bornes (1re → dernière mission) pour le bouton « voir toutes les dates »
  const allDates = missions.map(m => m.date).filter(Boolean).sort();
  const outOfRangeCount = missions.length - dateScoped.length;

  if (loading) return <div className="p-4 md:p-6 text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6"><h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Missions</h1></div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-xl text-sm font-medium transition-all relative"
            style={{ backgroundColor: tab === t ? '#FFFFFF' : 'transparent', color: tab === t ? '#1A1A1A' : '#A8A09A', boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {t}
            {t === 'Annonces hôtel' && pendingReqs > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ backgroundColor: '#C48A2A', color: '#FFF' }}>{pendingReqs}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── ANNONCES HÔTEL ── */}
      {tab === 'Annonces hôtel' && (
        <div className="space-y-3">
          {requests.length === 0 && (
            <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
              <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune annonce</p>
            </div>
          )}
          {requests.map(a => {
            const st = ST_REQ[a.status];
            const isPending = a.status === 'pending';
            return (
              <div key={a.id} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: isPending ? '#C48A2A40' : '#E8E4DC' }}>
                <div className="px-5 py-3.5 flex items-center justify-between gap-3 border-b" style={{ borderColor: '#F2EFE9' }}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{TYPE_LABEL[a.type] ?? a.type} — {a.hotelName}</span>
                    <span className="text-xs" style={{ color: '#A8A09A' }}>
                      {new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {a.dateEnd && a.dateEnd !== a.date && <> → {new Date(a.dateEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</>}
                      {' · '}{a.timeStart}–{a.timeEnd}
                    </span>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold shrink-0"
                    style={{ backgroundColor: `${st.color}15`, color: st.color }}>{st.label}</span>
                </div>
                <div className="px-5 py-4">
                  <div className="flex flex-wrap gap-4 mb-3">
                    <span className="text-xs" style={{ color: '#7A7068' }}>{a.guestCount} personne{a.guestCount > 1 ? 's' : ''}</span>
                    {a.cleanerName && <span className="text-xs" style={{ color: '#C9A84C' }}>{a.cleanerName}</span>}
                  </div>
                  {a.instructions && <p className="text-xs mb-3 px-3 py-2 rounded-xl" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>{a.instructions}</p>}
                  {isPending && (assigningId === a.id ? (
                    <div className="flex gap-2">
                      <select value={selectedCleaner} onChange={e => setSelectedCleaner(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-xl text-sm border appearance-none"
                        style={{ ...inputStyle, color: selectedCleaner ? '#1A1A1A' : '#A8A09A' }}>
                        <option value="">Choisir un cleaner</option>
                        {cleaners.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button onClick={() => handleValidate(a.id)} disabled={!selectedCleaner}
                        className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                        style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Valider</button>
                      <button onClick={() => { setAssigningId(null); setSelectedCleaner(''); }}
                        className="px-3 py-2 rounded-xl text-sm" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>✕</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setAssigningId(a.id)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                        style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Valider et attribuer</button>
                      <button onClick={() => handleRefuse(a.id)} className="px-4 py-2.5 rounded-xl text-sm border"
                        style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>Refuser</button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── MISSIONS ── */}
      {tab === 'Missions' && (
        <>
          {/* Filtre par période */}
          <DateRangeFilter
            start={range.start}
            end={range.end}
            onChange={setRange}
            className="mb-4"
          />

          {/* Filtres statut (comptes calculés sur la période sélectionnée) */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {FILTERS.map(({ value, label }) => (
              <button key={value} onClick={() => setFilter(value)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={{
                  backgroundColor: filter === value ? '#C9A84C' : '#FFFFFF',
                  color: filter === value ? '#1A1A1A' : '#7A7068',
                  border: `1px solid ${filter === value ? '#C9A84C' : '#E8E4DC'}`,
                }}>
                {label}
                <span className="ml-1.5 opacity-60">
                  {value === 'all' ? dateScoped.length : dateScoped.filter(m => m.status === value).length}
                </span>
              </button>
            ))}
          </div>

          {/* Filtre par zone */}
          {zonesInScope.length > 0 && (
            <div className="flex gap-2 mb-4 flex-wrap items-center">
              <span className="text-xs font-semibold uppercase tracking-wider mr-1" style={{ color: '#A8A09A' }}>Zone</span>
              <button onClick={() => setZoneFilter('all')}
                className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={{ backgroundColor: zoneFilter === 'all' ? '#C9A84C' : '#FFFFFF', color: zoneFilter === 'all' ? '#1A1A1A' : '#7A7068', border: `1px solid ${zoneFilter === 'all' ? '#C9A84C' : '#E8E4DC'}` }}>
                Toutes
              </button>
              {zonesInScope.map(z => (
                <button key={z.name} onClick={() => setZoneFilter(z.name)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                  style={{ backgroundColor: zoneFilter === z.name ? '#C9A84C' : '#FFFFFF', color: zoneFilter === z.name ? '#1A1A1A' : '#7A7068', border: `1px solid ${zoneFilter === z.name ? '#C9A84C' : '#E8E4DC'}` }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }} />
                  {z.name}
                </button>
              ))}
            </div>
          )}

          {/* Barre d'assignation groupée (tournée) */}
          <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
            <p className="text-xs" style={{ color: '#A8A09A' }}>
              {filtered.length} mission{filtered.length > 1 ? 's' : ''}
            </p>
            <button onClick={selectAllVisible} className="text-xs font-medium" style={{ color: '#C9A84C' }}>
              Tout sélectionner (assignables)
            </button>
          </div>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mb-4 p-3 rounded-xl flex-wrap" style={{ backgroundColor: '#C9A84C12', border: '1px solid #C9A84C40' }}>
              <span className="text-sm font-semibold" style={{ color: '#7A6030' }}>{selectedIds.size} sélectionnée{selectedIds.size > 1 ? 's' : ''}</span>
              <select value={bulkCleaner} onChange={e => setBulkCleaner(e.target.value)}
                className="flex-1 min-w-[160px] px-3 py-2 rounded-xl text-sm border appearance-none"
                style={{ ...inputStyle, color: bulkCleaner ? '#1A1A1A' : '#A8A09A' }}>
                <option value="">Choisir un cleaner</option>
                {cleaners.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={handleBulkAssign} disabled={!bulkCleaner || bulkBusy}
                className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                {bulkBusy ? '...' : `Assigner ${selectedIds.size}`}
              </button>
              <button onClick={clearSelection} className="px-3 py-2 rounded-xl text-sm" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>✕</button>
            </div>
          )}

          {/* Cartes */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
              <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune mission pour cette période</p>
              {outOfRangeCount > 0 && allDates.length > 0 && (
                <button onClick={() => setRange({ start: allDates[0], end: allDates[allDates.length - 1] })}
                  className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                  Voir les {outOfRangeCount} mission{outOfRangeCount > 1 ? 's' : ''} sur d'autres dates →
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {groupMissionsByCleaner(filtered).map(group => (
                <section key={group.cleanerId ?? '__unassigned__'}>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-semibold text-base"
                      style={{ color: group.cleanerId ? '#1A1A1A' : '#C48A2A' }}>
                      {group.cleanerName}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>
                      {group.missions.length}
                    </span>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    {group.missions.map(m => (
                      <AdminMissionCard key={m.id} mission={m} cleaners={cleaners} onRefresh={load}
                        selectable={m.status !== 'completed' && m.status !== 'cancelled'}
                        selected={selectedIds.has(m.id)}
                        onToggleSelect={toggleSelect} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── CRÉER ── */}
      {tab === 'Créer' && (
        <div>
          {/* Mode de création */}
          <div className="flex gap-1 mb-5 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
            {([['single', 'Une mission'], ['batch', 'Plusieurs appartements']] as const).map(([m, label]) => (
              <button key={m} type="button" onClick={() => setCreateMode(m)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: createMode === m ? '#FFFFFF' : 'transparent', color: createMode === m ? '#1A1A1A' : '#A8A09A', boxShadow: createMode === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
                {label}
              </button>
            ))}
          </div>

          {createMode === 'single' ? (
        <form onSubmit={handleCreate} className="rounded-2xl border p-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <h2 className="font-semibold mb-6" style={{ color: '#1A1A1A' }}>Nouvelle mission</h2>

          {/* Source */}
          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Source</label>
            <div className="flex gap-2">
              {(['hotel', 'airbnb'] as MissionSource[]).map(s => (
                <button key={s} type="button" onClick={() => setForm({ ...emptyForm, source: s })}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all"
                  style={{ borderColor: form.source === s ? '#C9A84C' : '#E8E4DC', backgroundColor: form.source === s ? '#C9A84C12' : '#FFFFFF', color: form.source === s ? '#C9A84C' : '#7A7068' }}>
                  {s === 'hotel' ? 'Hôtel' : 'Airbnb'}
                </button>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">

            {/* ── HÔTEL ── */}
            {form.source === 'hotel' && (<>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Hôtel partenaire</label>
                <select value={form.hotelId} onChange={e => selectHotel(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
                  style={{ ...inputStyle, color: form.hotelId ? '#1A1A1A' : '#A8A09A' }}>
                  <option value="">Sélectionner un hôtel</option>
                  {hotels.map(h => <option key={h.id} value={h.id}>{h.hotel_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Propriété</label>
                <input required value={form.property} onChange={e => setForm(p => ({ ...p, property: e.target.value }))}
                  placeholder="Nom de la propriété" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Adresse</label>
                <input value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="Adresse" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Cleaner</label>
                <select value={form.cleanerId} onChange={e => setForm(p => ({ ...p, cleanerId: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
                  style={{ ...inputStyle, color: form.cleanerId ? '#1A1A1A' : '#A8A09A' }}>
                  <option value="">Assigner plus tard</option>
                  {cleaners.map(c => <option key={c.id} value={c.id}>{c.name}{c.status === 'offline' ? ' · Hors ligne' : ''}</option>)}
                </select>
              </div>
              {cleanerWarning(form.cleanerId, form.date) && (
                <div className="md:col-span-2 px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#C48A2A10', color: '#C48A2A' }}>
                  {cleanerWarning(form.cleanerId, form.date)}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Date</label>
                  <input required type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Heure</label>
                  <input required type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Temps de nettoyage (minutes)</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {DURATION_PRESETS.map(d => (
                    <button key={d} type="button" onClick={() => setForm(p => ({ ...p, durationMinutes: String(d) }))}
                      className="px-3 py-2 rounded-xl text-sm font-semibold border transition-all"
                      style={{ borderColor: form.durationMinutes === String(d) ? '#C9A84C' : '#E8E4DC', backgroundColor: form.durationMinutes === String(d) ? '#C9A84C' : '#FFFFFF', color: form.durationMinutes === String(d) ? '#1A1A1A' : '#A8A09A' }}>
                      {formatDuration(d)}
                    </button>
                  ))}
                </div>
                <input type="number" min="5" step="5" value={form.durationMinutes} onChange={e => setForm(p => ({ ...p, durationMinutes: e.target.value }))}
                  placeholder="Durée en minutes" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Prix client (€) — facturation</label>
                <input type="number" min="0" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="0" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <GainPreview gain={formGain} cleaner={formCleaner} minutes={form.durationMinutes} />
            </>)}

            {/* ── AIRBNB ── */}
            {form.source === 'airbnb' && (<>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Appartement</label>
                <select value={form.airbnbId} onChange={e => selectAirbnb(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
                  style={{ ...inputStyle, color: form.airbnbId ? '#1A1A1A' : '#A8A09A' }}>
                  <option value="">Sélectionner un appartement</option>
                  {airbnbs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              {form.airbnbId && (() => {
                const apt = airbnbs.find(a => a.id === form.airbnbId);
                return (
                  <div className="md:col-span-2 rounded-xl p-4 space-y-1.5" style={{ backgroundColor: '#F8F6F2' }}>
                    {apt?.zoneName && (
                      <p className="text-sm flex items-center gap-2"><span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#A8A09A' }}>Zone</span>
                        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: apt.zoneColor ?? '#9CA3AF' }} />{apt.zoneName}</span>
                      </p>
                    )}
                    {form.property && <p className="text-sm"><span className="text-xs font-semibold uppercase tracking-wide mr-2" style={{ color: '#A8A09A' }}>Propriété</span>{form.property}</p>}
                    {form.address && <p className="text-sm" style={{ color: '#7A7068' }}><span className="text-xs font-semibold uppercase tracking-wide mr-2" style={{ color: '#A8A09A' }}>Adresse</span>{form.address}</p>}
                    {apt?.portalCode && <p className="text-sm font-mono"><span className="text-xs font-semibold uppercase tracking-wide mr-2 font-sans" style={{ color: '#A8A09A' }}>Code portail</span>{apt.portalCode}</p>}
                    {apt?.keyboxCode && <p className="text-sm font-mono"><span className="text-xs font-semibold uppercase tracking-wide mr-2 font-sans" style={{ color: '#A8A09A' }}>Boîte à clé</span>{apt.keyboxCode}</p>}
                    {apt?.entryDirectives && <p className="text-sm" style={{ color: '#7A7068' }}><span className="text-xs font-semibold uppercase tracking-wide mr-2" style={{ color: '#A8A09A' }}>Entrée</span>{apt.entryDirectives}</p>}
                  </div>
                );
              })()}
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Cleaner</label>
                <select value={form.cleanerId} onChange={e => setForm(p => ({ ...p, cleanerId: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
                  style={{ ...inputStyle, color: form.cleanerId ? '#1A1A1A' : '#A8A09A' }}>
                  <option value="">Assigner plus tard</option>
                  {cleaners.map(c => <option key={c.id} value={c.id}>{c.name}{c.status === 'offline' ? ' · Hors ligne' : ''}</option>)}
                </select>
              </div>
              {cleanerWarning(form.cleanerId, form.date) && (
                <div className="md:col-span-2 px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#C48A2A10', color: '#C48A2A' }}>
                  {cleanerWarning(form.cleanerId, form.date)}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Date de nettoyage</label>
                <input required type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Heure départ clients</label>
                <select required value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
                  style={{ ...inputStyle, color: form.time ? '#1A1A1A' : '#A8A09A' }}>
                  <option value="">Choisir</option>
                  {DEPARTURE_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Prochaine arrivée client — optionnel</label>
                <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <input type="date" value={form.nextArrival} min={form.date || undefined} onChange={e => setForm(p => ({ ...p, nextArrival: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
                  <select value={form.nextArrivalTime} onChange={e => setForm(p => ({ ...p, nextArrivalTime: e.target.value }))}
                    className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
                    style={{ ...inputStyle, color: form.nextArrivalTime ? '#1A1A1A' : '#A8A09A' }}>
                    <option value="">Heure d&apos;arrivée</option>
                    {ARRIVAL_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
                  </select>
                </div>
                {form.nextArrival && form.date && form.nextArrival === form.date && (
                  <p className="text-xs mt-2 px-3 py-2 rounded-lg font-semibold" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
                    Arrivée le jour même du ménage — turnover urgent
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Temps de nettoyage (minutes)</label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {DURATION_PRESETS.map(d => (
                    <button key={d} type="button" onClick={() => setForm(p => ({ ...p, durationMinutes: String(d) }))}
                      className="px-3 py-2 rounded-xl text-sm font-semibold border transition-all"
                      style={{ borderColor: form.durationMinutes === String(d) ? '#C9A84C' : '#E8E4DC', backgroundColor: form.durationMinutes === String(d) ? '#C9A84C' : '#FFFFFF', color: form.durationMinutes === String(d) ? '#1A1A1A' : '#A8A09A' }}>
                      {formatDuration(d)}
                    </button>
                  ))}
                </div>
                <input type="number" min="5" step="5" value={form.durationMinutes} onChange={e => setForm(p => ({ ...p, durationMinutes: e.target.value }))}
                  placeholder="Durée en minutes" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
                <p className="text-xs mt-1.5" style={{ color: '#A8A09A' }}>Pré-rempli depuis l'appartement — modifiable si plus sale que prévu.</p>
              </div>
              {form.price && (
                <div className="md:col-span-2 px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>
                  Prix client (facturation) repris de l'appartement : <span style={{ color: '#5A8A6A', fontWeight: 600 }}>{form.price}€</span>
                </div>
              )}
              <GainPreview gain={formGain} cleaner={formCleaner} minutes={form.durationMinutes} />
            </>)}
          </div>

          {createError && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#B85A5012', color: '#B85A50' }}>
              {createError}
            </div>
          )}
          <button type="submit" disabled={creating}
            className="px-8 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
            style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {creating ? 'Création...' : 'Créer la mission'}
          </button>
        </form>
          ) : (
        /* ── CRÉATION GROUPÉE (plusieurs appartements) ── */
        <div className="rounded-2xl border p-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <h2 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>Créer plusieurs missions</h2>
          <p className="text-xs mb-6" style={{ color: '#A8A09A' }}>Une mission individuelle est créée pour chaque appartement coché.</p>

          {/* Réglages partagés */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Date de nettoyage</label>
              <input type="date" value={batchDate} onChange={e => { setBatchDate(e.target.value); setBatchDone(''); }}
                className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Heure départ clients</label>
              <select value={batchTime} onChange={e => setBatchTime(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
                style={{ ...inputStyle, color: batchTime ? '#1A1A1A' : '#A8A09A' }}>
                <option value="">Choisir</option>
                {DEPARTURE_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Cleaner</label>
              <select value={batchCleaner} onChange={e => setBatchCleaner(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
                style={{ ...inputStyle, color: batchCleaner ? '#1A1A1A' : '#A8A09A' }}>
                <option value="">Assigner plus tard</option>
                {cleaners.map(c => <option key={c.id} value={c.id}>{c.name}{c.status === 'offline' ? ' · Hors ligne' : ''}</option>)}
              </select>
            </div>
          </div>

          {/* Sélection des appartements */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>
              Appartements — {batchApts.size} sélectionné{batchApts.size > 1 ? 's' : ''}
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => { setBatchDone(''); setBatchApts(prev => new Set([...prev, ...batchVisibleApts.map(a => a.id)])); }}
                className="text-xs font-medium" style={{ color: '#C9A84C' }}>Tout sélectionner</button>
              <button type="button" onClick={() => { setBatchDone(''); setBatchApts(new Set()); }}
                className="text-xs font-medium" style={{ color: '#A8A09A' }}>Effacer</button>
            </div>
          </div>

          {/* Filtre par zone (tournée) */}
          {batchZones.length > 0 && (
            <div className="flex gap-2 mb-4 flex-wrap items-center">
              <button type="button" onClick={() => setBatchZone('all')}
                className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={{ backgroundColor: batchZone === 'all' ? '#C9A84C' : '#FFFFFF', color: batchZone === 'all' ? '#1A1A1A' : '#7A7068', border: `1px solid ${batchZone === 'all' ? '#C9A84C' : '#E8E4DC'}` }}>
                Toutes
              </button>
              {batchZones.map(z => (
                <button type="button" key={z.name} onClick={() => setBatchZone(z.name)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                  style={{ backgroundColor: batchZone === z.name ? '#C9A84C' : '#FFFFFF', color: batchZone === z.name ? '#1A1A1A' : '#7A7068', border: `1px solid ${batchZone === z.name ? '#C9A84C' : '#E8E4DC'}` }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }} />
                  {z.name}
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2 mb-6 max-h-[420px] overflow-auto pr-1">
            {batchVisibleApts.length === 0 && (
              <p className="text-sm py-6 text-center" style={{ color: '#A8A09A' }}>Aucun appartement.</p>
            )}
            {batchVisibleApts.map(a => {
              const checked = batchApts.has(a.id);
              return (
                <button type="button" key={a.id} onClick={() => toggleBatchApt(a.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all"
                  style={{ borderColor: checked ? '#C9A84C' : '#E8E4DC', backgroundColor: checked ? '#C9A84C12' : '#FFFFFF' }}>
                  <span className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all"
                    style={{ borderColor: checked ? '#C9A84C' : '#C8C2BA', backgroundColor: checked ? '#C9A84C' : '#FFFFFF' }}>
                    {checked && <span className="text-xs font-bold" style={{ color: '#1A1A1A' }}>✓</span>}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{a.name}</span>
                    {a.address && <span className="block text-xs truncate" style={{ color: '#A8A09A' }}>{a.address}</span>}
                  </span>
                  {a.zoneName && (
                    <span className="inline-flex items-center gap-1.5 text-xs shrink-0" style={{ color: '#7A7068' }}>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.zoneColor ?? '#9CA3AF' }} />{a.zoneName}
                    </span>
                  )}
                  <span className="text-xs shrink-0" style={{ color: '#A8A09A' }}>{formatDuration(a.estimatedCleaningMinutes ?? 60)}</span>
                </button>
              );
            })}
          </div>

          {batchError && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#B85A5012', color: '#B85A50' }}>{batchError}</div>
          )}
          {batchDone && (
            <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#5A8A6A15', color: '#5A8A6A' }}>{batchDone}</div>
          )}

          <button type="button" onClick={handleBatchCreate} disabled={batchBusy || batchApts.size === 0 || !batchDate}
            className="px-8 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
            style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {batchBusy ? 'Création...' : `Créer ${batchApts.size > 0 ? batchApts.size + ' ' : ''}mission${batchApts.size > 1 ? 's' : ''}`}
          </button>
        </div>
          )}
        </div>
      )}
    </div>
  );
}
