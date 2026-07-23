'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedback } from '@/contexts/FeedbackContext';
import { useRouter } from 'next/navigation';
import { getAirbnbsForPartner, getMissionsForPartnerDB, getReservationsForPartner, createAirbnbMissionDB, updateMissionDB, deleteMissionDB, isMissionLocked } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { Apartment, Mission, Reservation } from '@/lib/types';
import DateRangeFilter from '@/components/DateRangeFilter';
import { presetRange, inRange, type DateRange } from '@/lib/dateRange';
import { formatHour, DEPARTURE_TIMES, ARRIVAL_TIMES } from '@/lib/format';
import { MISSION_STATUS_CFG } from '@/lib/labels';
import Icon from '@/components/Icon';
import MissionReport from '@/components/MissionReport';
import Loading from "@/components/Loading";

const inputStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E8E4DC', color: '#1A1A1A', outline: 'none' } as const;
const today = new Date().toLocaleDateString('en-CA');  // date LOCALE (pas UTC)

const STATUS_CFG = MISSION_STATUS_CFG;

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
}

// ── Carte mission partenaire (consultation + modification/suppression) ──────────
// Le partenaire (créateur) peut modifier ou supprimer tant que la mission n'est
// pas terminée/annulée. Au-delà, elle est verrouillée (donnée de facturation).
function PartnerMissionCard({ mission, apartments, userId, onRefresh }: {
  mission: Mission;
  apartments: Apartment[];
  userId: string;
  onRefresh: () => void;
}) {
  const { confirm, toast } = useFeedback();
  const st = STATUS_CFG[mission.status] ?? STATUS_CFG.pending;
  const locked = isMissionLocked(mission.status);
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    airbnbId: mission.airbnbId ?? '',
    date: mission.date,
    time: mission.time,
    nextArrival: mission.nextArrival ?? '',
    nextArrivalTime: mission.nextArrivalTime ?? '',
    instructions: mission.instructionsRaw ?? '',
  });

  function openEdit() {
    setForm({
      airbnbId: mission.airbnbId ?? '',
      date: mission.date,
      time: mission.time,
      nextArrival: mission.nextArrival ?? '',
      nextArrivalTime: mission.nextArrivalTime ?? '',
      instructions: mission.instructionsRaw ?? '',
    });
    setError('');
    setEditOpen(true);
  }

  async function save() {
    if (!form.airbnbId) { setError('Sélectionnez un appartement.'); return; }
    if (!form.date) { setError('Choisissez une date.'); return; }
    if (!form.time) { setError('Choisissez une heure.'); return; }
    setBusy(true); setError('');
    const res = await updateMissionDB(mission.id, { id: userId, role: 'airbnb' }, {
      airbnbId: form.airbnbId,
      dateFrom: form.date,
      timeFrom: form.time,
      instructions: form.instructions,
      nextArrival: form.nextArrival || null,
      nextArrivalTime: form.nextArrivalTime || null,
    });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setEditOpen(false);
    onRefresh();
  }

  async function remove() {
    const ok = await confirm({ title: 'Supprimer cette mission ?', message: 'Cette action est définitive.', confirmLabel: 'Supprimer', danger: true });
    if (!ok) return;
    setBusy(true); setError('');
    const res = await deleteMissionDB(mission.id, { id: userId, role: 'airbnb' });
    setBusy(false);
    if (res.error) { setError(res.error); toast(res.error, 'error'); return; }
    toast('Mission supprimée.', 'success');
    onRefresh();
  }

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      <div className="px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: '#F2EFE9' }}>
        <span className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{mission.property || 'Mission'}</span>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold shrink-0" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
      </div>

      <div className="px-5 py-4">
        {mission.address && <p className="text-xs mb-2 truncate flex items-center gap-1.5" style={{ color: '#A8A09A' }}><Icon name="pin" size={12} className="shrink-0" /> {mission.address}</p>}
        <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: '#7A7068' }}>
          <span>{formatDate(mission.date)}</span>
          {mission.time && <span>Départ {formatHour(mission.time)}</span>}
        </div>
        {mission.nextArrival && (
          mission.nextArrival === mission.date ? (
            <p className="mt-2 px-3 py-2 rounded-lg text-xs font-bold" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
              Arrivée client le jour même{mission.nextArrivalTime ? ` à ${formatHour(mission.nextArrivalTime)}` : ''}
            </p>
          ) : (
            <p className="mt-2 text-xs" style={{ color: '#7A7068' }}>
              Prochaine arrivée : {formatDate(mission.nextArrival)}{mission.nextArrivalTime ? ` à ${formatHour(mission.nextArrivalTime)}` : ''}
            </p>
          )
        )}
        {mission.cleanerName && <p className="text-xs mt-2" style={{ color: '#A8A09A' }}>Cleaner : <span style={{ color: '#C9A84C', fontWeight: 600 }}>{mission.cleanerName}</span></p>}

        {error && <p className="text-xs mt-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#B85A50' }}>{error}</p>}

        {/* Mission verrouillée : consultation uniquement */}
        {locked ? (
          <>
            <p className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>
              🔒 Mission {mission.status === 'completed' ? 'terminée' : 'annulée'} — elle ne peut plus être modifiée ni supprimée.
            </p>
            {mission.status === 'completed' && (
              <div className="mt-3"><MissionReport missionId={mission.id} mode="viewer" /></div>
            )}
          </>
        ) : editOpen ? (
          /* Formulaire de modification (créateur) */
          <div className="mt-3 space-y-3 rounded-xl p-3" style={{ backgroundColor: '#F8F6F2' }}>
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Appartement</label>
              <select value={form.airbnbId} onChange={e => setForm(f => ({ ...f, airbnbId: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg text-sm border appearance-none" style={inputStyle}>
                <option value="">Sélectionner un appartement</option>
                {apartments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Date</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Heure départ clients</label>
                <select value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border appearance-none" style={inputStyle}>
                  <option value="">Choisir</option>
                  {DEPARTURE_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Prochaine arrivée — optionnel</label>
              <div className="grid grid-cols-2 gap-2" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <input type="date" value={form.nextArrival} min={form.date || undefined} onChange={e => setForm(f => ({ ...f, nextArrival: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
                <select value={form.nextArrivalTime} onChange={e => setForm(f => ({ ...f, nextArrivalTime: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border appearance-none" style={inputStyle}>
                  <option value="">Heure d&apos;arrivée</option>
                  {ARRIVAL_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Consignes — optionnel</label>
              <textarea value={form.instructions} onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} rows={2}
                className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={inputStyle} />
            </div>
            <div className="flex gap-2">
              <button onClick={save} disabled={busy}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                {busy ? '...' : 'Enregistrer'}
              </button>
              <button onClick={() => { setEditOpen(false); setError(''); }} disabled={busy}
                className="px-4 py-2.5 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Annuler</button>
            </div>
          </div>
        ) : (
          /* Actions : Modifier / Supprimer */
          <div className="flex gap-2 mt-3">
            <button onClick={openEdit} disabled={busy}
              className="flex-1 py-2 rounded-xl text-xs font-medium border disabled:opacity-50" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
              Modifier
            </button>
            <button onClick={remove} disabled={busy}
              className="px-4 py-2 rounded-xl text-xs font-medium border disabled:opacity-50" style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>
              Supprimer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AirbnbMissionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'reservations' | 'track' | 'create'>('reservations');
  const [range, setRange] = useState<DateRange>(() => presetRange('today'));

  const [airbnbId, setAirbnbId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [nextArrival, setNextArrival] = useState('');
  const [nextArrivalTime, setNextArrivalTime] = useState('');
  const [hasInstructions, setHasInstructions] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [a, m, r] = await Promise.all([
      getAirbnbsForPartner(user.id),
      getMissionsForPartnerDB(user.id),
      getReservationsForPartner(user.id),
    ]);
    setApartments(a);
    setMissions(m);
    setReservations(r);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase.channel('partner-missions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, user]);

  // Ouverture directe d'un onglet via ?tab= (ex. « Commander » → create,
  // « ménages en attente » → track). Lu côté client pour éviter Suspense.
  useEffect(() => {
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (tabParam === 'create' || tabParam === 'track' || tabParam === 'reservations') setTab(tabParam);
  }, []);

  function resetForm() {
    setAirbnbId(''); setDate(''); setTime('');
    setNextArrival(''); setNextArrivalTime('');
    setHasInstructions(false); setInstructions(''); setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!airbnbId) { setError('Sélectionnez un appartement.'); return; }
    if (!date) { setError('Choisissez une date.'); return; }
    if (!time) { setError('Choisissez une heure.'); return; }
    setSaving(true); setError('');
    const apt = apartments.find(a => a.id === airbnbId);
    const res = await createAirbnbMissionDB({
      partnerId: user.id,
      partnerName: user.name,
      airbnbId,
      dateFrom: date,
      timeFrom: time,
      instructions: hasInstructions ? instructions : undefined,
      price: apt?.clientPrice,  // prix repris automatiquement de l'appartement
      nextArrival: nextArrival || undefined,
      nextArrivalTime: nextArrivalTime || undefined,
    });
    if (res.error) { setError(`Erreur : ${res.error}`); setSaving(false); return; }
    resetForm();
    await load();
    setSubmitted(true);
    setSaving(false);
  }

  if (loading) return <Loading className="p-5 pt-8" variant="skeleton" />;

  if (submitted) return (
    <div className="p-5 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#5A8A6A15', color: '#5A8A6A' }}>
        <Icon name="check" size={24} />
      </div>
      <h2 className="text-lg font-bold mb-1" style={{ color: '#1A1A1A' }}>Mission créée</h2>
      <p className="text-sm mb-6" style={{ color: '#A8A09A' }}>Elle sera assignée à un cleaner par l'équipe.</p>
      <div className="flex gap-2">
        <button onClick={() => { setSubmitted(false); setTab('track'); }} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Voir mes missions</button>
        <button onClick={() => { setSubmitted(false); setTab('create'); }} className="px-5 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Nouvelle</button>
      </div>
    </div>
  );

  return (
    <div className="p-5 mcp-in">
      <div className="mb-5 pt-2">
        <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Planning</h1>
        <p className="text-sm mt-0.5" style={{ color: '#A8A09A' }}>Arrivées, départs et ménages de vos logements</p>
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
        {([['reservations', 'Réservations'], ['track', 'Ménages'], ['create', 'Créer']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ backgroundColor: tab === v ? '#FFFFFF' : 'transparent', color: tab === v ? '#1A1A1A' : '#A8A09A', boxShadow: tab === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── PLANNING RÉSERVATIONS (arrivées + départs, 14 jours) ────────── */}
      {tab === 'reservations' && (() => {
        const t = today;
        const horizon = (() => { const d = new Date(); d.setDate(d.getDate() + 14); return d.toLocaleDateString('en-CA'); })();
        const confirmed = reservations.filter(r => r.status === 'confirmed');
        const arrivalsByDay = new Set(confirmed.map(r => r.checkIn));
        const missionById = new Map(missions.map(m => [m.id, m]));

        type Ev = { day: string; kind: 'in' | 'out'; res: Reservation };
        const events: Ev[] = [];
        for (const r of confirmed) {
          if (r.checkIn >= t && r.checkIn <= horizon) events.push({ day: r.checkIn, kind: 'in', res: r });
          if (r.checkOut >= t && r.checkOut <= horizon) events.push({ day: r.checkOut, kind: 'out', res: r });
        }
        const byDay = events.reduce((acc, e) => { (acc[e.day] ??= []).push(e); return acc; }, {} as Record<string, Ev[]>);
        const days = Object.keys(byDay).sort();

        if (days.length === 0) {
          return (
            <div className="rounded-2xl p-10 flex flex-col items-center text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
              <span className="mb-3" style={{ color: '#D4CEC4' }}><Icon name="calendar" size={30} /></span>
              <p className="font-medium text-sm" style={{ color: '#1A1A1A' }}>Aucune arrivée ni départ à venir</p>
              <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Connectez vos calendriers dans « Synchro ».</p>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 text-[11px]" style={{ color: '#A8A09A' }}>
              <span className="flex items-center gap-1"><span className="inline-flex" style={{ color: '#5A8A6A' }}><Icon name="arrowUp" size={13} /></span> Arrivée</span>
              <span className="flex items-center gap-1"><span className="inline-flex" style={{ color: '#C48A2A' }}><Icon name="arrowDown" size={13} /></span> Départ</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: '#B91C1C' }} /> Turnover</span>
            </div>
            {days.map(day => {
              const evs = byDay[day];
              const departures = evs.filter(e => e.kind === 'out');
              const arrivals = evs.filter(e => e.kind === 'in');
              const isToday = day === t;
              const turnover = departures.some(e => arrivalsByDay.has(e.res.checkOut));
              return (
                <div key={day}>
                  <div className="flex items-center gap-2 mb-2.5 sticky top-16 py-1 z-10" style={{ backgroundColor: '#FAFAF8' }}>
                    <span className="text-sm font-bold capitalize" style={{ color: isToday ? '#C9A84C' : '#1A1A1A' }}>{formatDate(day)}</span>
                    {isToday && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Aujourd&apos;hui</span>}
                    {turnover && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>turnover</span>}
                  </div>
                  <div className="space-y-2">
                    {departures.map(e => {
                      const r = e.res;
                      const isTurn = arrivalsByDay.has(r.checkOut);
                      const m = r.missionId ? missionById.get(r.missionId) : undefined;
                      const cfg = m ? (STATUS_CFG[m.status] ?? STATUS_CFG.pending) : null;
                      return (
                        <div key={'out' + r.id} className="rounded-2xl border px-4 py-3 flex items-center gap-3" style={{ backgroundColor: '#FFFFFF', borderColor: isTurn ? '#EAC4BE' : '#E8E4DC' }}>
                          <span className="shrink-0 inline-flex" style={{ color: '#C48A2A' }}><Icon name="arrowDown" size={15} /></span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{r.apartmentName ?? 'Logement'}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>Départ{r.checkOutTime ? ` ${formatHour(r.checkOutTime)}` : ''}{isTurn && <span style={{ color: '#B85A50', fontWeight: 600 }}> · arrivée le jour même</span>}</p>
                          </div>
                          {m && cfg
                            ? <button onClick={() => router.push(`/airbnb/mission/${m.id}`)} className="text-[11px] px-2.5 py-1 rounded-full font-semibold shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</button>
                            : <span className="text-[11px] shrink-0" style={{ color: '#C48A2A' }}>ménage à créer</span>}
                        </div>
                      );
                    })}
                    {arrivals.map(e => {
                      const r = e.res;
                      return (
                        <div key={'in' + r.id} className="rounded-2xl border px-4 py-3 flex items-center gap-3" style={{ backgroundColor: '#FCFBF8', borderColor: '#E8E4DC' }}>
                          <span className="shrink-0 inline-flex" style={{ color: '#5A8A6A' }}><Icon name="arrowUp" size={15} /></span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{r.apartmentName ?? 'Logement'}</p>
                            <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>Arrivée{r.checkInTime ? ` ${formatHour(r.checkInTime)}` : ''}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {tab === 'create' && (
        apartments.length === 0 ? (
          <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
            <p className="text-sm" style={{ color: '#A8A09A' }}>Ajoutez d'abord un appartement dans l'onglet « Appartements ».</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Appartement</label>
              <select value={airbnbId} onChange={e => setAirbnbId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
                style={{ ...inputStyle, color: airbnbId ? '#1A1A1A' : '#A8A09A' }}>
                <option value="">Sélectionner un appartement</option>
                {apartments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {airbnbId && (() => {
              const a = apartments.find(x => x.id === airbnbId);
              if (!a) return null;
              return (
                <div className="rounded-xl p-4 text-sm space-y-1.5" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#A8A09A' }}>Coordonnées reprises automatiquement</p>
                  <p style={{ color: '#1A1A1A', fontWeight: 600 }}>{a.name}</p>
                  <p className="text-xs flex items-center gap-1.5"><Icon name="pin" size={12} className="shrink-0" /> {a.address}</p>
                  {a.clientPrice != null && <p className="text-xs font-semibold" style={{ color: '#5A8A6A' }}>{a.clientPrice}€ / ménage</p>}
                  {(a.bedrooms != null || a.beds != null || a.sofaBeds != null) && (
                    <p className="text-xs">
                      {a.bedrooms != null && <>{a.bedrooms} ch.</>}
                      {a.bedrooms != null && (a.beds != null || a.sofaBeds != null) && ' · '}
                      {a.beds != null && <>{a.beds} lit{a.beds > 1 ? 's' : ''}</>}
                      {a.beds != null && a.sofaBeds != null && ' · '}
                      {a.sofaBeds != null && <>{a.sofaBeds} canapé-lit{a.sofaBeds > 1 ? 's' : ''}</>}
                    </p>
                  )}
                  {a.portalCode && <p className="text-xs">Portail : <span className="font-mono">{a.portalCode}</span></p>}
                  {a.keyboxCode && <p className="text-xs">Clé : <span className="font-mono">{a.keyboxCode}</span></p>}
                  {a.entryDirectives && <p className="text-xs">Entrée : {a.entryDirectives}</p>}
                  {a.notes && <p className="text-xs">Notes : {a.notes}</p>}
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Date</label>
                <input type="date" value={date} min={today} required onChange={e => setDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Heure départ clients</label>
                <select value={time} required onChange={e => setTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
                  style={{ ...inputStyle, color: time ? '#1A1A1A' : '#A8A09A' }}>
                  <option value="">Choisir</option>
                  {DEPARTURE_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Prochaine arrivée client — optionnel</label>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={nextArrival} min={date || today} onChange={e => setNextArrival(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
                <select value={nextArrivalTime} onChange={e => setNextArrivalTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
                  style={{ ...inputStyle, color: nextArrivalTime ? '#1A1A1A' : '#A8A09A' }}>
                  <option value="">Heure d&apos;arrivée</option>
                  {ARRIVAL_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
                </select>
              </div>
              {nextArrival && date && nextArrival === date && (
                <p className="text-xs mt-2 px-3 py-2 rounded-lg font-semibold" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
                  Arrivée le jour même du ménage — turnover urgent
                </p>
              )}
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div onClick={() => setHasInstructions(v => !v)}
                  className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all"
                  style={{ borderColor: hasInstructions ? '#C9A84C' : '#C8C2BA', backgroundColor: hasInstructions ? '#C9A84C' : '#FFFFFF' }}>
                  {hasInstructions && <span className="text-xs font-bold" style={{ color: '#1A1A1A' }}>✓</span>}
                </div>
                <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>Ajouter des consignes</span>
              </label>
              {hasInstructions && (
                <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3} autoFocus
                  placeholder="Ex : check-out 11h, linge dans le placard du couloir..."
                  className="w-full mt-3 px-4 py-3 rounded-xl text-sm border resize-none" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              )}
            </div>

            {error && <p className="text-xs text-center py-2 px-3 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#B85A50' }}>{error}</p>}

            <button type="submit" disabled={saving} className="w-full py-4 rounded-xl font-semibold text-sm disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
              {saving ? 'Création...' : 'Créer la mission'}
            </button>
          </form>
        )
      )}

      {tab === 'track' && (() => {
        const visibleMissions = missions
          .filter(m => inRange(m.date, range))
          .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
        const allDates = missions.map(m => m.date).filter(Boolean).sort();
        const outOfRangeCount = missions.length - visibleMissions.length;

        return (
        <>
          <DateRangeFilter start={range.start} end={range.end} onChange={setRange} className="mb-4" />
          <p className="text-xs mb-4" style={{ color: '#A8A09A' }}>
            {visibleMissions.length} mission{visibleMissions.length > 1 ? 's' : ''} sur cette période
          </p>

          {visibleMissions.length === 0 ? (
            <div className="rounded-2xl p-10 flex flex-col items-center text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
              <span className="mb-3" style={{ color: '#D4CEC4' }}><Icon name="missions" size={30} /></span>
              <p className="font-medium text-sm" style={{ color: '#1A1A1A' }}>Aucune mission sur cette période</p>
              {outOfRangeCount > 0 && allDates.length > 0 ? (
                <button onClick={() => setRange({ start: allDates[0], end: allDates[allDates.length - 1] })}
                  className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                  Voir mes {outOfRangeCount} mission{outOfRangeCount > 1 ? 's' : ''} sur d'autres dates →
                </button>
              ) : (
                <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Créez votre première mission</p>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Planning : missions regroupées par jour (agenda). */}
              {Object.entries(
                visibleMissions.reduce((acc, m) => {
                  (acc[m.date] ??= []).push(m);
                  return acc;
                }, {} as Record<string, Mission[]>),
              ).map(([day, dayMissions]) => {
                const turnover = dayMissions.some(m => m.nextArrival && m.nextArrival === m.date);
                const isToday = day === today;
                return (
                  <div key={day}>
                    <div className="flex items-center gap-2 mb-2.5 sticky top-16 py-1 z-10" style={{ backgroundColor: '#FAFAF8' }}>
                      <span className="text-sm font-bold capitalize" style={{ color: isToday ? '#C9A84C' : '#1A1A1A' }}>
                        {formatDate(day)}
                      </span>
                      {isToday && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Aujourd&apos;hui</span>}
                      <span className="text-xs" style={{ color: '#A8A09A' }}>· {dayMissions.length} ménage{dayMissions.length > 1 ? 's' : ''}</span>
                      {turnover && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>turnover</span>}
                    </div>
                    <div className="space-y-3">
                      {dayMissions.map(m => (
                        <PartnerMissionCard key={m.id} mission={m} apartments={apartments} userId={user?.id ?? ''} onRefresh={load} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
        );
      })()}
    </div>
  );
}
