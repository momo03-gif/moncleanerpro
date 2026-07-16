'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getMissionsDB, getHotelRequestsDB, getActiveCleanersDB,
  createMissionDB, createMissionsBatchDB, validateRequestDB, refuseRequestDB,
  getApprovedHotelsDB, getAirbnbs,
  updateMissionStatusDB, assignCleanerToMissionDB, assignCleanerToMissionsDB,
  updateMissionDB, deleteMissionDB, reopenMissionDB, resolveExtraTimeDB, addMissionTimeDB,
  updateMissionsOrderDB, createAppointmentDB, getAssignableStaffDB, createOneShotMissionDB,
} from '@/lib/db';
import { listRecurringDB, createRecurringDB, updateRecurringDB, setRecurringActiveDB, deleteRecurringDB, generateRecurringMissions } from '@/lib/recurring';
import { geocodeAddress } from '@/lib/zones';
import type { RecurringMission } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Mission, HotelAnnounce, MissionType, MissionSource, MissionService, Apartment, MissionStatus } from '@/lib/types';
import { serviceLabel, SERVICE_LABEL, SERVICE_BADGE, canCleanerDoService, serviceParts } from '@/lib/service';
import Icon from '@/components/Icon';
import { computeMissionGain, DURATION_PRESETS } from '@/lib/pay';
import { groupMissionsByCleaner } from '@/lib/missionOrder';
import { formatDuration, formatHour, DEPARTURE_TIMES, ARRIVAL_TIMES } from '@/lib/format';
import { inputStyle } from '@/lib/ui';
import MapsModal from '@/components/MapsModal';
import MissionPhotos from '@/components/MissionPhotos';
import MissionReport from '@/components/MissionReport';
import DateRangeFilter from '@/components/DateRangeFilter';
import { presetRange, inRange, type DateRange } from '@/lib/dateRange';
import { MISSION_STATUS_CFG, MISSION_TYPE_LABEL, MISSION_SOURCE_LABEL, missionStatusLabel, missionOriginLabel } from '@/lib/labels';
import { getMissionIncidentsDB, createIncidentDB, deleteIncidentDB, INCIDENT_LABEL, type RhIncidentType, type RhIncident } from '@/lib/rhApi';
import Loading from "@/components/Loading";

// Libellés statuts/types des missions : centralisés (lib/labels.ts).
const STATUS_CFG = MISSION_STATUS_CFG;
const TYPE_LABEL = MISSION_TYPE_LABEL;

