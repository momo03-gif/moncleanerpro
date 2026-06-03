'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getMissionsDB, getHotelRequestsDB, getActiveCleanersDB,
  createMissionDB, validateRequestDB, refuseRequestDB,
  getApprovedHotelsDB, getAirbnbs,
  updateMissionStatusDB, assignCleanerToMissionDB,
} from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { Mission, HotelAnnounce, MissionType, MissionSource, Apartment, MissionStatus } from '@/lib/types';
import { inputStyle } from '@/lib/ui';
import MapsModal from '@/components/MapsModal';

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

const SOURCE_LABEL: Record<string, string> = { hotel: 'Hôtel', airbnb: 'Airbnb' };

const TABS = ['Annonces hôtel', 'Missions', 'Créer'] as const;

const emptyForm = {
  source: 'hotel' as MissionSource,
  hotelId: '', airbnbId: '',
  property: '', address: '',
  cleanerId: '', date: '', time: '',
  duration: '2', price: '', cleanerGain: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// ── Carte mission admin ───────────────────────────────────────────────────────

function AdminMissionCard({ mission, cleaners, onRefresh }: {
  mission: Mission;
  cleaners: any[];
  onRefresh: () => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [newCleaner, setNewCleaner] = useState('');
  const [busy, setBusy] = useState(false);
  const [mapsOpen, setMapsOpen] = useState(false);
  const st = STATUS_CFG[mission.status] ?? STATUS_CFG.pending;

  async function changeStatus(s: MissionStatus) {
    setBusy(true);
    await updateMissionStatusDB(mission.id, s);
    onRefresh();
    setBusy(false);
  }

  async function handleAssign() {
    if (!newCleaner) return;
    const c = cleaners.find(x => x.id === newCleaner);
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
          <span className="text-xs px-2.5 py-1 rounded-lg font-semibold"
            style={{ backgroundColor: source === 'airbnb' ? '#C9A84C15' : '#F5F3EF', color: source === 'airbnb' ? '#C9A84C' : '#7A7068' }}>
            {SOURCE_LABEL[source]}
          </span>
          <span className="text-xs" style={{ color: '#A8A09A' }}>{TYPE_LABEL[mission.type] ?? mission.type}</span>
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
          style={{ backgroundColor: st.bg, color: st.color }}>
          {st.label}
        </span>
      </div>

      {/* ── Corps */}
      <div className="px-5 py-4 space-y-3">
        {/* Nom + adresse */}
        <div>
          <h3 className="font-semibold text-base" style={{ color: '#1A1A1A' }}>{mission.property || 'Mission'}</h3>
          {mission.address && (
            <button onClick={() => setMapsOpen(true)}
              className="flex items-center gap-1 mt-0.5 text-left transition-colors"
              style={{ color: '#A8A09A' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#C9A84C')}
              onMouseLeave={e => (e.currentTarget.style.color = '#A8A09A')}>
              <span className="text-xs shrink-0">◎</span>
              <span className="text-xs">{mission.address}</span>
            </button>
          )}
        </div>

        {/* Date / heure / durée */}
        <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: '#7A7068' }}>
          <span>📅 {formatDate(mission.date)}</span>
          {mission.time && <span>◷ {mission.time}</span>}
          {mission.duration > 0 && <span>⟳ {mission.duration}h</span>}
        </div>

        {/* Cleaner + Prix */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
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
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Prix client</p>
            <p className="text-sm font-semibold" style={{ color: '#5A8A6A' }}>{mission.price}€</p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Gain cleaner</p>
            <p className="text-sm font-semibold" style={{ color: '#C9A84C' }}>{mission.cleanerGain ?? 0}€</p>
          </div>
        </div>

        {/* Notes */}
        {mission.notes && (
          <div className="px-3 py-2.5 rounded-xl text-xs leading-snug" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>
            {mission.notes}
          </div>
        )}
      </div>

      {/* ── Actions */}
      {!isTerminal && (
        <div className="px-5 pb-4 border-t pt-3 space-y-2" style={{ borderColor: '#F2EFE9' }}>
          {/* Assign / réassigner */}
          {assignOpen ? (
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
              {/* Annuler toujours dispo */}
              <button onClick={() => changeStatus('cancelled')} disabled={busy}
                className="px-4 py-2.5 rounded-xl text-sm border disabled:opacity-50"
                style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>
                Annuler
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function MissionsPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('Annonces hôtel');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [requests, setRequests] = useState<HotelAnnounce[]>([]);
  const [cleaners, setCleaners] = useState<any[]>([]);
  const [hotels, setHotels] = useState<any[]>([]);
  const [airbnbs, setAirbnbs] = useState<Apartment[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedCleaner, setSelectedCleaner] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);

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
      price: a?.clientPrice ? String(a.clientPrice) : p.price,
      cleanerGain: a?.cleanerGain ? String(a.cleanerGain) : p.cleanerGain,
    }));
  }

  function calcGain(patch: Partial<typeof form>) {
    const next = { ...form, ...patch };
    const c = cleaners.find(x => x.id === next.cleanerId);
    if (c && next.source === 'hotel') {
      const dur = Number(next.duration) || 0;
      if (dur > 0) {
        next.cleanerGain = String((c.hourly_rate_hotel ?? 0) * dur);
        if (!next.price) next.price = String(dur * 40);
      }
    } else if (c && next.source === 'airbnb') {
      next.cleanerGain = String(c.rate_airbnb ?? 0);
    }
    setForm(next);
  }

  function cleanerWarning(cleanerId: string, date: string): string | null {
    if (!cleanerId || !date) return null;
    const c = cleaners.find(x => x.id === cleanerId);
    if (!c) return null;
    if (c.status === 'offline') return '⚠️ Ce cleaner est hors ligne. Vous pouvez quand même assigner.';
    if (c.status === 'busy') return 'ℹ️ Ce cleaner est actuellement en mission.';
    if (c.available_days?.length > 0) {
      const day = new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      if (!c.available_days.includes(day)) return `⚠️ Ce cleaner n'est pas disponible ce jour-là. Vous pouvez quand même assigner.`;
    }
    return null;
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const c = cleaners.find(x => x.id === form.cleanerId);
    const type: MissionType = form.source === 'airbnb' ? 'regular' : 'checkout';

    // Include airbnb access info in instructions
    let instructions: string | undefined;
    if (form.source === 'airbnb' && form.airbnbId) {
      const apt = airbnbs.find(a => a.id === form.airbnbId);
      if (apt) {
        const parts: string[] = [];
        if (apt.portalCode) parts.push(`Code portail : ${apt.portalCode}`);
        if (apt.keyboxCode) parts.push(`Boîte à clé : ${apt.keyboxCode}`);
        if (apt.entryDirectives) parts.push(apt.entryDirectives);
        if (parts.length > 0) instructions = parts.join(' · ');
      }
    }

    await createMissionDB({
      type, source: form.source,
      propertyName: form.property,
      address: form.address,
      dateFrom: form.date,
      timeFrom: form.time,
      timeTo: '',
      duration: Number(form.duration) || 2,
      cleanerId: form.cleanerId || undefined,
      cleanerName: c?.name,
      price: Number(form.price) || 0,
      cleanerGain: Number(form.cleanerGain) || 0,
      instructions,
    });

    // Fix : reset filter to 'all' BEFORE switching tab so the new mission is visible
    setFilter('all');
    setForm(emptyForm);
    await load();
    setTab('Missions');
    setCreating(false);
  }

  const pendingReqs = requests.filter(r => r.status === 'pending').length;

  const FILTERS = [
    { value: 'all',         label: 'Toutes' },
    { value: 'pending',     label: 'À assigner' },
    { value: 'accepted',    label: 'En attente' },
    { value: 'validated',   label: 'Validées' },
    { value: 'in_progress', label: 'En cours' },
    { value: 'completed',   label: 'Terminées' },
    { value: 'cancelled',   label: 'Annulées' },
  ];

  const filtered = filter === 'all'
    ? missions
    : missions.filter(m => m.status === filter);

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
                    <span className="text-xs" style={{ color: '#7A7068' }}>👥 {a.guestCount} personne{a.guestCount > 1 ? 's' : ''}</span>
                    {a.cleanerName && <span className="text-xs" style={{ color: '#C9A84C' }}>👤 {a.cleanerName}</span>}
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
          {/* Filtres */}
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
                {value !== 'all' && (
                  <span className="ml-1.5 opacity-60">
                    {missions.filter(m => value === 'all' || m.status === value).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Compteur */}
          <p className="text-xs mb-4" style={{ color: '#A8A09A' }}>
            {filtered.length} mission{filtered.length > 1 ? 's' : ''}
          </p>

          {/* Cartes */}
          {filtered.length === 0 ? (
            <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
              <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune mission pour ce filtre</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {filtered
                .sort((a, b) => b.date.localeCompare(a.date) || (a.time ?? '').localeCompare(b.time ?? ''))
                .map(m => (
                  <AdminMissionCard key={m.id} mission={m} cleaners={cleaners} onRefresh={load} />
                ))}
            </div>
          )}
        </>
      )}

      {/* ── CRÉER ── */}
      {tab === 'Créer' && (
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
                  {s === 'hotel' ? '🏨 Hôtel' : '🏠 Airbnb'}
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
                <select value={form.cleanerId} onChange={e => calcGain({ cleanerId: e.target.value })}
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
              <div className="grid grid-cols-2 gap-3">
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
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Durée</label>
                <div className="flex gap-2">
                  {['1', '2', '3', '4', '5'].map(d => (
                    <button key={d} type="button" onClick={() => calcGain({ duration: d })}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-all"
                      style={{ borderColor: form.duration === d ? '#C9A84C' : '#E8E4DC', backgroundColor: form.duration === d ? '#C9A84C' : '#FFFFFF', color: form.duration === d ? '#1A1A1A' : '#A8A09A' }}>
                      {d}h
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Prix client (€)</label>
                <input type="number" min="0" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="0" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Gain cleaner (€)</label>
                <input type="number" min="0" value={form.cleanerGain} onChange={e => setForm(p => ({ ...p, cleanerGain: e.target.value }))}
                  placeholder="0" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
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
                <select value={form.cleanerId} onChange={e => calcGain({ cleanerId: e.target.value })}
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
                <input required type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Gain cleaner (€)</label>
                <input type="number" min="0" value={form.cleanerGain} onChange={e => setForm(p => ({ ...p, cleanerGain: e.target.value }))}
                  placeholder="0" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
            </>)}
          </div>

          <button type="submit" disabled={creating}
            className="px-8 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
            style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {creating ? 'Création...' : 'Créer la mission'}
          </button>
        </form>
      )}
    </div>
  );
}
