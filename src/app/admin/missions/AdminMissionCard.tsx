'use client';

// Carte mission (vue admin) et son panneau d'incidents. Extrait de la page
// Missions pour l'alléger : ce fichier ne contient QUE l'affichage/édition d'une
// mission côté admin. Aucune logique de page (onglets, formulaires de création)
// ici. Réutilise les mêmes libs (db, labels, service, pay…).

import { useState, useEffect, useCallback } from 'react';
import {
  updateMissionStatusDB, assignCleanerToMissionDB, updateMissionDB,
  deleteMissionDB, reopenMissionDB, resolveExtraTimeDB, addMissionTimeDB,
} from '@/lib/db';
import type { Mission, MissionService, MissionStatus, MissionType } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedback } from '@/contexts/FeedbackContext';
import { serviceLabel, SERVICE_BADGE, canCleanerDoService, serviceParts } from '@/lib/service';
import { computeMissionGain } from '@/lib/pay';
import { formatDuration, formatHour, DEPARTURE_TIMES } from '@/lib/format';
import { inputStyle } from '@/lib/ui';
import Icon from '@/components/Icon';
import MapsModal from '@/components/MapsModal';
import MissionPhotos from '@/components/MissionPhotos';
import MissionReport from '@/components/MissionReport';
import RepairsPanel from '@/components/RepairsPanel';
import { MISSION_STATUS_CFG, MISSION_TYPE_LABEL, missionStatusLabel, missionOriginLabel } from '@/lib/labels';
import { getMissionIncidentsDB, createIncidentDB, deleteIncidentDB, INCIDENT_LABEL, type RhIncidentType, type RhIncident } from '@/lib/rhApi';

const STATUS_CFG = MISSION_STATUS_CFG;
const TYPE_LABEL = MISSION_TYPE_LABEL;

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

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
}

// Heure (HH:mm) d'un horodatage de pointage, au fuseau Europe/Paris.
function formatClock(iso: string | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
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

export default function AdminMissionCard({ mission, cleaners, onRefresh, selectable, selected, onToggleSelect,
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
  const { confirm, toast } = useFeedback();
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
    const ok = await confirm({ title: 'Supprimer cette mission ?', message: 'Cette action est définitive.', confirmLabel: 'Supprimer', danger: true });
    if (!ok) return;
    setBusy(true); setActionError('');
    const res = await deleteMissionDB(mission.id, { id: user.id, role: 'admin' });
    setBusy(false);
    if (res.error) { setActionError(res.error); toast(res.error, 'error'); return; }
    toast('Mission supprimée.', 'success');
    onRefresh();
  }

  // Admin : reprendre une mission terminée → repasse « en cours ».
  async function handleReopen() {
    if (!user) return;
    const ok = await confirm({ title: 'Remettre en cours ?', message: 'La mission ne sera plus comptée comme réalisée.', confirmLabel: 'Remettre en cours' });
    if (!ok) return;
    setBusy(true); setActionError('');
    const res = await reopenMissionDB(mission.id, { id: user.id, role: 'admin' });
    setBusy(false);
    if (res.error) { setActionError(res.error); toast(res.error, 'error'); return; }
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
        {/* Réparations du logement : l'admin peut en ajouter une depuis la mission
            et la clôturer. Elle reste ouverte tant que le propriétaire n'a pas réparé. */}
        {mission.airbnbId && (
          <RepairsPanel airbnbId={mission.airbnbId} missionId={mission.id} role="admin" authorName="Admin" />
        )}
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