// Statuts des DEMANDES hôtel (hotel_requests) — domaine distinct des missions.
const ST_REQ: Record<string, { label: string; color: string }> = {
  pending:     { label: 'En attente', color: '#C48A2A' },
  validated:   { label: 'Acceptée',   color: '#5B6EF5' },
  in_progress: { label: 'En cours',   color: '#C9A84C' },
  completed:   { label: 'Terminée',   color: '#5A8A6A' },
  refused:     { label: 'Refusée',    color: '#B85A50' },
  cancelled:   { label: 'Annulée',    color: '#8A8178' },
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

const SOURCE_LABEL = MISSION_SOURCE_LABEL;

const TABS = ['Demandes hôtel', 'Missions', 'Créer'] as const;

const emptyForm = {
  source: 'hotel' as MissionSource,
  service: 'cleaning' as MissionService,  // ménage ou livraison
  hotelId: '', airbnbId: '',
  property: '', address: '',
  cleanerId: '', date: '', time: '',
  durationMinutes: '60', price: '',
  deliveryInstructions: '',
  nextArrival: '', nextArrivalTime: '',
};

// Jours de semaine (ordre Lun→Dim ; valeur = getUTCDay, 0=dimanche).
const WEEKDAYS: { n: number; l: string }[] = [
  { n: 1, l: 'Lun' }, { n: 2, l: 'Mar' }, { n: 3, l: 'Mer' }, { n: 4, l: 'Jeu' },
  { n: 5, l: 'Ven' }, { n: 6, l: 'Sam' }, { n: 0, l: 'Dim' },
];
function weekdaysLabel(ws: number[]): string {
  return WEEKDAYS.filter(w => ws.includes(w.n)).map(w => w.l).join(', ');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Heure (HH:mm) d'un horodatage de pointage, au fuseau Europe/Paris.
function formatClock(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
}

// ── Encart « gain cleaner » calculé en direct ─────────────────────────────────
function GainPreview({ gain, cleaner, minutes, service }: { gain: number; cleaner: any; minutes: string; service?: MissionService }) {
  const rate = cleaner?.hourly_rate ?? 0;
  const deliveryRate = cleaner?.delivery_rate ?? 0;
  const parts = serviceParts(service);
  const formula = parts.cleaning && parts.delivery
    ? `${rate}€/h × ${minutes || 0} min ÷ 60 + ${deliveryRate}€ livraison`
    : parts.delivery
      ? `${deliveryRate}€ par livraison (montant fixe)`
      : `${rate}€/h × ${minutes || 0} min ÷ 60`;
  return (
    <div className="md:col-span-2 rounded-xl px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#C9A84C12', border: '1px solid #C9A84C40' }}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Gain cleaner (auto)</p>
        <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>
          {cleaner ? formula : 'Sélectionnez un cleaner pour calculer le gain'}
        </p>
      </div>
      <span className="text-xl font-bold" style={{ color: '#C9A84C' }}>{gain}€</span>
    </div>
  );
}

// ── Incidents d'une mission (admin) ─────────────────────────────────────────────
// Signalement depuis la mission, avec distinction « lié au cleaner » (impacte ses
// stats RH) vs « externe » (cleaner_id NULL → aucun impact sur le cleaner).
const MISSION_INCIDENT_TYPES: RhIncidentType[] = [
  'retour_negatif', 'oubli', 'qualite_insuffisante', 'degradation_non_signalee', 'incident_externe', 'autre',
];

function MissionIncidentPanel({ mission }: { mission: Mission }) {
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<RhIncident[]>([]);
  const [type, setType] = useState<RhIncidentType>('retour_negatif');
  const [linked, setLinked] = useState(true);   // lié au travail du cleaner
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const hasCleaner = !!mission.cleanerId;
  // Un incident externe n'est jamais attribué ; sans cleaner assigné non plus.
  const effectiveLinked = linked && type !== 'incident_externe' && hasCleaner;

  const load = useCallback(async () => {
    setList(await getMissionIncidentsDB(mission.id));
  }, [mission.id]);

  useEffect(() => { if (open) load(); }, [open, load]);

  async function submit() {
    setBusy(true);
    await createIncidentDB({
      missionId: mission.id,
      cleanerId: effectiveLinked ? mission.cleanerId : null,
      type,
      note: note.trim() || undefined,
    });
    setNote(''); setType('retour_negatif'); setLinked(true);
    setBusy(false);
    await load();
  }

  async function remove(inc: RhIncident) {
    await deleteIncidentDB(inc.id, inc.cleanerId ?? null);
    await load();
  }

  return (
    <div className="px-5 pb-4">
      {!open ? (
        <button onClick={() => setOpen(true)}
          className="w-full py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5"
          style={{ borderColor: '#B85A5040', backgroundColor: '#B85A5008', color: '#B85A50' }}>
          <Icon name="plus" size={14} /> Signaler un incident
        </button>
      ) : (
        <div className="rounded-xl p-3 space-y-3" style={{ backgroundColor: '#F8F6F2' }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Signaler un incident</p>
            <button onClick={() => setOpen(false)} style={{ color: '#A8A09A' }}><Icon name="close" size={14} /></button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {MISSION_INCIDENT_TYPES.map(t => (
              <button key={t} onClick={() => setType(t)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{ backgroundColor: type === t ? '#B85A50' : '#FFFFFF', color: type === t ? '#FFFFFF' : '#7A7068', border: '1px solid #E8E4DC' }}>
                {INCIDENT_LABEL[t]}
              </button>
            ))}
          </div>

          {/* Responsabilité : lié au cleaner (impacte ses stats) ou externe. */}
          <div>
            <button type="button"
              onClick={() => setLinked(v => !v)}
              disabled={type === 'incident_externe' || !hasCleaner}
              className="flex items-center gap-2 text-xs font-medium disabled:opacity-50"
              style={{ color: '#1A1A1A' }}>
              <span className="w-4 h-4 rounded flex items-center justify-center" style={{ backgroundColor: effectiveLinked ? '#C9A84C' : '#E8E4DC', color: '#1A1A1A' }}>
                {effectiveLinked && <Icon name="check" size={11} />}
              </span>
              Lié au travail du cleaner{mission.cleanerName ? ` (${mission.cleanerName})` : ''}
            </button>
            <p className="text-[11px] mt-1" style={{ color: '#A8A09A' }}>
              {effectiveLinked
                ? 'Comptera dans les statistiques RH du cleaner.'
                : type === 'incident_externe'
                  ? 'Incident externe : aucun impact sur le cleaner.'
                  : !hasCleaner ? 'Aucun cleaner assigné : incident externe.' : 'Incident non imputé au cleaner.'}
            </p>
          </div>

          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (facultatif)"
            className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
          <button onClick={submit} disabled={busy}
            className="px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ backgroundColor: '#B85A50', color: '#FFFFFF' }}>
            {busy ? '...' : "Enregistrer l'incident"}
          </button>
        </div>
      )}

      {/* Liste des incidents de la mission. */}
      {list.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {list.map(inc => (
            <div key={inc.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: '#FAFAF8' }}>
              <div className="min-w-0">
                <p className="text-xs font-medium" style={{ color: '#1A1A1A' }}>
                  {INCIDENT_LABEL[inc.type as RhIncidentType] ?? inc.type}
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: inc.cleanerId ? '#B85A5015' : '#6B728018', color: inc.cleanerId ? '#B85A50' : '#6B7280' }}>
                    {inc.cleanerId ? 'Cleaner' : 'Externe'}
                  </span>
                </p>
                <p className="text-[11px] truncate" style={{ color: '#A8A09A' }}>{inc.date}{inc.note ? ` · ${inc.note}` : ''}</p>
              </div>
              <button onClick={() => remove(inc)} style={{ color: '#A8A09A' }} aria-label="Supprimer"><Icon name="close" size={14} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Carte mission admin ───────────────────────────────────────────────────────

function AdminMissionCard({ mission, cleaners, onRefresh, selectable, selected, onToggleSelect,
  position, canMoveUp, canMoveDown, onMoveUp, onMoveDown }: {
  mission: Mission;
  cleaners: any[];
  onRefresh: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  position?: number;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [newCleaner, setNewCleaner] = useState('');
  const [busy, setBusy] = useState(false);
  const [mapsOpen, setMapsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [addTimeOpen, setAddTimeOpen] = useState(false);
  const [addTimeVal, setAddTimeVal] = useState('30');
  const [editForm, setEditForm] = useState({
    date: mission.date, time: mission.time,
    durationMinutes: String(mission.missionDurationMinutes ?? 60),
    type: mission.type, price: String(mission.price ?? 0),
    service: mission.service ?? 'cleaning' as MissionService,
    deliveryInstructions: mission.deliveryInstructions ?? '',
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
      service: mission.service ?? 'cleaning',
      deliveryInstructions: mission.deliveryInstructions ?? '',
    });
    setActionError('');
    setEditOpen(true);
  }

  // Aperçu du gain recalculé en direct dans le formulaire d'édition.
  const editCleaner = cleaners.find(c => c.id === mission.cleanerId);
  const editGainPreview = computeMissionGain({
    service: editForm.service,
    hourlyRate: editCleaner?.hourly_rate ?? mission.cleanerHourlyRateSnapshot ?? 0,
    deliveryRate: editCleaner?.delivery_rate ?? 0,
    durationMinutes: Number(editForm.durationMinutes) || 0,
  });

  async function saveEdit() {
    if (!user) return;
    setBusy(true); setActionError('');
    const res = await updateMissionDB(mission.id, { id: user.id, role: 'admin' }, {
      dateFrom: editForm.date,
      timeFrom: editForm.time,
      // Livraison : forfait, on ne suit aucun temps → durée 0.
      missionDurationMinutes: editForm.service === 'delivery' ? 0 : (Number(editForm.durationMinutes) || 0),
      type: editForm.type,
      service: editForm.service,
      deliveryInstructions: serviceParts(editForm.service).delivery ? editForm.deliveryInstructions : '',
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

  // Admin : reprendre une mission terminée → repasse « en cours ».
  async function handleReopen() {
    if (!user) return;
    if (!confirm('Remettre cette mission en cours ? Elle ne sera plus comptée comme réalisée.')) return;
    setBusy(true); setActionError('');
    const res = await reopenMissionDB(mission.id, { id: user.id, role: 'admin' });
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

  async function handleAddTime() {
    if (!user) return;
    const delta = Math.round(Number(addTimeVal) || 0);
    if (!delta) { setActionError('Indiquez un nombre de minutes.'); return; }
    setBusy(true); setActionError('');
    const res = await addMissionTimeDB(mission.id, delta, { id: user.id, role: 'admin' });
    setBusy(false);
    if (res.error) { setActionError(res.error); return; }
    setAddTimeOpen(false); setAddTimeVal('30');
    onRefresh();
  }

  async function resolveExtra(approve: boolean) {
    if (!user) return;
    setBusy(true); setActionError('');
    const res = await resolveExtraTimeDB(mission.id, approve, { id: user.id, role: 'admin' });
    setBusy(false);
    if (res.error) { setActionError(res.error); return; }
    onRefresh();
  }

  const source = mission.source ?? 'hotel';

  // ── Repères pour la LIGNE COMPACTE (résumé au coup d'œil) ──
  const billable = mission.service !== 'delivery' && mission.service !== 'appointment';
  const unassigned = !mission.cleanerName && !mission.assigneeName;
  const arrivalToday = !!mission.nextArrival && mission.nextArrival === mission.date;
  // Pointage : temps réel vs prévu.
  const cPlanned = mission.missionDurationMinutes ?? 0;
  const cReal = mission.actualDurationMinutes;
  const cEcart = cReal != null ? cReal - cPlanned : null;
  const inProgress = !!mission.startedAt && mission.status !== 'completed' && mission.status !== 'cancelled';
  const ecartColor = cEcart == null ? '#7A7068' : cEcart > 5 ? '#B85A50' : cEcart < -5 ? '#5A8A6A' : '#7A7068';
  const ecartBg = cEcart == null ? '#F5F3EF' : cEcart > 5 ? '#B85A5015' : cEcart < -5 ? '#5A8A6A15' : '#F5F3EF';

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: expanded ? '#D8D0C4' : '#E8E4DC' }}>
      {mapsOpen && mission.address && <MapsModal address={mission.address} onClose={() => setMapsOpen(false)} />}

      {/* ── Ordre manuel (classement par cleaner) ── */}
      {position != null && (onMoveUp || onMoveDown) && (
        <div className="px-3 py-1.5 flex items-center justify-between border-b" style={{ borderColor: '#F2EFE9', backgroundColor: '#FAFAF8' }}>
          <span className="inline-flex items-center justify-center text-xs font-bold rounded-md w-6 h-6" style={{ backgroundColor: '#C9A84C18', color: '#C48A2A' }}>{position}</span>
          <div className="flex items-center gap-1">
            <button onClick={onMoveUp} disabled={!canMoveUp} aria-label="Monter"
              className="w-7 h-7 rounded-lg text-sm font-bold disabled:opacity-30 transition-all"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DC', color: '#7A7068' }}>↑</button>
            <button onClick={onMoveDown} disabled={!canMoveDown} aria-label="Descendre"
              className="w-7 h-7 rounded-lg text-sm font-bold disabled:opacity-30 transition-all"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DC', color: '#7A7068' }}>↓</button>
          </div>
        </div>
      )}

      {/* ── LIGNE COMPACTE (toujours visible) : résumé + toggle détail ── */}
      <div className="px-4 py-3 flex items-center gap-3 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}>
        {selectable && (
          <button onClick={e => { e.stopPropagation(); onToggleSelect?.(mission.id); }} aria-label="Sélectionner"
            className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all"
            style={{ borderColor: selected ? '#C9A84C' : '#C8C2BA', backgroundColor: selected ? '#C9A84C' : '#FFFFFF' }}>
            {selected && <span className="text-xs font-bold" style={{ color: '#1A1A1A' }}>✓</span>}
          </button>
        )}
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: st.color }}
          title={missionStatusLabel(mission.status, mission.service)} />
        <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: '#1A1A1A', width: 44 }}>
          {mission.time ? formatHour(mission.time) : '—'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{mission.property || 'Mission'}</p>
          <p className="text-xs truncate" style={{ color: unassigned ? '#C48A2A' : '#A8A09A' }}>
            {mission.cleanerName ?? mission.assigneeName ?? 'Non assigné'}
            {arrivalToday && <span className="font-semibold" style={{ color: '#B91C1C' }}> · Arrivée jour-même</span>}
          </p>
        </div>
        {/* Pointage au coup d'œil */}
        {inProgress && (
          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0" style={{ backgroundColor: '#5B6EF515', color: '#5B6EF5' }}>● en cours</span>
        )}
        {mission.status === 'completed' && cReal != null && (
          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0" style={{ backgroundColor: ecartBg, color: ecartColor }}
            title={`Réel ${formatDuration(cReal)} · prévu ${formatDuration(cPlanned)}`}>
            {formatDuration(cReal)}{cEcart != null && Math.abs(cEcart) > 5 ? ` (${cEcart > 0 ? '+' : ''}${cEcart})` : ''}
          </span>
        )}
        {billable && (mission.price ?? 0) > 0 && (
          <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: '#1A1A1A' }}>{mission.price} €</span>
        )}
        <span className="shrink-0 text-sm transition-transform" style={{ color: '#A8A09A', transform: expanded ? 'rotate(180deg)' : 'none' }}>⌄</span>
      </div>

      {expanded && (
      <>
      {/* ── Header : source + type / statut */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: '#F2EFE9' }}>
        <div className="flex items-center gap-2">
          {/* Source (Hôtel/Airbnb) — sans objet pour un rendez-vous. */}
          {mission.service !== 'appointment' && (
            <span className="text-xs px-2.5 py-1 rounded-lg font-semibold"
              style={{ backgroundColor: source === 'airbnb' ? '#C9A84C15' : '#F5F3EF', color: source === 'airbnb' ? '#C9A84C' : '#7A7068' }}>
              {missionOriginLabel(mission)}
            </span>
          )}
          {mission.service !== 'appointment' && <span className="text-xs" style={{ color: '#A8A09A' }}>{TYPE_LABEL[mission.type] ?? mission.type}</span>}
          {/* Badge prestation : livraison ou rendez-vous (distinct). */}
          {(serviceParts(mission.service).delivery || mission.service === 'appointment') && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg font-semibold"
              style={{ backgroundColor: SERVICE_BADGE[mission.service ?? 'cleaning'].bg, color: SERVICE_BADGE[mission.service ?? 'cleaning'].color }}>
              {serviceParts(mission.service).delivery && <Icon name="delivery" size={12} />} {serviceLabel(mission.service)}
            </span>
          )}
          {/* Intervention ponctuelle multi-cleaners (group_id). */}
          {mission.groupId && (
            <span className="text-xs px-2 py-0.5 rounded-lg font-semibold" style={{ backgroundColor: '#5A8A6A15', color: '#5A8A6A' }}>
              Ponctuelle
            </span>
          )}
          {mission.zoneName && (
            <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: '#7A7068' }} title={mission.zoneName}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: mission.zoneColor ?? '#9CA3AF' }} />
              {mission.zoneName}
            </span>
          )}
        </div>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold"
          style={{ backgroundColor: st.bg, color: st.color }}>
          {missionStatusLabel(mission.status, mission.service)}
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

        {mission.service === 'appointment' ? (
          /* Rendez-vous : assigné + descriptif, sans prix/durée/gain. */
          <div className="space-y-2">
            <div>
              <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Assigné à</p>
              <p className="text-sm font-medium" style={{ color: (mission.cleanerName || mission.assigneeName) ? '#1A1A1A' : '#C48A2A' }}>
                {mission.cleanerName || mission.assigneeName || 'Non assigné'}
                {mission.assigneeRole === 'admin' ? ' · Admin' : (mission.cleanerName ? ' · Équipe' : '')}
              </p>
            </div>
            {mission.notes && (
              <div>
                <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Descriptif</p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: '#7A7068' }}>{mission.notes}</p>
              </div>
            )}
          </div>
        ) : (
        /* Cleaner + durée + taux + prix client + gain cleaner */
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
          {/* Livraison : forfait, aucun temps suivi → on affiche « Forfait » au lieu de la durée. */}
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>{mission.service === 'delivery' ? 'Type' : 'Durée'}</p>
            <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{mission.service === 'delivery' ? 'Forfait livraison' : formatDuration(mission.missionDurationMinutes)}</p>
          </div>
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>{mission.service === 'delivery' ? 'Forfait cleaner' : 'Taux cleaner'}</p>
            <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>
              {mission.service === 'delivery'
                ? `${mission.cleanerGain ?? 0}€ / livraison`
                : (mission.cleanerHourlyRateSnapshot != null ? `${mission.cleanerHourlyRateSnapshot}€/h` : '—')}
            </p>
          </div>
          {/* Livraison : jamais facturée au client → on masque le prix client. */}
          {mission.service !== 'delivery' && (
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Prix client</p>
            <p className="text-sm font-semibold" style={{ color: '#5A8A6A' }}>{mission.price}€</p>
          </div>
          )}
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Gain cleaner</p>
            <p className="text-sm font-semibold" style={{ color: '#C9A84C' }}>{mission.cleanerGain ?? 0}€</p>
          </div>
        </div>
        )}

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

        {/* Pointage : temps réel vs prévu (admin uniquement) */}
        {mission.startedAt && (() => {
          const planned = mission.missionDurationMinutes ?? 0;
          const real = mission.actualDurationMinutes;
          const ecart = real != null ? real - planned : null;
          const ecartColor = ecart == null ? '#A8A09A' : ecart > 5 ? '#B85A50' : ecart < -5 ? '#5A8A6A' : '#7A7068';
          return (
            <div className="rounded-xl p-3" style={{ backgroundColor: '#F4F6FA', border: '1px solid #DfE3EC' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: '#5B6EF5' }}>⏱ Pointage</p>
              <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                <div>
                  <p className="text-[11px]" style={{ color: '#A8A09A' }}>Début</p>
                  <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{formatClock(mission.startedAt)}</p>
                </div>
                <div>
                  <p className="text-[11px]" style={{ color: '#A8A09A' }}>Fin</p>
                  <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{formatClock(mission.endedAt)}</p>
                </div>
                <div>
                  <p className="text-[11px]" style={{ color: '#A8A09A' }}>Temps réel</p>
                  <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{real != null ? formatDuration(real) : '—'}</p>
                </div>
                <div>
                  <p className="text-[11px]" style={{ color: '#A8A09A' }}>Temps prévu</p>
                  <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{formatDuration(planned)}</p>
                </div>
                <div>
                  <p className="text-[11px]" style={{ color: '#A8A09A' }}>Écart</p>
                  <p className="text-sm font-semibold" style={{ color: ecartColor }}>
                    {ecart == null ? '—' : `${ecart > 0 ? '+' : ''}${ecart} min`}
                  </p>
                </div>
                <div>
                  <p className="text-[11px]" style={{ color: '#A8A09A' }}>Localisation</p>
                  <p className="text-sm font-medium" style={{ color: mission.endLat != null ? '#5A8A6A' : '#A8A09A' }}>
                    {mission.startLat != null ? (mission.endLat != null ? 'Vérifiée' : 'Début') : '—'}
                  </p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Demande de temps supplémentaire du cleaner */}
        {mission.extraTimeStatus === 'pending' && (
          <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: '#C9A84C12', border: '1px solid #E7D9A8' }}>
            <p className="text-xs font-semibold" style={{ color: '#C48A2A' }}>
              ⏱ Demande de +{mission.extraTimeMinutes} min
            </p>
            {mission.extraTimeReason && (
              <p className="text-xs" style={{ color: '#7A7068' }}>« {mission.extraTimeReason} »</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => resolveExtra(true)} disabled={busy}
                className="flex-1 py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>
                ✓ Accorder
              </button>
              <button onClick={() => resolveExtra(false)} disabled={busy}
                className="flex-1 py-2 rounded-lg text-xs font-semibold border disabled:opacity-50"
                style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>
                Refuser
              </button>
            </div>
          </div>
        )}
        {mission.extraTimeStatus === 'approved' && (
          <p className="text-xs" style={{ color: '#5A8A6A' }}>⏱ Temps supplémentaire accordé (+{mission.extraTimeMinutes} min, inclus dans la durée).</p>
        )}
        {mission.extraTimeStatus === 'refused' && (
          <p className="text-xs" style={{ color: '#A8A09A' }}>⏱ Demande de temps refusée.</p>
        )}

        {/* Photos avant/après (consultation, zoom, téléchargement) */}
        <MissionPhotos missionId={mission.id} mode="viewer" />
        <MissionReport missionId={mission.id} mode="viewer" />
      </div>

      {/* Incidents liés à la mission (signalement + responsabilité) */}
      <MissionIncidentPanel mission={mission} />

      {/* ── Actions */}
      <div className="px-5 pb-4 border-t pt-3 space-y-2" style={{ borderColor: '#F2EFE9' }}>
        {actionError && (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#B85A5012', color: '#B85A50' }}>{actionError}</p>
        )}

        {editOpen ? (
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
              {/* Livraison : forfait fixe, la durée n'est pas prise en compte → champ masqué. */}
              {serviceParts(editForm.service).cleaning && (
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Temps de nettoyage (min)</label>
                <input type="number" min="5" step="5" value={editForm.durationMinutes} onChange={e => setEditForm(f => ({ ...f, durationMinutes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
              </div>
              )}
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
                <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Prestation</label>
                <select value={editForm.service} onChange={e => setEditForm(f => ({ ...f, service: e.target.value as MissionService }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border appearance-none" style={inputStyle}>
                  <option value="cleaning">Nettoyage</option>
                  <option value="delivery">Livraison</option>
                </select>
              </div>
              {/* Livraison : jamais facturée au client → pas de prix client. */}
              {editForm.service !== 'delivery' && (
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Prix client (€)</label>
                <input type="number" min="0" value={editForm.price} onChange={e => setEditForm(f => ({ ...f, price: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
              </div>
              )}
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Gain cleaner (auto)</label>
                <div className="w-full px-3 py-2 rounded-lg text-sm border font-semibold" style={{ ...inputStyle, color: '#C9A84C' }}>
                  {editGainPreview}€
                </div>
              </div>
            </div>
            {serviceParts(editForm.service).delivery && (
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: '#A8A09A' }}>Consignes de livraison</label>
                <textarea value={editForm.deliveryInstructions} onChange={e => setEditForm(f => ({ ...f, deliveryInstructions: e.target.value }))}
                  rows={2} className="w-full px-3 py-2 rounded-lg text-sm border resize-none" style={inputStyle} />
              </div>
            )}
            <p className="text-[11px]" style={{ color: '#A8A09A' }}>
              {editForm.service === 'delivery'
                ? <>Gain = forfait livraison {editCleaner?.delivery_rate ?? 0}€ par livraison (montant fixe, sans durée). Livraison non facturée au client.</>
                : <>Gain = taux cleaner {editCleaner?.hourly_rate ?? mission.cleanerHourlyRateSnapshot ?? 0}€/h × {editForm.durationMinutes || 0} min ÷ 60. Le prix client est indépendant.</>}
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
              {cleaners.filter(c => canCleanerDoService(c, mission.service)).map(c => <option key={c.id} value={c.id}>{c.name}{c.status === 'offline' ? ' · Hors ligne' : ''}</option>)}
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
                <button onClick={() => setAssignOpen(true)} disabled={busy}
                  className="px-4 py-2.5 rounded-xl text-sm border disabled:opacity-50"
                  style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                  Réassigner cleaner
                </button>
              )}
              {/* L'admin peut terminer/valider à la place du cleaner (oubli) — dès
                  qu'un cleaner est assigné (en attente) ou en cours. */}
              {(mission.status === 'accepted' || mission.status === 'in_progress') && (
                <button onClick={() => changeStatus('completed')} disabled={busy}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>
                  {mission.service === 'delivery' ? '✓ Marquer livré' : '✓ Terminer'}
                </button>
              )}
              {/* Mission terminée : l'admin peut la reprendre (« en cours »). */}
              {mission.status === 'completed' && (
                <button onClick={handleReopen} disabled={busy}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: '#5B6EF5', color: '#FFFFFF' }}>
                  ↺ Remettre en cours
                </button>
              )}
              {/* Annuler : dispo tant que la mission n'est pas déjà annulée. */}
              {mission.status !== 'cancelled' && (
                <button onClick={() => changeStatus('cancelled')} disabled={busy}
                  className="px-4 py-2.5 rounded-xl text-sm border disabled:opacity-50"
                  style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>
                  Annuler
                </button>
              )}
            </div>

            {/* Ajouter du temps — possible même sur une mission TERMINÉE (régularise la
                durée payée par rapport au temps prévu, recalcule le gain cleaner). */}
            {mission.status !== 'cancelled' && (
              addTimeOpen ? (
                <div className="rounded-xl p-3 space-y-2.5" style={{ backgroundColor: '#F8F6F2' }}>
                  <p className="text-[11px]" style={{ color: '#7A7068' }}>
                    Temps prévu actuel : <b>{formatDuration(mission.missionDurationMinutes)}</b>. Ajoutez le temps réellement passé en plus.
                  </p>
                  <div className="flex gap-1.5">
                    {[15, 30, 45, 60].map(opt => (
                      <button key={opt} type="button" onClick={() => setAddTimeVal(String(opt))}
                        className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                        style={{ backgroundColor: addTimeVal === String(opt) ? '#C9A84C' : '#FFFFFF', color: addTimeVal === String(opt) ? '#1A1A1A' : '#7A7068', border: '1px solid #E8E4DC' }}>
                        +{opt}
                      </button>
                    ))}
                    <input type="number" value={addTimeVal} onChange={e => setAddTimeVal(e.target.value)}
                      className="w-16 px-2 py-2 rounded-lg text-xs border text-center" style={inputStyle} title="minutes" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAddTime} disabled={busy}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                      style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                      {busy ? '...' : `Ajouter ${Math.round(Number(addTimeVal) || 0)} min`}
                    </button>
                    <button onClick={() => { setAddTimeOpen(false); setActionError(''); }} disabled={busy}
                      className="px-4 py-2.5 rounded-xl text-xs border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                      Annuler
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddTimeOpen(true)} disabled={busy}
                  className="w-full py-2.5 rounded-xl text-sm font-medium border disabled:opacity-50"
                  style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                  ⏱ Ajouter du temps{mission.status === 'completed' ? ' (mission terminée)' : ''}
                </button>
              )
            )}

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
      </>
      )}
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function MissionsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<typeof TABS[number]>('Demandes hôtel');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [requests, setRequests] = useState<HotelAnnounce[]>([]);
  const [cleaners, setCleaners] = useState<any[]>([]);
  const [hotels, setHotels] = useState<any[]>([]);
  const [airbnbs, setAirbnbs] = useState<Apartment[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [zoneFilter, setZoneFilter] = useState<string>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkCleaner, setBulkCleaner] = useState('');
  const [bulkLivreur, setBulkLivreur] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [range, setRange] = useState<DateRange>(() => presetRange('today'));
  // Pagination douce : nombre de missions affichées (compact + léger → gros volumes OK).
  const [visibleCount, setVisibleCount] = useState(60);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedCleaner, setSelectedCleaner] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState(emptyForm);
  // Création groupée (plusieurs appartements en une opération)
  const [createMode, setCreateMode] = useState<'single' | 'batch' | 'appointment' | 'oneshot' | 'recurring'>('single');
  // Rendez-vous (assigné admin OU cleaner)
  const [staff, setStaff] = useState<{ id: string; name: string; role: string }[]>([]);
  const [apptForm, setApptForm] = useState({ title: '', description: '', date: '', time: '', assigneeId: '' });
  const [apptBusy, setApptBusy] = useState(false);
  const [apptError, setApptError] = useState('');
  // Intervention ponctuelle (one-shot) multi-cleaners
  const [osForm, setOsForm] = useState({ siteId: '', property: '', address: '', date: '', time: '', durationMinutes: '120', price: '', instructions: '' });
  const [osCleaners, setOsCleaners] = useState<Set<string>>(new Set());
  const [osBusy, setOsBusy] = useState(false);
  const [osError, setOsError] = useState('');
  // Ménage récurrent (jours fixes)
  const [recForm, setRecForm] = useState({ siteId: '', property: '', address: '', time: '', durationMinutes: '60', price: '', cleanerId: '', startDate: '', endDate: '' });
  const [recWeekdays, setRecWeekdays] = useState<Set<number>>(new Set());
  const [recBusy, setRecBusy] = useState(false);
  const [recError, setRecError] = useState('');
  const [recurrings, setRecurrings] = useState<RecurringMission[]>([]);
  const [editingRecId, setEditingRecId] = useState<string | null>(null);
  const [batchApts, setBatchApts] = useState<Set<string>>(new Set());
  const [batchDate, setBatchDate] = useState('');
  const [batchTime, setBatchTime] = useState('');
  const [batchCleaner, setBatchCleaner] = useState('');
  const [batchZone, setBatchZone] = useState('all');
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchError, setBatchError] = useState('');
  const [batchDone, setBatchDone] = useState('');

  const load = useCallback(async () => {
    const [m, r, c, h, a, s, rec] = await Promise.all([
      getMissionsDB(), getHotelRequestsDB(), getActiveCleanersDB(),
      getApprovedHotelsDB(), getAirbnbs(), getAssignableStaffDB(), listRecurringDB(),
    ]);
    setMissions(m); setRequests(r); setCleaners(c); setStaff(s); setRecurrings(rec);
    // Appartements triés par ordre alphabétique (listes de sélection).
    setHotels(h); setAirbnbs([...a].sort((x, y) => x.name.localeCompare(y.name, 'fr', { sensitivity: 'base', numeric: true })));
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch1 = supabase.channel('rt-requests').on('postgres_changes', { event: '*', schema: 'public', table: 'hotel_requests' }, load).subscribe();
    const ch2 = supabase.channel('rt-missions').on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, load).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [load]);

  // Réinitialise la pagination quand la portée de la vue change.
  useEffect(() => { setVisibleCount(60); }, [tab, filter, zoneFilter, range]);

  async function handleValidate(id: string) {
    if (!selectedCleaner) return;
    const c = cleaners.find(x => x.id === selectedCleaner);
    await validateRequestDB(id, selectedCleaner, c?.name ?? '');
    setAssigningId(null); setSelectedCleaner('');
    await load();
  }

  async function handleRefuse(id: string) { await refuseRequestDB(id); await load(); }

  // ── Rendez-vous ──
  async function handleCreateAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!apptForm.title.trim() || !apptForm.date) { setApptError('Titre et date requis.'); return; }
    setApptBusy(true); setApptError('');
    const a = staff.find(s => s.id === apptForm.assigneeId);
    const res = await createAppointmentDB({
      title: apptForm.title.trim(), description: apptForm.description, date: apptForm.date, time: apptForm.time,
      assigneeId: apptForm.assigneeId || undefined, assigneeRole: a?.role, assigneeName: a?.name, createdBy: user?.id,
    });
    setApptBusy(false);
    if (res.error) { setApptError(res.error); return; }
    setApptForm({ title: '', description: '', date: '', time: '', assigneeId: '' });
    await load(); setTab('Missions');
  }

  // Coordonnées de l'adresse cible : celles du site sélectionné, sinon géocodage de
  // l'adresse libre. Sert au contrôle de proximité (démarrage / parking).
  async function resolveCoords(siteId: string, address: string): Promise<{ lat?: number; lng?: number }> {
    if (siteId) {
      const a = airbnbs.find(x => x.id === siteId);
      if (a?.latitude != null && a?.longitude != null) return { lat: a.latitude, lng: a.longitude };
    }
    if (address && address.trim()) {
      const g = await geocodeAddress(address);
      if (g) return { lat: g.lat, lng: g.lon };
    }
    return {};
  }

  // ── Intervention ponctuelle (one-shot) ──
  function selectOsSite(id: string) {
    const a = airbnbs.find(x => x.id === id);
    setOsForm(p => ({
      ...p, siteId: id,
      property: a?.name ?? p.property,
      address: a?.address ?? p.address,
      durationMinutes: a?.estimatedCleaningMinutes != null ? String(a.estimatedCleaningMinutes) : p.durationMinutes,
      price: a?.clientPrice != null ? String(a.clientPrice) : p.price,
    }));
  }
  async function handleCreateOneShot(e: React.FormEvent) {
    e.preventDefault();
    if (!osForm.property.trim() || !osForm.date) { setOsError('Nom du site et date requis.'); return; }
    setOsBusy(true); setOsError('');
    const chosen = cleaners.filter(c => osCleaners.has(c.id)).map(c => ({ id: c.id, name: c.name, hourlyRate: c.hourly_rate }));
    const coords = await resolveCoords(osForm.siteId, osForm.address);
    const res = await createOneShotMissionDB({
      propertyName: osForm.property.trim(), address: osForm.address, date: osForm.date, time: osForm.time,
      durationMinutes: Number(osForm.durationMinutes) || 0, price: Number(osForm.price) || 0,
      instructions: osForm.instructions, addressLat: coords.lat, addressLng: coords.lng,
      cleaners: chosen, createdBy: user?.id,
    });
    setOsBusy(false);
    if (res.error) { setOsError(res.error); return; }
    setOsForm({ siteId: '', property: '', address: '', date: '', time: '', durationMinutes: '120', price: '', instructions: '' });
    setOsCleaners(new Set());
    await load(); setTab('Missions');
  }

  // ── Ménage récurrent ──
  function selectRecSite(id: string) {
    const a = airbnbs.find(x => x.id === id);
    setRecForm(p => ({
      ...p, siteId: id,
      property: a?.name ?? p.property,
      address: a?.address ?? p.address,
      durationMinutes: a?.estimatedCleaningMinutes != null ? String(a.estimatedCleaningMinutes) : p.durationMinutes,
      price: a?.clientPrice != null ? String(a.clientPrice) : p.price,
    }));
  }
  function resetRecForm() {
    setRecForm({ siteId: '', property: '', address: '', time: '', durationMinutes: '60', price: '', cleanerId: '', startDate: '', endDate: '' });
    setRecWeekdays(new Set());
    setEditingRecId(null);
    setRecError('');
  }
  function startEditRec(rec: RecurringMission) {
    setEditingRecId(rec.id);
    setRecForm({
      siteId: rec.airbnbId ?? '',
      property: rec.propertyName ?? '',
      address: rec.address ?? '',
      time: rec.timeFrom ?? '',
      durationMinutes: String(rec.durationMinutes ?? 60),
      price: rec.price != null ? String(rec.price) : '',
      cleanerId: rec.cleanerId ?? '',
      startDate: rec.startDate ?? '',
      endDate: rec.endDate ?? '',
    });
    setRecWeekdays(new Set(rec.weekdays));
    setRecError('');
    setCreateMode('recurring');
    setTab('Créer');
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function handleCreateRecurring(e: React.FormEvent) {
    e.preventDefault();
    if (!recForm.property.trim() || recWeekdays.size === 0 || !recForm.startDate) {
      setRecError('Nom du site, au moins un jour, et date de début requis.'); return;
    }
    setRecBusy(true); setRecError('');
    const c = cleaners.find(x => x.id === recForm.cleanerId);
    const coords = await resolveCoords(recForm.siteId, recForm.address);
    const payload = {
      airbnbId: recForm.siteId || undefined,
      propertyName: recForm.property.trim(), address: recForm.address,
      cleanerId: recForm.cleanerId || undefined, cleanerName: c?.name,
      weekdays: Array.from(recWeekdays).sort((x, y) => x - y), timeFrom: recForm.time,
      durationMinutes: Number(recForm.durationMinutes) || 60, price: Number(recForm.price) || 0,
      startDate: recForm.startDate, endDate: recForm.endDate || undefined,
      addressLat: coords.lat, addressLng: coords.lng,
    };
    const res = editingRecId
      ? await updateRecurringDB(editingRecId, payload)
      : await createRecurringDB({ ...payload, createdBy: user?.id });
    setRecBusy(false);
    if (res.error) { setRecError(res.error); return; }
    resetRecForm();
    await load(); setTab('Missions');
  }
  async function regenRecurring() {
    setRecBusy(true);
    try { await generateRecurringMissions(); }
    catch (e) { console.error('regen recurring:', e); }
    setRecBusy(false);
    await load();
  }
  async function toggleRecActive(id: string, active: boolean) { await setRecurringActiveDB(id, active); await load(); }
  async function removeRec(id: string) {
    if (!confirm('Supprimer ce ménage récurrent ? Les missions déjà créées sont conservées.')) return;
    await deleteRecurringDB(id); await load();
  }

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

  // Gain cleaner calculé en direct, selon la prestation (ménage = horaire ; livraison = fixe).
  const formCleaner = cleaners.find(c => c.id === form.cleanerId);
  const formGain = computeMissionGain({
    service: form.service,
    hourlyRate: formCleaner?.hourly_rate ?? 0,
    deliveryRate: formCleaner?.delivery_rate ?? 0,
    durationMinutes: Number(form.durationMinutes) || 0,
  });

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

    const type: MissionType = form.source === 'airbnb' ? 'regular' : 'checkout';

    // Mission Airbnb : on la lie à l'appartement (source de vérité pour
    // l'adresse et les codes d'accès) et au partenaire propriétaire s'il existe.
    const apt = form.source === 'airbnb' ? airbnbs.find(a => a.id === form.airbnbId) : undefined;

    // Champs partagés par les missions de la commande (ménage et/ou livraison).
    const common = {
      source: form.source,
      propertyName: form.property,
      address: form.address,
      dateFrom: form.date,
      timeFrom: form.time,
      timeTo: '',
      apartmentDefaultDuration: apt?.estimatedCleaningMinutes,
      airbnbId: apt?.id,
      partnerId: apt?.partnerId,
      nextArrival: form.nextArrival || undefined,
      nextArrivalTime: form.nextArrivalTime || undefined,
      createdBy: user?.id,
      createdByRole: 'admin' as const,
    };

    setCreateError('');
    // Une mission = ménage OU livraison, un seul assigné.
    const c = cleaners.find(x => x.id === form.cleanerId);
    const coords = await resolveCoords(form.airbnbId, form.address);
    const result = await createMissionDB({
      ...common, type, service: form.service,
      deliveryInstructions: form.service === 'delivery' ? form.deliveryInstructions : undefined,
      // Livraison : forfait, on ne suit aucun temps → durée 0.
      missionDurationMinutes: form.service === 'delivery' ? 0 : (Number(form.durationMinutes) || 60),
      cleanerHourlyRate: c?.hourly_rate ?? 0,
      cleanerDeliveryRate: c?.delivery_rate ?? 0,
      cleanerId: form.cleanerId || undefined, cleanerName: c?.name,
      addressLat: coords.lat, addressLng: coords.lng,
      // Livraison : jamais facturée au client → prix 0.
      price: form.service === 'delivery' ? 0 : (Number(form.price) || 0),
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
    { value: 'in_progress', label: 'En cours' },
    { value: 'completed',   label: 'Terminées' },
    { value: 'cancelled',   label: 'Annulées' },
  ];

  // 1) on restreint à la période, 2) au statut, 3) à la zone sélectionnée
  const dateScoped = missions.filter(m => inRange(m.date, range));
  const statusScoped = filter === 'all' ? dateScoped : dateScoped.filter(m => m.status === filter);
  const filtered = zoneFilter === 'all' ? statusScoped : statusScoped.filter(m => (m.zoneName ?? '') === zoneFilter);

  // Groupes par cleaner, tronqués à visibleCount (pagination « Afficher plus »).
  const allGroups = groupMissionsByCleaner(filtered);
  const shownGroups: typeof allGroups = [];
  let budget = visibleCount;
  for (const g of allGroups) {
    if (budget <= 0) break;
    const ms = g.missions.slice(0, budget);
    budget -= ms.length;
    shownGroups.push({ ...g, missions: ms });
  }
  const hasMore = filtered.length > visibleCount;

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

  // Réordonne les missions d'un groupe cleaner et persiste le rang manuel (0..n).
  // Le tri partagé applique ensuite cet ordre côté admin ET côté cleaner.
  async function reorderGroup(missionsOfGroup: Mission[], index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= missionsOfGroup.length) return;
    const arr = [...missionsOfGroup];
    [arr[index], arr[target]] = [arr[target], arr[index]];
    // Mise à jour optimiste : on reflète le nouvel ordre tout de suite.
    const orderById = new Map(arr.map((m, i) => [m.id, i]));
    setMissions(prev => prev.map(m => orderById.has(m.id) ? { ...m, manualOrder: orderById.get(m.id) } : m));
    await updateMissionsOrderDB(arr.map((m, i) => ({ id: m.id, order: i })));
  }

  // Personnes éligibles à l'assignation groupée : doivent pouvoir réaliser le
  // service de CHAQUE mission cochée (livraisons → livreurs ; ménages → cleaners ;
  // sélection mixte → polyvalents). Libellé adapté à la nature de la sélection.
  const selectedMissionsList = missions.filter(m => selectedIds.has(m.id));
  const bulkServices = new Set(selectedMissionsList.map(m => m.service ?? 'cleaning'));
  const bulkEligible = cleaners.filter(c => selectedMissionsList.every(m => canCleanerDoService(c, m.service)));
  const bulkRoleLabel = bulkServices.size === 1 && bulkServices.has('delivery')
    ? 'livreur'
    : bulkServices.has('delivery') ? 'cleaner polyvalent' : 'cleaner';

  async function handleBulkAssign() {
    if (!bulkCleaner || selectedIds.size === 0) return;
    const c = bulkEligible.find(x => x.id === bulkCleaner);
    if (!c) return;  // garde-fou : la personne doit pouvoir faire tous les services cochés
    setBulkBusy(true);
    await assignCleanerToMissionsDB(Array.from(selectedIds), bulkCleaner, c.name ?? '');
    setBulkBusy(false);
    clearSelection();
    setBulkCleaner('');
    await load();
  }

  // Livreurs disponibles (cleaners habilités livraison).
  const livreurs = cleaners.filter((c: any) => c.can_deliver);
  // Missions sélectionnées qui ne sont PAS déjà des livraisons → on peut leur
  // ajouter une livraison (même appartement/adresse, même date).
  const selectedForDelivery = selectedMissionsList.filter(m => (m.service ?? 'cleaning') !== 'delivery');

  // Crée une mission de LIVRAISON pour chaque mission cochée et l'assigne au livreur.
  // Évite les doublons : on saute si une livraison existe déjà pour le même
  // appartement/propriété à la même date.
  async function handleBulkCreateDelivery() {
    if (!bulkLivreur || selectedForDelivery.length === 0) return;
    const liv: any = livreurs.find((c: any) => c.id === bulkLivreur);
    if (!liv) return;
    setBulkBusy(true);
    for (const m of selectedForDelivery) {
      const exists = missions.some(x => (x.service === 'delivery') && x.date === m.date
        && (m.airbnbId ? x.airbnbId === m.airbnbId : x.property === m.property));
      if (exists) continue;
      await createMissionDB({
        type: 'regular', source: m.source ?? 'airbnb', service: 'delivery',
        propertyName: m.property, address: m.address,
        dateFrom: m.date, timeFrom: m.time || '', timeTo: '',
        missionDurationMinutes: 30,
        cleanerHourlyRate: liv.hourly_rate ?? 0, cleanerDeliveryRate: liv.delivery_rate ?? 0,
        cleanerId: liv.id, cleanerName: liv.name,
        price: 0,
        airbnbId: m.airbnbId, partnerId: m.partnerId,
        createdBy: user?.id, createdByRole: 'admin',
      });
    }
    setBulkBusy(false);
    clearSelection();
    setBulkLivreur('');
    await load();
  }

  // Bornes (1re → dernière mission) pour le bouton « voir toutes les dates »
  const allDates = missions.map(m => m.date).filter(Boolean).sort();
  const outOfRangeCount = missions.length - dateScoped.length;

  if (loading) return <Loading className="p-4 md:p-6 text-sm" />;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-6"><h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Missions</h1></div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} className="px-4 py-2 rounded-xl text-sm font-medium transition-all relative"
            style={{ backgroundColor: tab === t ? '#FFFFFF' : 'transparent', color: tab === t ? '#1A1A1A' : '#A8A09A', boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {t}
            {t === 'Demandes hôtel' && pendingReqs > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ backgroundColor: '#C48A2A', color: '#FFF' }}>{pendingReqs}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── ANNONCES HÔTEL ── */}
      {tab === 'Demandes hôtel' && (
        <div className="space-y-3">
          {requests.length === 0 && (
            <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
              <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune demande</p>
            </div>
          )}
          {requests.map(a => {
            const st = ST_REQ[a.status] ?? ST_REQ.pending;
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
                    <span className="text-xs" style={{ color: '#7A7068' }}>{a.guestCount} chambre{a.guestCount > 1 ? 's' : ''}</span>
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

          {/* Filtres statut + zone — barre compacte (comptes sur la période) */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {FILTERS.map(({ value, label }) => {
              const on = filter === value;
              const count = value === 'all' ? dateScoped.length : dateScoped.filter(m => m.status === value).length;
              return (
                <button key={value} onClick={() => setFilter(value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{ backgroundColor: on ? '#C9A84C' : '#FFFFFF', color: on ? '#1A1A1A' : '#7A7068', border: `1px solid ${on ? '#C9A84C' : '#E8E4DC'}` }}>
                  {label}<span className="ml-1.5 opacity-60">{count}</span>
                </button>
              );
            })}
            {/* Zone en menu déroulant : compact et scalable (beaucoup de zones). */}
            {zonesInScope.length > 0 && (
              <select value={zoneFilter} onChange={e => setZoneFilter(e.target.value)}
                className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium border appearance-none cursor-pointer"
                style={{ ...inputStyle, color: zoneFilter === 'all' ? '#7A7068' : '#1A1A1A' }}>
                <option value="all">Toutes les zones</option>
                {zonesInScope.map(z => <option key={z.name} value={z.name}>{z.name}</option>)}
              </select>
            )}
          </div>

          {/* Barre d'assignation groupée (tournée) */}
          <div className="flex items-center justify-end gap-2 mb-4 flex-wrap">
            <button onClick={selectAllVisible} className="text-xs font-medium" style={{ color: '#C9A84C' }}>
              Tout sélectionner (assignables)
            </button>
          </div>
          {selectedIds.size > 0 && (
            <div className="mb-4 p-3 rounded-xl space-y-2.5" style={{ backgroundColor: '#C9A84C12', border: '1px solid #C9A84C40' }}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold" style={{ color: '#7A6030' }}>{selectedIds.size} sélectionnée{selectedIds.size > 1 ? 's' : ''}</span>
                <button onClick={clearSelection} className="px-3 py-1.5 rounded-lg text-sm" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>✕</button>
              </div>

              {/* Assigner la/les mission(s) à un cleaner (selon leur prestation). */}
              <div className="flex items-center gap-2 flex-wrap">
                <select value={bulkCleaner} onChange={e => setBulkCleaner(e.target.value)}
                  className="flex-1 min-w-[160px] px-3 py-2 rounded-xl text-sm border appearance-none"
                  style={{ ...inputStyle, color: bulkCleaner ? '#1A1A1A' : '#A8A09A' }}>
                  <option value="">Choisir un {bulkRoleLabel}</option>
                  {bulkEligible.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button onClick={handleBulkAssign} disabled={!bulkCleaner || bulkBusy}
                  className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                  {bulkBusy ? '...' : 'Assigner'}
                </button>
              </div>

              {/* Ajouter une LIVRAISON aux missions cochées et l'assigner à un livreur. */}
              {selectedForDelivery.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap pt-2.5 border-t" style={{ borderColor: '#C9A84C30' }}>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: '#C48A2A' }}>
                    <Icon name="delivery" size={14} /> Livraison
                  </span>
                  <select value={bulkLivreur} onChange={e => setBulkLivreur(e.target.value)}
                    className="flex-1 min-w-[140px] px-3 py-2 rounded-xl text-sm border appearance-none"
                    style={{ ...inputStyle, color: bulkLivreur ? '#1A1A1A' : '#A8A09A' }}>
                    <option value="">Choisir un livreur</option>
                    {livreurs.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button onClick={handleBulkCreateDelivery} disabled={!bulkLivreur || bulkBusy}
                    className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: '#C48A2A', color: '#FFFFFF' }}>
                    {bulkBusy ? '...' : `Créer la livraison (${selectedForDelivery.length})`}
                  </button>
                  {livreurs.length === 0 && (
                    <span className="text-xs w-full" style={{ color: '#B85A50' }}>
                      Aucun livreur : activez la capacité « Livraison » sur un cleaner (Admin → Cleaners).
                    </span>
                  )}
                </div>
              )}
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
            <div className="space-y-6">
              {/* Récap de la période (compteurs au coup d'œil). */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: '#7A7068' }}>
                <span><span className="font-semibold" style={{ color: '#1A1A1A' }}>{filtered.length}</span> mission{filtered.length > 1 ? 's' : ''}</span>
                {(() => { const n = filtered.filter(m => !m.cleanerName && !m.assigneeName && m.status !== 'cancelled' && m.status !== 'completed').length; return n > 0 ? <span style={{ color: '#C48A2A' }}><span className="font-semibold">{n}</span> non assignée{n > 1 ? 's' : ''}</span> : null; })()}
                {(() => { const n = filtered.filter(m => m.nextArrival && m.nextArrival === m.date).length; return n > 0 ? <span style={{ color: '#B91C1C' }}><span className="font-semibold">{n}</span> arrivée{n > 1 ? 's' : ''} jour-même</span> : null; })()}
              </div>
              {shownGroups.map(group => (
                <section key={group.cleanerId ?? '__unassigned__'}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold text-base"
                      style={{ color: group.cleanerId ? '#1A1A1A' : '#C48A2A' }}>
                      {group.cleanerName}
                    </h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>
                      {group.missions.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {group.missions.map((m, i) => (
                      <AdminMissionCard key={m.id} mission={m} cleaners={cleaners} onRefresh={load}
                        selectable={m.status !== 'completed' && m.status !== 'cancelled'}
                        selected={selectedIds.has(m.id)}
                        onToggleSelect={toggleSelect}
                        position={group.missions.length > 1 ? i + 1 : undefined}
                        canMoveUp={i > 0}
                        canMoveDown={i < group.missions.length - 1}
                        onMoveUp={group.missions.length > 1 ? () => reorderGroup(group.missions, i, -1) : undefined}
                        onMoveDown={group.missions.length > 1 ? () => reorderGroup(group.missions, i, 1) : undefined} />
                    ))}
                  </div>
                </section>
              ))}
              {hasMore && (
                <div className="text-center pt-2">
                  <button onClick={() => setVisibleCount(c => c + 60)}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }}>
                    Afficher plus ({filtered.length - visibleCount} restantes)
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── CRÉER ── */}
      {tab === 'Créer' && (
        <div>
          {/* Mode de création — responsive : passe à la ligne sur petit écran. */}
          <div className="flex flex-wrap gap-1 mb-5 p-1 rounded-2xl" style={{ backgroundColor: '#F5F3EF' }}>
            {([['single', 'Une mission'], ['batch', 'Plusieurs appartements'], ['recurring', 'Récurrente'], ['oneshot', 'Intervention ponctuelle'], ['appointment', 'Rendez-vous']] as const).map(([m, label]) => (
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
          {/* (formulaire mission ménage/livraison existant) */}

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

          {/* Prestation : ménage (défaut) ou livraison. */}
          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Prestation</label>
            <div className="flex gap-2 flex-wrap">
              {(['cleaning', 'delivery'] as MissionService[]).map(s => (
                <button key={s} type="button"
                  onClick={() => setForm(p => ({ ...p, service: s, cleanerId: '' }))}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 transition-all"
                  style={{ borderColor: form.service === s ? '#C9A84C' : '#E8E4DC', backgroundColor: form.service === s ? '#C9A84C12' : '#FFFFFF', color: form.service === s ? '#C9A84C' : '#7A7068' }}>
                  {SERVICE_LABEL[s]}
                </button>
              ))}
            </div>

            {/* Consignes de livraison (mission de livraison). */}
            {form.service === 'delivery' && (
              <div className="mt-3">
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Consignes de livraison</label>
                <textarea value={form.deliveryInstructions} onChange={e => setForm(p => ({ ...p, deliveryInstructions: e.target.value }))}
                  rows={2} placeholder="Ex : déposer le linge propre dans le placard de l'entrée, récupérer le linge sale."
                  className="w-full px-4 py-3 rounded-xl text-sm border resize-none" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
            )}
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
                  {cleaners.filter(c => canCleanerDoService(c, form.service)).map(c => <option key={c.id} value={c.id}>{c.name}{c.status === 'offline' ? ' · Hors ligne' : ''}</option>)}
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
              {/* Livraison : forfait fixe, la durée n'est pas prise en compte → champ masqué. */}
              {serviceParts(form.service).cleaning && (
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
              )}
              {/* Livraison : jamais facturée au client → pas de prix client. */}
              {form.service !== 'delivery' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Prix client (€) — facturation</label>
                <input type="number" min="0" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="0" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              )}
              <GainPreview gain={formGain} cleaner={formCleaner} minutes={form.durationMinutes} service={form.service} />
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
                  {cleaners.filter(c => canCleanerDoService(c, form.service)).map(c => <option key={c.id} value={c.id}>{c.name}{c.status === 'offline' ? ' · Hors ligne' : ''}</option>)}
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
              <GainPreview gain={formGain} cleaner={formCleaner} minutes={form.durationMinutes} service={form.service} />
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
          ) : createMode === 'batch' ? (
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
          ) : createMode === 'appointment' ? (
        /* ── RENDEZ-VOUS (assigné admin ou cleaner, interne) ── */
        <form onSubmit={handleCreateAppointment} className="rounded-2xl border p-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <h2 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>Nouveau rendez-vous</h2>
          <p className="text-xs mb-6" style={{ color: '#A8A09A' }}>Entretien client, réunion… Planifié, non facturé.</p>

          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Intitulé</label>
            <input value={apptForm.title} onChange={e => setApptForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Ex : entretien client Dupont" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Date</label>
              <input type="date" value={apptForm.date} onChange={e => setApptForm(p => ({ ...p, date: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Heure</label>
              <input type="time" value={apptForm.time} onChange={e => setApptForm(p => ({ ...p, time: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Assigné à</label>
            <select value={apptForm.assigneeId} onChange={e => setApptForm(p => ({ ...p, assigneeId: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
              style={{ ...inputStyle, color: apptForm.assigneeId ? '#1A1A1A' : '#A8A09A' }}>
              <option value="">Assigner plus tard</option>
              {staff.map(s => <option key={`${s.role}-${s.id}`} value={s.id}>{s.name} · {s.role === 'admin' ? 'Admin' : 'Équipe'}</option>)}
            </select>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Descriptif</label>
            <textarea value={apptForm.description} onChange={e => setApptForm(p => ({ ...p, description: e.target.value }))}
              rows={3} placeholder="Objet du rendez-vous, lieu, points à aborder…"
              className="w-full px-4 py-3 rounded-xl text-sm border resize-none" style={inputStyle} />
          </div>

          {apptError && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#B85A5012', color: '#B85A50' }}>{apptError}</div>}
          <button type="submit" disabled={apptBusy}
            className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
            style={{ backgroundColor: '#7C5CBF', color: '#FFFFFF' }}>
            {apptBusy ? 'Création...' : 'Créer le rendez-vous'}
          </button>
        </form>
          ) : createMode === 'oneshot' ? (
        /* ── INTERVENTION PONCTUELLE (one-shot, plusieurs cleaners) ── */
        <form onSubmit={handleCreateOneShot} className="rounded-2xl border p-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <h2 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>Intervention ponctuelle</h2>
          <p className="text-xs mb-6" style={{ color: '#A8A09A' }}>Une intervention unique à une date, réalisée par un ou plusieurs cleaners (ex. gros ménage).</p>

          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Site (facultatif — pré-remplit)</label>
            <select value={osForm.siteId} onChange={e => selectOsSite(e.target.value)}
              className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
              style={{ ...inputStyle, color: osForm.siteId ? '#1A1A1A' : '#A8A09A' }}>
              <option value="">Saisie libre</option>
              {airbnbs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Nom / lieu</label>
              <input value={osForm.property} onChange={e => setOsForm(p => ({ ...p, property: e.target.value }))}
                placeholder="Ex : Salle de sport FitClub" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Adresse</label>
              <input value={osForm.address} onChange={e => setOsForm(p => ({ ...p, address: e.target.value }))}
                placeholder="Adresse" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Date</label>
              <input type="date" value={osForm.date} onChange={e => setOsForm(p => ({ ...p, date: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Heure</label>
              <input type="time" value={osForm.time} onChange={e => setOsForm(p => ({ ...p, time: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Durée (min)</label>
              <input type="number" min={0} value={osForm.durationMinutes} onChange={e => setOsForm(p => ({ ...p, durationMinutes: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
            </div>
          </div>

          <div className="mb-4 md:w-1/3">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Prix client (€)</label>
            <input type="number" min={0} step="0.01" value={osForm.price} onChange={e => setOsForm(p => ({ ...p, price: e.target.value }))}
              placeholder="0" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>
              Cleaners — {osCleaners.size} sélectionné{osCleaners.size > 1 ? 's' : ''}
            </label>
            <div className="flex flex-wrap gap-2">
              {cleaners.filter(c => canCleanerDoService(c, 'cleaning')).map(c => {
                const on = osCleaners.has(c.id);
                return (
                  <button type="button" key={c.id}
                    onClick={() => setOsCleaners(prev => { const n = new Set(prev); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
                    className="px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all"
                    style={{ borderColor: on ? '#C9A84C' : '#E8E4DC', backgroundColor: on ? '#C9A84C12' : '#FFFFFF', color: on ? '#C9A84C' : '#7A7068' }}>
                    {on ? '✓ ' : ''}{c.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Consignes</label>
            <textarea value={osForm.instructions} onChange={e => setOsForm(p => ({ ...p, instructions: e.target.value }))}
              rows={2} placeholder="Détails de l'intervention, accès, matériel…"
              className="w-full px-4 py-3 rounded-xl text-sm border resize-none" style={inputStyle} />
          </div>

          {osError && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#B85A5012', color: '#B85A50' }}>{osError}</div>}
          <button type="submit" disabled={osBusy}
            className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
            style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {osBusy ? 'Création...' : `Créer l'intervention${osCleaners.size > 1 ? ` (${osCleaners.size} intervenants)` : ''}`}
          </button>
        </form>
          ) : (
        /* ── MÉNAGE RÉCURRENT (jours fixes) ── */
        <div className="space-y-5">
          <form onSubmit={handleCreateRecurring} className="rounded-2xl border p-4 sm:p-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
            <h2 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>{editingRecId ? 'Modifier le ménage récurrent' : 'Ménage récurrent'}</h2>
            <p className="text-xs mb-6" style={{ color: '#A8A09A' }}>
              {editingRecId
                ? 'Les missions futures non démarrées seront réalignées sur la nouvelle programmation.'
                : 'Programmé à jours fixes (ex. salle de sport tous les lundis/mercredis/vendredis). Les missions sont créées automatiquement.'}
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Site (facultatif — pré-remplit)</label>
              <select value={recForm.siteId} onChange={e => selectRecSite(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
                style={{ ...inputStyle, color: recForm.siteId ? '#1A1A1A' : '#A8A09A' }}>
                <option value="">Saisie libre</option>
                {airbnbs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Nom / lieu</label>
                <input value={recForm.property} onChange={e => setRecForm(p => ({ ...p, property: e.target.value }))}
                  placeholder="Ex : Salle de sport FitClub" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Adresse</label>
                <input value={recForm.address} onChange={e => setRecForm(p => ({ ...p, address: e.target.value }))}
                  placeholder="Adresse" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
              </div>
            </div>

            {/* Jours de la semaine — flex-wrap : s'adapte à toutes les largeurs. */}
            <div className="mb-4">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Jours</label>
              <div className="flex flex-wrap gap-2">
                {WEEKDAYS.map(w => {
                  const on = recWeekdays.has(w.n);
                  return (
                    <button type="button" key={w.n}
                      onClick={() => setRecWeekdays(prev => { const n = new Set(prev); n.has(w.n) ? n.delete(w.n) : n.add(w.n); return n; })}
                      className="flex-1 min-w-[56px] py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
                      style={{ borderColor: on ? '#C9A84C' : '#E8E4DC', backgroundColor: on ? '#C9A84C12' : '#FFFFFF', color: on ? '#C9A84C' : '#7A7068' }}>
                      {w.l}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Heure</label>
                <input type="time" value={recForm.time} onChange={e => setRecForm(p => ({ ...p, time: e.target.value }))}
                  className="w-full px-3 py-3 rounded-xl text-sm border" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Durée (min)</label>
                <input type="number" min={0} value={recForm.durationMinutes} onChange={e => setRecForm(p => ({ ...p, durationMinutes: e.target.value }))}
                  className="w-full px-3 py-3 rounded-xl text-sm border" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Prix (€)</label>
                <input type="number" min={0} step="0.01" value={recForm.price} onChange={e => setRecForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="0" className="w-full px-3 py-3 rounded-xl text-sm border" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Cleaner</label>
                <select value={recForm.cleanerId} onChange={e => setRecForm(p => ({ ...p, cleanerId: e.target.value }))}
                  className="w-full px-3 py-3 rounded-xl text-sm border appearance-none"
                  style={{ ...inputStyle, color: recForm.cleanerId ? '#1A1A1A' : '#A8A09A' }}>
                  <option value="">Plus tard</option>
                  {cleaners.filter(c => canCleanerDoService(c, 'cleaning')).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Début</label>
                <input type="date" value={recForm.startDate} onChange={e => setRecForm(p => ({ ...p, startDate: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Fin (facultatif)</label>
                <input type="date" value={recForm.endDate} min={recForm.startDate} onChange={e => setRecForm(p => ({ ...p, endDate: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
              </div>
            </div>

            {recError && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#B85A5012', color: '#B85A50' }}>{recError}</div>}
            <div className="flex flex-col sm:flex-row gap-2">
              <button type="submit" disabled={recBusy}
                className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
                style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                {recBusy ? 'Enregistrement...' : editingRecId ? 'Enregistrer les modifications' : 'Programmer le ménage récurrent'}
              </button>
              {editingRecId && (
                <button type="button" onClick={resetRecForm} disabled={recBusy}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-semibold border disabled:opacity-50"
                  style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                  Annuler
                </button>
              )}
            </div>
          </form>

          {/* Plannings existants — gestion (activer/suspendre/supprimer). */}
          {recurrings.length > 0 && (
            <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
              <div className="px-4 sm:px-5 py-3.5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ borderColor: '#F2EFE9' }}>
                <h3 className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Ménages récurrents ({recurrings.length})</h3>
                <button type="button" onClick={regenRecurring} disabled={recBusy}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold border disabled:opacity-50"
                  style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                  {recBusy ? '...' : 'Générer les prochaines missions'}
                </button>
              </div>
              {recurrings.map((rec, i) => (
                <div key={rec.id} className={`px-4 sm:px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 ${i < recurrings.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{rec.propertyName || 'Site'}</p>
                      {!rec.active && <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: '#F5F3EF', color: '#A8A09A' }}>Suspendu</span>}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: '#7A7068' }}>
                      {weekdaysLabel(rec.weekdays)}{rec.timeFrom ? ` · ${formatHour(rec.timeFrom)}` : ''}
                      {` · ${formatDuration(rec.durationMinutes)}`}{rec.price ? ` · ${rec.price}€` : ''}
                      {rec.cleanerName ? ` · ${rec.cleanerName}` : ' · non assigné'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <button type="button" onClick={() => startEditRec(rec)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold border"
                      style={{ borderColor: '#C9A84C', color: '#C9A84C' }}>
                      Modifier
                    </button>
                    <button type="button" onClick={() => toggleRecActive(rec.id, !rec.active)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold border"
                      style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                      {rec.active ? 'Suspendre' : 'Réactiver'}
                    </button>
                    <button type="button" onClick={() => removeRec(rec.id)}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-medium border"
                      style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
          )}
        </div>
      )}
    </div>
  );
}
