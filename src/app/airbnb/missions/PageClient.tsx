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
import Loading from '@/components/Loading';
import { Badge, Button, Card, EmptyState, FIELD, FIELD_SM, Label, PageTitle, Segmented } from '@/components/ui';

const today = new Date().toLocaleDateString('en-CA');  // date LOCALE (pas UTC)

const STATUS_CFG = MISSION_STATUS_CFG;

// Les titres de jour collants s'arrêtent juste sous l'en-tête. La valeur vient
// du jeton `--header-h` : un `top-16` codé en dur était plus court que
// l'en-tête réel, et le titre disparaissait derrière au défilement.
const STICKY_DAY = 'sticky top-[var(--header-h)] z-10 bg-cream py-1';

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
}

/** En-tête de journée dans un planning (date + pastilles de contexte). */
function DayHeading({ day, isToday, children }: { day: string; isToday: boolean; children?: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-2 flex-wrap mb-2.5 ${STICKY_DAY}`}>
      <span className={`text-sm font-bold capitalize ${isToday ? 'text-gold-ink' : 'text-ink'}`}>{formatDate(day)}</span>
      {isToday && <Badge tone="gold" size="sm">Aujourd&apos;hui</Badge>}
      {children}
    </div>
  );
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
    <Card className="overflow-hidden">
      <div className="px-5 py-3.5 flex items-center justify-between gap-2 border-b border-hairline">
        <span className="text-sm font-semibold truncate text-ink">{mission.property || 'Mission'}</span>
        <Badge style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</Badge>
      </div>

      <div className="px-5 py-4">
        {mission.address && (
          <p className="text-xs mb-2 truncate flex items-center gap-1.5 text-muted">
            <Icon name="pin" size={12} className="shrink-0" /> {mission.address}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>{formatDate(mission.date)}</span>
          {mission.time && <span>Départ {formatHour(mission.time)}</span>}
        </div>
        {mission.nextArrival && (
          mission.nextArrival === mission.date ? (
            <p className="mt-2 px-3 py-2 rounded-lg text-xs font-bold bg-danger-soft text-danger">
              Arrivée client le jour même{mission.nextArrivalTime ? ` à ${formatHour(mission.nextArrivalTime)}` : ''}
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted">
              Prochaine arrivée : {formatDate(mission.nextArrival)}{mission.nextArrivalTime ? ` à ${formatHour(mission.nextArrivalTime)}` : ''}
            </p>
          )
        )}
        {mission.cleanerName && (
          <p className="text-xs mt-2 text-muted">Cleaner : <span className="font-semibold text-gold-ink">{mission.cleanerName}</span></p>
        )}

        {error && <p role="alert" className="text-xs mt-3 px-3 py-2 rounded-lg bg-danger-soft text-danger">{error}</p>}

        {/* Mission verrouillée : consultation uniquement */}
        {locked ? (
          <>
            <p className="mt-3 px-3 py-2 rounded-lg text-xs flex items-center gap-2 bg-surface-2 text-muted">
              {/* Le cadenas était un emoji 🔒, contraire à la règle « pas d'emoji »
                  du jeu d'icônes, et rendu différemment selon la plateforme. */}
              <span className="shrink-0" aria-hidden="true"><Icon name="lock" size={13} /></span>
              Mission {mission.status === 'completed' ? 'terminée' : 'annulée'} — elle ne peut plus être modifiée ni supprimée.
            </p>
            {mission.status === 'completed' && (
              <div className="mt-3"><MissionReport missionId={mission.id} mode="viewer" /></div>
            )}
          </>
        ) : editOpen ? (
          /* Formulaire de modification (créateur) */
          <div className="mt-3 space-y-3 rounded-xl p-3 bg-surface-2">
            <div>
              <Label htmlFor={`m-apt-${mission.id}`}>Appartement</Label>
              <select id={`m-apt-${mission.id}`} value={form.airbnbId}
                onChange={e => setForm(f => ({ ...f, airbnbId: e.target.value }))}
                className={`${FIELD_SM} appearance-none`}>
                <option value="">Sélectionner un appartement</option>
                {apartments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor={`m-date-${mission.id}`}>Date</Label>
                <input id={`m-date-${mission.id}`} type="date" value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={FIELD_SM} />
              </div>
              <div>
                <Label htmlFor={`m-time-${mission.id}`}>Heure départ clients</Label>
                <select id={`m-time-${mission.id}`} value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className={`${FIELD_SM} appearance-none`}>
                  <option value="">Choisir</option>
                  {DEPARTURE_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label>Prochaine arrivée — optionnel</Label>
              <div className="grid grid-cols-2 gap-2">
                <input type="date" aria-label="Date de la prochaine arrivée" value={form.nextArrival}
                  min={form.date || undefined}
                  onChange={e => setForm(f => ({ ...f, nextArrival: e.target.value }))} className={FIELD_SM} />
                <select aria-label="Heure de la prochaine arrivée" value={form.nextArrivalTime}
                  onChange={e => setForm(f => ({ ...f, nextArrivalTime: e.target.value }))}
                  className={`${FIELD_SM} appearance-none`}>
                  <option value="">Heure d&apos;arrivée</option>
                  {ARRIVAL_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
                </select>
              </div>
            </div>
            <div>
              <Label htmlFor={`m-notes-${mission.id}`}>Consignes — optionnel</Label>
              <textarea id={`m-notes-${mission.id}`} value={form.instructions}
                onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))} rows={2}
                className={`${FIELD_SM} resize-none`} />
            </div>
            <div className="flex gap-2">
              <Button onClick={save} disabled={busy} className="flex-1">{busy ? '...' : 'Enregistrer'}</Button>
              <Button variant="ghost" onClick={() => { setEditOpen(false); setError(''); }} disabled={busy}>Annuler</Button>
            </div>
          </div>
        ) : (
          /* Actions : Modifier / Supprimer */
          <div className="flex gap-2 mt-3">
            <Button variant="ghost" size="sm" onClick={openEdit} disabled={busy} className="flex-1">Modifier</Button>
            <Button variant="danger" size="sm" onClick={remove} disabled={busy}>Supprimer</Button>
          </div>
        )}
      </div>
    </Card>
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
    <div className="p-5 flex flex-col items-center justify-center min-h-[60vh] text-center mcp-in">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-success-soft text-success">
        <Icon name="check" size={24} />
      </div>
      <h2 className="text-lg font-bold mb-1 text-ink">Mission créée</h2>
      <p className="text-sm mb-6 text-muted">Elle sera assignée à un cleaner par l&apos;équipe.</p>
      <div className="flex gap-2">
        <Button onClick={() => { setSubmitted(false); setTab('track'); }}>Voir mes missions</Button>
        <Button variant="ghost" onClick={() => { setSubmitted(false); setTab('create'); }}>Nouvelle</Button>
      </div>
    </div>
  );

  return (
    <div className="p-5 mcp-in">
      <PageTitle title="Planning" subtitle="Arrivées, départs et ménages de vos logements" />

      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-6"
        options={[
          ['reservations', 'Réservations'],
          ['track', 'Ménages'],
          ['create', 'Créer'],
        ] as const}
      />

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
            <EmptyState icon="calendar"
              title="Aucune arrivée ni départ à venir"
              hint="Connectez vos calendriers dans « Synchro »." />
          );
        }

        return (
          <div className="space-y-6">
            <div className="flex items-center gap-4 text-[11px] flex-wrap text-muted">
              <span className="flex items-center gap-1"><span className="inline-flex text-success"><Icon name="arrowUp" size={13} /></span> Arrivée</span>
              <span className="flex items-center gap-1"><span className="inline-flex text-warn"><Icon name="arrowDown" size={13} /></span> Départ</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block bg-danger" /> Turnover</span>
            </div>
            {days.map(day => {
              const evs = byDay[day];
              const departures = evs.filter(e => e.kind === 'out');
              const arrivals = evs.filter(e => e.kind === 'in');
              const isToday = day === t;
              const turnover = departures.some(e => arrivalsByDay.has(e.res.checkOut));
              return (
                <div key={day}>
                  <DayHeading day={day} isToday={isToday}>
                    {turnover && <Badge tone="danger" size="sm">turnover</Badge>}
                  </DayHeading>
                  <div className="space-y-2">
                    {departures.map(e => {
                      const r = e.res;
                      const isTurn = arrivalsByDay.has(r.checkOut);
                      const m = r.missionId ? missionById.get(r.missionId) : undefined;
                      const cfg = m ? (STATUS_CFG[m.status] ?? STATUS_CFG.pending) : null;
                      return (
                        <Card key={'out' + r.id} tone={isTurn ? 'alert' : 'plain'} className="px-4 py-3 flex items-center gap-3">
                          <span className="shrink-0 inline-flex text-warn" aria-hidden="true"><Icon name="arrowDown" size={15} /></span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate text-ink">{r.apartmentName ?? 'Logement'}</p>
                            <p className="text-xs mt-0.5 text-muted">
                              Départ{r.checkOutTime ? ` ${formatHour(r.checkOutTime)}` : ''}
                              {isTurn && <span className="font-semibold text-danger"> · arrivée le jour même</span>}
                            </p>
                          </div>
                          {m && cfg
                            ? <button onClick={() => router.push(`/airbnb/mission/${m.id}`)} className="shrink-0">
                                <Badge style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</Badge>
                              </button>
                            /* « ménage à créer » était en #C48A2A : 3:1 sur blanc,
                               sous le seuil AA pour du texte de cette taille. */
                            : <span className="text-[11px] shrink-0 font-semibold text-warn">ménage à créer</span>}
                        </Card>
                      );
                    })}
                    {arrivals.map(e => {
                      const r = e.res;
                      return (
                        <Card key={'in' + r.id} className="px-4 py-3 flex items-center gap-3">
                          <span className="shrink-0 inline-flex text-success" aria-hidden="true"><Icon name="arrowUp" size={15} /></span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate text-ink">{r.apartmentName ?? 'Logement'}</p>
                            <p className="text-xs mt-0.5 text-muted">Arrivée{r.checkInTime ? ` ${formatHour(r.checkInTime)}` : ''}</p>
                          </div>
                        </Card>
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
          <EmptyState icon="building"
            title="Aucun appartement"
            hint="Ajoutez d'abord un appartement dans l'onglet « Logements »."
            action={<Button onClick={() => router.push('/airbnb')}>Ajouter un appartement</Button>} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="new-apt">Appartement</Label>
              <select id="new-apt" value={airbnbId} onChange={e => setAirbnbId(e.target.value)}
                className={`${FIELD} appearance-none`}>
                <option value="">Sélectionner un appartement</option>
                {apartments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {airbnbId && (() => {
              const a = apartments.find(x => x.id === airbnbId);
              if (!a) return null;
              return (
                <div className="rounded-xl p-4 text-sm space-y-1.5 bg-surface-2 text-muted">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Coordonnées reprises automatiquement</p>
                  <p className="font-semibold text-ink">{a.name}</p>
                  <p className="text-xs flex items-center gap-1.5"><Icon name="pin" size={12} className="shrink-0" /> {a.address}</p>
                  {a.clientPrice != null && <p className="text-xs font-semibold text-success">{a.clientPrice}€ / ménage</p>}
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
                <Label htmlFor="new-date">Date</Label>
                <input id="new-date" type="date" value={date} min={today} required
                  onChange={e => setDate(e.target.value)} className={FIELD} />
              </div>
              <div>
                <Label htmlFor="new-time">Heure départ clients</Label>
                <select id="new-time" value={time} required onChange={e => setTime(e.target.value)}
                  className={`${FIELD} appearance-none`}>
                  <option value="">Choisir</option>
                  {DEPARTURE_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
                </select>
              </div>
            </div>

            <div>
              <Label>Prochaine arrivée client — optionnel</Label>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" aria-label="Date de la prochaine arrivée" value={nextArrival}
                  min={date || today} onChange={e => setNextArrival(e.target.value)} className={FIELD} />
                <select aria-label="Heure de la prochaine arrivée" value={nextArrivalTime}
                  onChange={e => setNextArrivalTime(e.target.value)} className={`${FIELD} appearance-none`}>
                  <option value="">Heure d&apos;arrivée</option>
                  {ARRIVAL_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
                </select>
              </div>
              {nextArrival && date && nextArrival === date && (
                <p className="text-xs mt-2 px-3 py-2 rounded-lg font-semibold bg-danger-soft text-danger">
                  Arrivée le jour même du ménage — turnover urgent
                </p>
              )}
            </div>

            <div>
              {/* La case à cocher était un <div onClick> : invisible au clavier et
                  jamais annoncée comme case à cocher. C'est maintenant un vrai
                  input, masqué visuellement mais focusable, avec un pavé stylé. */}
              <label className="flex items-center gap-3 cursor-pointer select-none w-fit">
                <input type="checkbox" checked={hasInstructions}
                  onChange={e => setHasInstructions(e.target.checked)} className="sr-only peer" />
                <span
                  aria-hidden="true"
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-gold ${
                    hasInstructions ? 'border-gold bg-gold text-ink' : 'border-line bg-card'
                  }`}
                >
                  {hasInstructions && <Icon name="check" size={13} strokeWidth={3} />}
                </span>
                <span className="text-sm font-medium text-ink">Ajouter des consignes</span>
              </label>
              {hasInstructions && (
                <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3} autoFocus
                  aria-label="Consignes pour le cleaner"
                  placeholder="Ex : check-out 11h, linge dans le placard du couloir..."
                  className={`${FIELD} mt-3 resize-none`} />
              )}
            </div>

            {error && <p role="alert" className="text-xs text-center py-2 px-3 rounded-lg bg-danger-soft text-danger">{error}</p>}

            <Button type="submit" size="lg" disabled={saving}>
              {saving ? 'Création...' : 'Créer la mission'}
            </Button>
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
          <p className="text-xs mb-4 text-muted">
            {visibleMissions.length} mission{visibleMissions.length > 1 ? 's' : ''} sur cette période
          </p>

          {visibleMissions.length === 0 ? (
            <EmptyState icon="missions"
              title="Aucune mission sur cette période"
              hint={outOfRangeCount > 0 && allDates.length > 0 ? undefined : 'Créez votre première mission'}
              action={outOfRangeCount > 0 && allDates.length > 0 ? (
                <Button onClick={() => setRange({ start: allDates[0], end: allDates[allDates.length - 1] })}>
                  Voir mes {outOfRangeCount} mission{outOfRangeCount > 1 ? 's' : ''} sur d&apos;autres dates
                </Button>
              ) : undefined} />
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
                    <DayHeading day={day} isToday={isToday}>
                      <span className="text-xs text-muted">· {dayMissions.length} ménage{dayMissions.length > 1 ? 's' : ''}</span>
                      {turnover && <Badge tone="danger" size="sm">turnover</Badge>}
                    </DayHeading>
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
