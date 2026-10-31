'use client';

// Carte mission (vue admin) : l'affichage d'une mission et ses actions. Les
// blocs autonomes vivent dans ./carte/ (incidents, course / achat, formulaire
// de modification). Aucune logique de page (onglets, création) ici.

import { useState, memo } from 'react';
import {
  updateMissionStatusDB, assignCleanerToMissionDB,
  deleteMissionDB, reopenMissionDB, resolveExtraTimeDB, addMissionTimeDB,
  decideMissionRequestDB, unassignMissionDB, declareNoShowDB, cancelNoShowDB,
} from '@/lib/db';
import { getProfitConfigDB } from '@/lib/profitability';
import { noShowPossible, NO_SHOW_BOUTON, titreNoShow, motifNoShow, type NoShowMotif } from '@/lib/noShow';
import NoShowMotifChoix from '@/components/NoShowMotifChoix';
import type { Mission, MissionStatus } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedback } from '@/contexts/FeedbackContext';
import { serviceLabel, SERVICE_BADGE, canCleanerDoService, serviceParts } from '@/lib/service';
import { formatDuration, formatHour, money } from '@/lib/format';
import { inputStyle } from '@/lib/ui';
import type { TerrainInfo } from '@/lib/fieldContact';
import Icon from '@/components/Icon';
import { appelPrestataire, type Prestataire } from '@/lib/prestataireApi';
import { specialitesPourMission, correspondSpecialite, libelleSpecialite, libelleVehicules } from '@/lib/prestataireRegles';
import MapsModal from '@/components/MapsModal';
import MissionPhotos from '@/components/MissionPhotos';
import MissionReport from '@/components/MissionReport';
import ChecklistPanel from '@/components/ChecklistPanel';
import RepairsPanel from '@/components/RepairsPanel';
import MissionIncidentPanel from './carte/IncidentsMission';
import BlocCourse from './carte/BlocCourse';
import FormulaireModification from './carte/FormulaireModification';
import { MISSION_TYPE_LABEL, missionStatusCfg, missionStatusLabel, missionOriginLabel } from '@/lib/labels';

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

// ── Carte mission admin ───────────────────────────────────────────────────────

// Mémoïsée : la page passe des props stables (mission inchangée = même objet,
// fonctions useCallback) — taper dans un filtre ne redessine plus 60 cartes.
export default memo(AdminMissionCard);

function AdminMissionCard({ mission, cleaners, onRefresh, selectable, selected, onToggleSelect,
  position, canMoveUp, canMoveDown, onMove, terrain }: {
  mission: Mission;
  /** Codes d'accès et contacts, servis par /api/missions/terrain. */
  terrain?: TerrainInfo;
  cleaners: any[];
  /** Après une action : la page relit CETTE mission (et ses sœurs de groupe), pas tout le planning. */
  onRefresh: (missionId: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  position?: number;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  /** Classement dans la journée (absent s'il n'y a qu'une mission ce jour-là). */
  onMove?: (missionId: string, dir: -1 | 1) => void;
}) {
  const onMoveUp = onMove ? () => onMove(mission.id, -1) : undefined;
  const onMoveDown = onMove ? () => onMove(mission.id, 1) : undefined;
  const { user } = useAuth();
  const { confirm, toast } = useFeedback();
  const [expanded, setExpanded] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [newCleaner, setNewCleaner] = useState('');
  // Sous-traitance : confier la mission à un prestataire (chargés à l'ouverture).
  const [confierOpen, setConfierOpen] = useState(false);
  const [prestataires, setPrestataires] = useState<Prestataire[] | null>(null);
  const [newPrestataire, setNewPrestataire] = useState('');
  const [busy, setBusy] = useState(false);
  const [mapsOpen, setMapsOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [addTimeOpen, setAddTimeOpen] = useState(false);
  const [addTimeVal, setAddTimeVal] = useState('30');
  const [deciding, setDeciding] = useState(false);
  // No show : forfaits pré-remplis depuis les paramètres, modifiables pour cette mission.
  const [noShowOpen, setNoShowOpen] = useState(false);
  const [noShowForm, setNoShowForm] = useState({ clientFee: '', cleanerFee: '', note: '', motif: 'no_show' as NoShowMotif });
  const st = missionStatusCfg(mission.status, mission.noShow);
  // Codes d'accès : servis par /api/missions/terrain. Repli sur les notes de la
  // mission pour les anciennes missions dont le texte les contient encore.
  const notesParsees = parseMissionNotes(mission.notes);
  const portalCode = terrain?.portalCode ?? notesParsees.portalCode;
  const keyboxCode = terrain?.keyboxCode ?? notesParsees.keyboxCode;
  const extra = [terrain?.entryInstructions, terrain?.apartmentNotes, notesParsees.extra]
    .filter(Boolean).join(' · ') || notesParsees.extra;
  const notesIsLong = extra.length > 120;

  async function changeStatus(s: MissionStatus) {
    setBusy(true);
    await updateMissionStatusDB(mission.id, s, { id: user?.id ?? '', role: 'admin' });
    onRefresh(mission.id);
    setBusy(false);
  }

  function openEdit() {
    setActionError('');
    setEditOpen(true);
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
    onRefresh(mission.id);
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
    onRefresh(mission.id);
  }

  async function ouvrirNoShow() {
    setNoShowOpen(true); setActionError('');
    const cfg = await getProfitConfigDB();
    setNoShowForm({ clientFee: String(cfg.noShowClientFee ?? 0), cleanerFee: String(cfg.noShowCleanerFee ?? 0), note: '', motif: 'no_show' });
  }

  async function handleNoShow() {
    const fee = (v: string) => Math.max(0, Number(v.replace(',', '.')) || 0);
    setBusy(true); setActionError('');
    const res = await declareNoShowDB(mission.id, {
      clientFee: fee(noShowForm.clientFee), cleanerFee: fee(noShowForm.cleanerFee), note: noShowForm.note,
      motif: noShowForm.motif,
    });
    setBusy(false);
    if (res.error) { setActionError(res.error); toast(res.error, 'error'); return; }
    setNoShowOpen(false);
    toast(noShowForm.motif === 'prolongation' ? 'Mission clôturée : voyageur encore présent.' : 'Mission passée en no show.', 'success');
    onRefresh(mission.id);
  }

  async function handleCancelNoShow() {
    const ok = await confirm({
      title: 'Annuler le no show ?',
      message: 'Le prix et le gain d’origine reviennent, et la mission redevient à faire.',
      confirmLabel: 'Annuler le no show',
    });
    if (!ok) return;
    setBusy(true); setActionError('');
    const res = await cancelNoShowDB(mission.id);
    setBusy(false);
    if (res.error) { setActionError(res.error); toast(res.error, 'error'); return; }
    toast('No show annulé.', 'success');
    onRefresh(mission.id);
  }

  // Décision sur la demande d'un cleaner. Valider = attribuer la mission ;
  // refuser = la remettre à disposition des autres cleaners.
  async function decideRequest(approve: boolean) {
    setDeciding(true);
    const res = await decideMissionRequestDB(mission.id, approve);
    setDeciding(false);
    if (res.error) { setActionError(res.error); return; }
    toast(approve ? `Mission attribuée à ${mission.pendingCleanerName}.` : 'Demande refusée — mission de nouveau disponible.', 'success');
    onRefresh(mission.id);
  }

  // Retrait d'une mission à son cleaner. Confirmation demandée : il a pu
  // organiser sa journée autour, et il est notifié dans la foulée.
  async function handleUnassign() {
    const ok = await confirm({
      title: `Retirer la mission à ${mission.cleanerName} ?`,
      message: 'Elle repart dans les missions disponibles et il en est informé.',
      confirmLabel: 'Retirer', danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const res = await unassignMissionDB(mission.id);
    setBusy(false);
    if (res.error) { setActionError(res.error); toast(res.error, 'error'); return; }
    toast('Mission retirée — de nouveau disponible.', 'success');
    onRefresh(mission.id);
  }

  async function ouvrirConfier() {
    setConfierOpen(true); setActionError('');
    if (prestataires === null) {
      const r = await appelPrestataire<{ prestataires: Prestataire[] }>('list');
      setPrestataires(r.ok ? r.prestataires.filter(p => p.status === 'active' && !p.en_attente) : []);
      if (!r.ok) setActionError(r.error);
    }
  }

  async function handleConfier() {
    if (!newPrestataire) return;
    setBusy(true);
    const r = await appelPrestataire<{ count: number }>('confier', { missionIds: [mission.id], prestataireId: newPrestataire });
    setBusy(false);
    if (!r.ok) { setActionError(r.error); toast(r.error, 'error'); return; }
    if (!r.count) { toast('Mission déjà démarrée : impossible de la confier.', 'error'); return; }
    toast('Mission confiée — le prestataire choisit son agent.', 'success');
    setConfierOpen(false); setNewPrestataire('');
    onRefresh(mission.id);
  }

  async function handleReprendre() {
    const ok = await confirm({
      title: `Reprendre la mission à ${mission.prestataireName} ?`,
      message: 'Elle redevient « à attribuer » chez nous. Le prestataire (et son agent) en sont informés.',
      confirmLabel: 'Reprendre', danger: true,
    });
    if (!ok) return;
    setBusy(true);
    const r = await appelPrestataire('reprendre', { missionId: mission.id });
    setBusy(false);
    if (!r.ok) { setActionError(r.error); toast(r.error, 'error'); return; }
    toast('Mission reprise.', 'success');
    onRefresh(mission.id);
  }

  async function handleAssign() {
    if (!newCleaner) return;
    const c = cleaners.find(x => x.id === newCleaner);
    // Le gain cleaner est recalculé côté serveur : taux horaire × durée mission / 60.
    setBusy(true);
    await assignCleanerToMissionDB(mission.id, newCleaner, c?.name ?? '');
    setAssignOpen(false);
    setNewCleaner('');
    onRefresh(mission.id);
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
    onRefresh(mission.id);
  }

  async function resolveExtra(approve: boolean) {
    if (!user) return;
    setBusy(true); setActionError('');
    const res = await resolveExtraTimeDB(mission.id, approve, { id: user.id, role: 'admin' });
    setBusy(false);
    if (res.error) { setActionError(res.error); return; }
    onRefresh(mission.id);
  }

  const source = mission.source ?? 'hotel';

  // ── Repères pour la LIGNE COMPACTE (résumé au coup d'œil) ──
  const billable = mission.service !== 'delivery' && mission.service !== 'appointment';
  const unassigned = !mission.cleanerName && !mission.assigneeName && !mission.prestataireName;
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
          title={missionStatusLabel(mission.status, mission.service, mission.noShow)} />
        <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: '#1A1A1A', width: 44 }}>
          {mission.time ? formatHour(mission.time) : '—'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{mission.property || 'Mission'}</p>
          <p className="text-xs truncate" style={{ color: unassigned ? '#C48A2A' : '#A8A09A' }}>
            {mission.prestataireName
              ? `${mission.prestataireName}${mission.cleanerName ? ` · ${mission.cleanerName}` : ' · agent à choisir'}`
              : (mission.cleanerName ?? mission.assigneeName ?? 'Non assigné')}
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
        <span className="shrink-0 transition-transform" style={{ color: '#A8A09A', transform: expanded ? 'rotate(180deg)' : 'none' }}><Icon name="chevronDown" size={16} /></span>
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
          {mission.service !== 'appointment' && mission.service !== 'repair' && mission.service !== 'errand' && <span className="text-xs" style={{ color: '#A8A09A' }}>{TYPE_LABEL[mission.type] ?? mission.type}</span>}
          {/* Badge prestation : livraison, rendez-vous ou intervention (distinct). */}
          {(serviceParts(mission.service).delivery || mission.service === 'appointment' || mission.service === 'repair' || mission.service === 'errand') && (
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
          {missionStatusLabel(mission.status, mission.service, mission.noShow)}
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
              <Icon name="pin" size={13} className="shrink-0" />
              <span className="text-xs truncate">{mission.address}</span>
            </button>
          )}
        </div>

        {/* Date / heure / durée */}
        <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: '#7A7068' }}>
          <span>{formatDate(mission.date)}</span>
          {mission.time && <span className="inline-flex items-center gap-1">{source === 'airbnb' && mission.service !== 'repair' && mission.service !== 'errand' ? 'Départ ' : <Icon name="clock" size={14} />}{formatHour(mission.time)}</span>}
          {(mission.missionDurationMinutes ?? 0) > 0 && <span className="inline-flex items-center gap-1"><Icon name="timer" size={14} />{formatDuration(mission.missionDurationMinutes)}</span>}
        </div>

        {/* Intervention : métier visé + travail à faire. */}
        {mission.service === 'repair' && (
          <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: '#4A6A8A30', backgroundColor: '#4A6A8A0A' }}>
            <p className="text-xs font-semibold" style={{ color: '#3F5A78' }}>
              {mission.repairSpecialite ? libelleSpecialite(mission.repairSpecialite) : 'Intervention'}
            </p>
            {mission.repairDetails && <p className="text-sm mt-1 whitespace-pre-wrap" style={{ color: '#4A4540' }}>{mission.repairDetails}</p>}
          </div>
        )}

        {/* Course / achat : quoi, budget, ticket, qui a payé, remboursement. */}
        {mission.service === 'errand' && <BlocCourse mission={mission} onRefresh={onRefresh} />}

        {/* Maison louée à la chambre : périmètre exact du ménage. */}
        {mission.coveredUnits && (
          <span className="inline-block px-2.5 py-1 rounded-lg text-xs font-semibold w-fit"
            style={{ backgroundColor: mission.wholeProperty ? '#FBF4E2' : '#F5F3EF', color: mission.wholeProperty ? '#9A7B22' : '#7A7068' }}>
            {mission.coveredUnits}
          </span>
        )}

        {mission.noShow && (
          <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: '#8A6BB040', backgroundColor: '#8A6BB00D' }}>
            <p className="text-xs font-semibold" style={{ color: '#8A6BB0' }}>
              {titreNoShow(mission.noShowReason)} — {mission.noShowBy === 'cleaner' ? `constaté par ${mission.cleanerName ?? 'le cleaner'}` : 'déclaré par l’administration'}
              {mission.noShowAt ? ` à ${formatClock(mission.noShowAt)}` : ''}
            </p>
            {mission.noShowNote && <p className="text-xs mt-1" style={{ color: '#7A7068' }}>{mission.noShowNote}</p>}
            <p className="text-[11px] mt-1" style={{ color: '#A8A09A' }}>
              Forfait déplacement : {money(mission.price ?? 0)} facturé · {money(mission.cleanerGain ?? 0)} pour le cleaner
            </p>
          </div>
        )}

        {/* Demande d'un cleaner en attente. Un cleaner ne s'assigne plus une
            mission lui-même : rien ne bouge tant que l'admin n'a pas tranché. */}
        {mission.pendingCleanerName && (
          <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: '#EBD9A8', backgroundColor: '#FBF4E2' }}>
            <p className="text-xs font-semibold" style={{ color: '#9A7B22' }}>
              {mission.pendingCleanerName} demande cette mission
            </p>
            <div className="flex gap-2 mt-2">
              <button onClick={() => decideRequest(true)} disabled={deciding}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50"
                style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>
                {deciding ? '…' : 'Valider'}
              </button>
              <button onClick={() => decideRequest(false)} disabled={deciding}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-50"
                style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                Refuser
              </button>
            </div>
          </div>
        )}

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
          {mission.prestataireName ? (
            <div>
              <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Prestataire</p>
              <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{mission.prestataireName}</p>
              <p className="text-xs" style={{ color: mission.cleanerName ? '#7A7068' : '#C48A2A' }}>
                {mission.cleanerName ? `Agent : ${mission.cleanerName}` : 'Agent à choisir'}
              </p>
            </div>
          ) : (
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Cleaner</p>
            <p className="text-sm font-medium" style={{ color: mission.cleanerName ? '#1A1A1A' : '#C48A2A' }}>
              {mission.cleanerName ?? 'Non assigné'}
            </p>
          </div>
          )}
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
          {mission.prestataireName ? (
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Taux prestataire</p>
            <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>
              {mission.prestataireRateSnapshot != null ? `${money(mission.prestataireRateSnapshot)}/h` : '—'}
            </p>
          </div>
          ) : (
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>{mission.service === 'delivery' ? 'Forfait cleaner' : 'Taux cleaner'}</p>
            <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>
              {mission.service === 'delivery'
                ? `${money(mission.cleanerGain ?? 0)} / livraison`
                : (mission.cleanerHourlyRateSnapshot != null ? `${money(mission.cleanerHourlyRateSnapshot)}/h` : '—')}
            </p>
          </div>
          )}
          {/* Livraison : jamais facturée au client → on masque le prix client. */}
          {mission.service !== 'delivery' && (
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>Prix client</p>
            <p className="text-sm font-semibold" style={{ color: '#5A8A6A' }}>{money(mission.price)}</p>
          </div>
          )}
          <div>
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>{mission.prestataireName ? 'Dû au prestataire' : 'Gain cleaner'}</p>
            <p className="text-sm font-semibold" style={{ color: '#C9A84C' }}>
              {money(mission.prestataireName ? (mission.prestataireGain ?? 0) : (mission.cleanerGain ?? 0))}
            </p>
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
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-2 flex items-center gap-1.5" style={{ color: '#5B6EF5' }}><Icon name="clock" size={13} /> Pointage</p>
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
            <p className="text-xs font-semibold flex items-center gap-1.5" style={{ color: '#C48A2A' }}>
              <Icon name="timer" size={13} /> Demande de +{mission.extraTimeMinutes} min
            </p>
            {mission.extraTimeReason && (
              <p className="text-xs" style={{ color: '#7A7068' }}>« {mission.extraTimeReason} »</p>
            )}
            <div className="flex gap-2">
              <button onClick={() => resolveExtra(true)} disabled={busy}
                className="flex-1 py-2 rounded-lg text-xs font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>
                <Icon name="check" size={13} /> Accorder
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
          <p className="text-xs inline-flex items-center gap-1.5" style={{ color: '#5A8A6A' }}><Icon name="timer" size={13} /> Temps supplémentaire accordé (+{mission.extraTimeMinutes} min, inclus dans la durée).</p>
        )}
        {mission.extraTimeStatus === 'refused' && (
          <p className="text-xs inline-flex items-center gap-1.5" style={{ color: '#A8A09A' }}><Icon name="timer" size={13} /> Demande de temps refusée.</p>
        )}

        {/* Évaluation donnée par le client (conciergerie) — suivi qualité. */}
        {mission.partnerRating != null && (
          <div className="rounded-xl border px-3 py-2.5" style={{ borderColor: '#EBD9A8', backgroundColor: '#FCF6E8' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: '#8A6A1E' }}>
              Note du client
            </p>
            <div className="flex items-center gap-1" style={{ color: '#8A6A1E' }}>
              {[1, 2, 3, 4, 5].map(n => (
                <Icon key={n} name="star" size={14} filled={n <= mission.partnerRating!} />
              ))}
              <span className="text-xs font-bold ml-1">{mission.partnerRating}/5</span>
            </div>
            {mission.partnerRatingComment && (
              <p className="text-sm mt-1.5" style={{ color: '#4A443D' }}>{mission.partnerRatingComment}</p>
            )}
          </div>
        )}

        {/* Photos avant/après (consultation, zoom, téléchargement) */}
        <MissionPhotos missionId={mission.id} mode="viewer" />
        <MissionReport missionId={mission.id} mode="viewer" />
        {/* Conformité au standard du logement : ce que le partenaire verra de son côté. */}
        {mission.airbnbId && (
          <ChecklistPanel airbnbId={mission.airbnbId} missionId={mission.id} mode="viewer" showTimes />
        )}
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
          <FormulaireModification mission={mission} cleaners={cleaners} source={source}
            onError={setActionError}
            onSaved={() => { setEditOpen(false); onRefresh(mission.id); }}
            onCancel={() => { setEditOpen(false); setActionError(''); }} />
        ) : confierOpen ? (
          /* Confier la mission à un prestataire (sous-traitant) */
          <div className="space-y-2">
            <div className="flex gap-2">
              <select value={newPrestataire} onChange={e => setNewPrestataire(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl text-sm border appearance-none"
                style={{ ...inputStyle, color: newPrestataire ? '#1A1A1A' : '#A8A09A' }}>
                <option value="">{prestataires === null ? 'Chargement…' : 'Choisir un prestataire'}</option>
                {(() => {
                  // Ceux dont la spécialité colle à la mission d'abord ; les autres restent choisissables.
                  const attendues = specialitesPourMission(mission);
                  const choix = (prestataires ?? []).filter(p => p.id !== mission.prestataireId);
                  const adaptes = choix.filter(p => correspondSpecialite(p.specialites, attendues));
                  const autres = choix.filter(p => !adaptes.includes(p));
                  const option = (p: Prestataire) => (
                    <option key={p.id} value={p.id}>{p.name} · {money(p.hourly_rate)}/h{p.sap_declare ? ' · SAP' : ''}{p.vehicules != null ? ` · ${libelleVehicules(p.vehicules)}` : ''}</option>
                  );
                  if (!adaptes.length) return autres.map(option);
                  return (<>
                    <optgroup label="Spécialité adaptée">{adaptes.map(option)}</optgroup>
                    {autres.length > 0 && <optgroup label="Autres prestataires">{autres.map(option)}</optgroup>}
                  </>);
                })()}
              </select>
              <button onClick={handleConfier} disabled={!newPrestataire || busy}
                className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>OK</button>
              <button onClick={() => { setConfierOpen(false); setNewPrestataire(''); }}
                className="px-3 py-2 rounded-xl text-sm"
                style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>✕</button>
            </div>
            {prestataires !== null && prestataires.length === 0 && (
              <p className="text-xs" style={{ color: '#A8A09A' }}>Aucun prestataire actif. Créez-en un dans Équipe › Prestataires.</p>
            )}
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
              {/* Sous-traitance : confier à un prestataire, ou le lui reprendre. */}
              {(mission.status === 'pending' || mission.status === 'accepted') && mission.service !== 'appointment' && (
                <button onClick={ouvrirConfier} disabled={busy}
                  className="px-4 py-2.5 rounded-xl text-sm border disabled:opacity-50"
                  style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                  {mission.prestataireId ? 'Changer de prestataire' : 'Confier à un prestataire'}
                </button>
              )}
              {mission.prestataireId && (mission.status === 'pending' || mission.status === 'accepted') && (
                <button onClick={handleReprendre} disabled={busy}
                  className="px-4 py-2.5 rounded-xl text-sm border disabled:opacity-50"
                  style={{ borderColor: '#EAC4BE', color: '#B85A50' }}>
                  Reprendre au prestataire
                </button>
              )}
              {/* Retirer la mission au cleaner sans la réassigner tout de suite :
                  elle retourne au pot commun et redevient demandable. */}
              {(mission.status === 'accepted' || mission.status === 'in_progress') && mission.cleanerName && (
                <button onClick={handleUnassign} disabled={busy}
                  className="px-4 py-2.5 rounded-xl text-sm border disabled:opacity-50"
                  style={{ borderColor: '#EAC4BE', color: '#B85A50' }}>
                  Retirer au cleaner
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
              {/* No show / prolongation : clôture sans ménage, au forfait déplacement. */}
              {(mission.status === 'pending' || mission.status === 'accepted' || mission.status === 'in_progress')
                && noShowPossible(mission.service) && !noShowOpen && (
                <button onClick={ouvrirNoShow} disabled={busy}
                  className="px-4 py-2.5 rounded-xl text-sm border disabled:opacity-50"
                  style={{ borderColor: '#E8E4DC', color: '#8A6BB0' }}>
                  {NO_SHOW_BOUTON}
                </button>
              )}
              {mission.noShow && mission.status === 'completed' && (
                <button onClick={handleCancelNoShow} disabled={busy}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold border disabled:opacity-50"
                  style={{ borderColor: '#8A6BB0', color: '#8A6BB0' }}>
                  {motifNoShow(mission.noShowReason) === 'prolongation' ? 'Annuler (prolongation)' : 'Annuler le no show'}
                </button>
              )}
              {/* Mission terminée : l'admin peut la reprendre (« en cours »). */}
              {mission.status === 'completed' && !mission.noShow && (
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

            {noShowOpen && (
              <div className="rounded-xl p-3 space-y-2.5" style={{ backgroundColor: '#F8F6F2' }}>
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{NO_SHOW_BOUTON}</p>
                <NoShowMotifChoix valeur={noShowForm.motif} onChange={m => setNoShowForm(f => ({ ...f, motif: m }))} />
                <p className="text-[11px]" style={{ color: '#7A7068' }}>
                  La mission est clôturée sans ménage. Le client paie le forfait déplacement, le cleaner touche son forfait.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="block">
                    <span className="block text-[11px] mb-1" style={{ color: '#A8A09A' }}>Facturé au client (€)</span>
                    <input inputMode="decimal" value={noShowForm.clientFee}
                      onChange={e => setNoShowForm(f => ({ ...f, clientFee: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
                  </label>
                  <label className="block">
                    <span className="block text-[11px] mb-1" style={{ color: '#A8A09A' }}>Payé au cleaner (€)</span>
                    <input inputMode="decimal" value={noShowForm.cleanerFee}
                      onChange={e => setNoShowForm(f => ({ ...f, cleanerFee: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
                  </label>
                </div>
                <input value={noShowForm.note} onChange={e => setNoShowForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Remarque (facultatif)"
                  className="w-full px-3 py-2 rounded-lg text-sm border" style={inputStyle} />
                <div className="flex flex-col sm:flex-row gap-2">
                  <button onClick={handleNoShow} disabled={busy}
                    className="w-full sm:flex-1 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                    style={{ backgroundColor: '#8A6BB0', color: '#FFFFFF' }}>
                    {busy ? '...' : noShowForm.motif === 'prolongation' ? 'Clôturer : voyageur encore présent' : 'Passer en no show'}
                  </button>
                  <button onClick={() => { setNoShowOpen(false); setActionError(''); }} disabled={busy}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                    Annuler
                  </button>
                </div>
              </div>
            )}

            {/* Ajouter du temps — possible même sur une mission TERMINÉE (régularise la
                durée payée par rapport au temps prévu, recalcule le gain cleaner).
                Sans objet sur un no show : le cleaner est payé au forfait. */}
            {mission.status !== 'cancelled' && !mission.noShow && (
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
                  className="w-full py-2.5 rounded-xl text-sm font-medium border disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
                  style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                  <Icon name="timer" size={14} /> Ajouter du temps{mission.status === 'completed' ? ' (mission terminée)' : ''}
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

