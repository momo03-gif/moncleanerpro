'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedback } from '@/contexts/FeedbackContext';
import { getMissionsForCleanerDB } from '@/lib/db';
import { recordParkingPaymentClient, getMissionParkingClient, quoteParkingClient } from '@/lib/parkingApi';
import {
  submitStart, submitFinish, submitDeliver, submitWithdraw, submitExtraTime,
  initOfflineSync, syncQueue, queueSummary, dismissRejected, QUEUE_CHANGE_EVENT, type QueueSummary,
} from '@/lib/offline/queue';
import { supabase } from '@/lib/supabase';
import type { Mission, ParkingPayment } from '@/lib/types';
import { sortMissionsForCleaner } from '@/lib/missionOrder';
import { serviceLabel, SERVICE_BADGE, serviceParts } from '@/lib/service';
import { cacheMissions, readCachedMissions } from '@/lib/offline/store';
import { MISSION_STATUS_CFG, MISSION_TYPE_LABEL, missionStatusLabel, missionOriginLabel } from '@/lib/labels';
import { formatDuration, formatHour } from '@/lib/format';
import { getApproxPosition } from '@/lib/geo';
import { mapsUrl } from '@/lib/maps';
import MissionPhotos from '@/components/MissionPhotos';
import MissionReport from '@/components/MissionReport';
import RepairsPanel from '@/components/RepairsPanel';
import SiteAccessVideo from '@/components/SiteAccessVideo';
import { getSiteVideosMap } from '@/lib/siteVideos';
import Icon from '@/components/Icon';
import Loading from "@/components/Loading";

// Incréments proposés pour une demande de temps supplémentaire (minutes).
const EXTRA_TIME_OPTIONS = [15, 30, 45, 60];

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

const STATUS_CFG = MISSION_STATUS_CFG;

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

function MissionCard({ mission, userId, onUpdate, highlight }: { mission: Mission; userId: string; onUpdate: () => void; highlight?: boolean }) {
  const { confirm, toast } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [extraMinutes, setExtraMinutes] = useState(30);
  const [extraReason, setExtraReason] = useState('');
  const [extraError, setExtraError] = useState('');
  const [geoError, setGeoError] = useState('');
  // Parking (module Livraison) : saisie manuelle du montant, liée à l'adresse mission.
  const [parkingOpen, setParkingOpen] = useState(false);
  const [parkingAmount, setParkingAmount] = useState('');
  const [parkingDuration, setParkingDuration] = useState('');
  const [parkingBusy, setParkingBusy] = useState(false);
  const [parkingError, setParkingError] = useState('');
  const [parkingPayments, setParkingPayments] = useState<ParkingPayment[]>([]);
  // Tarif calculé par le fournisseur pour la durée (null = saisie manuelle du montant).
  const [parkingQuote, setParkingQuote] = useState<number | null>(null);
  const st = STATUS_CFG[mission.status] ?? STATUS_CFG.pending;
  // Livraison : pas de pointage ni GPS, juste un bouton « Livré ».
  const isDelivery = mission.service === 'delivery';
  // Rendez-vous : mission interne planifiée, sans GPS/pointage ni facturation.
  const isAppointment = mission.service === 'appointment';
  // Livraison et rendez-vous se clôturent en un clic, sans pointage GPS.
  const isSimple = isDelivery || isAppointment;
  const isOpen = mission.status !== 'completed' && mission.status !== 'cancelled';
  // Le stationnement concerne toute mission incluant une livraison (livraison pure
  // OU nettoyage + livraison) : c'est là que le livreur se déplace en véhicule.
  const hasDelivery = serviceParts(mission.service).delivery;
  // Le temps supplémentaire ne concerne que le NETTOYAGE (rallonger une durée de
  // ménage) — inutile sur une livraison pure.
  const hasCleaning = serviceParts(mission.service).cleaning;
  const canStart  = !isSimple && (mission.status === 'accepted' || mission.status === 'pending');
  const canFinish = !isSimple && mission.status === 'in_progress';
  const canDeliver = isSimple && isOpen;
  const { portalCode, keyboxCode, extra } = parseMissionNotes(mission.notes);
  const notesIsLong = extra.length > 120;

  // Pointage : on capture une position approximative (best-effort) au démarrage
  // et à la fin. Le cleaner ne voit ni chrono ni durée réelle.
  // Pointage : hors-ligne, l'action est mise en file (heure + GPS capturés sur place)
  // et rejouée à la reconnexion — l'UI progresse tout de suite (cache optimiste).
  async function start() {
    setBusy(true); setGeoError('');
    const pos = await getApproxPosition();
    const res = await submitStart({ missionId: mission.id, userId, coords: pos });
    setBusy(false);
    if (res.error) { setGeoError(res.error); return; }
    onUpdate();
  }

  async function finish() {
    setBusy(true); setGeoError('');
    const pos = await getApproxPosition();
    const res = await submitFinish({ missionId: mission.id, userId, coords: pos });
    setBusy(false);
    if (res.error) { setGeoError(res.error); return; }
    onUpdate();
  }

  async function deliver() {
    setBusy(true); setGeoError('');
    const res = await submitDeliver({ missionId: mission.id, userId });
    setBusy(false);
    if (res.error) { setGeoError(res.error); return; }
    onUpdate();
  }

  // Désistement : le cleaner renonce à SA mission. Elle n'est ni annulée ni
  // supprimée (il n'en a pas le droit) — elle retourne à l'admin qui la réattribue.
  async function withdraw() {
    const ok = await confirm({
      title: 'Se désister de cette mission ?',
      message: "Elle sera rendue à l'administrateur, qui la confiera à un autre cleaner.",
      confirmLabel: 'Me désister', danger: true,
    });
    if (!ok) return;
    setBusy(true); setGeoError('');
    const res = await submitWithdraw({ missionId: mission.id, userId });
    setBusy(false);
    if (res.error) { setGeoError(res.error); toast(res.error, 'error'); return; }
    toast('Mission rendue à l’administrateur.', 'success');
    onUpdate();
  }

  async function submitExtra() {
    setBusy(true); setExtraError('');
    const res = await submitExtraTime({ missionId: mission.id, userId, minutes: extraMinutes, reason: extraReason });
    setBusy(false);
    if (res.error) { setExtraError(res.error); return; }
    setExtraOpen(false); setExtraReason('');
    onUpdate();
  }

  // Réaffiche les paiements de parking déjà enregistrés (persistance après reload).
  useEffect(() => {
    if (!hasDelivery) return;
    getMissionParkingClient(mission.id).then(rows => { if (Array.isArray(rows)) setParkingPayments(rows); });
  }, [mission.id, hasDelivery]);

  // Récupère le tarif calculé pour la durée (si le fournisseur tarife). Sinon null →
  // le livreur saisit le montant lui-même.
  async function refreshParkingQuote(durationStr: string) {
    const dur = parseInt(durationStr, 10);
    if (!Number.isFinite(dur) || dur <= 0) { setParkingQuote(null); return; }
    const res = await quoteParkingClient(mission.id, dur);
    setParkingQuote(res?.quote?.amount ?? null);
  }

  async function payParking() {
    setParkingBusy(true); setParkingError('');
    // Le parking se paie EN LIGNE uniquement (pas de mise en file hors-ligne).
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setParkingError('Le paiement du parking nécessite une connexion internet.');
      setParkingBusy(false); return;
    }
    const dur = parkingDuration ? parseInt(parkingDuration, 10) : undefined;
    // Montant : tarif fournisseur s'il existe, sinon saisie manuelle du livreur.
    let amt: number;
    if (parkingQuote != null) {
      amt = parkingQuote;
    } else {
      amt = parseFloat(parkingAmount.replace(',', '.'));
      if (!Number.isFinite(amt) || amt <= 0) { setParkingError('Montant invalide.'); setParkingBusy(false); return; }
    }
    // Position du livreur : on ne peut payer qu'à proximité (≤ 200 m) de l'adresse mission.
    const pos = await getApproxPosition();
    const res = await recordParkingPaymentClient({ missionId: mission.id, amount: amt, durationMinutes: dur, lat: pos?.lat, lng: pos?.lng });
    setParkingBusy(false);
    if (res.error || !res.payment) { setParkingError(res.error || "Échec de l'enregistrement."); return; }
    setParkingPayments(prev => [res.payment as ParkingPayment, ...prev]);
    setParkingOpen(false); setParkingAmount(''); setParkingDuration(''); setParkingQuote(null);
  }

  const extraStatus = mission.extraTimeStatus;

  // Mise en avant de la mission active (en cours / prochaine à faire) : anneau doré.
  const inProgress = mission.status === 'in_progress';
  return (
    <div className="rounded-2xl border overflow-hidden transition-all"
      style={{
        backgroundColor: '#FFFFFF',
        borderColor: highlight ? '#C9A84C' : '#E8E4DC',
        boxShadow: highlight ? '0 0 0 3px #C9A84C22' : 'none',
      }}>
      {/* Bandeau « en cours » pour repérer instantanément la mission active. */}
      {highlight && inProgress && (
        <div className="px-5 py-1.5 text-xs font-semibold flex items-center gap-1.5" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#1A1A1A' }} /> En cours
        </div>
      )}

      {/* Header */}
      <div className="px-5 py-4 border-b" style={{ borderColor: '#F2EFE9' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs mb-0.5" style={{ color: '#A8A09A' }}>
              {new Date(mission.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h3 className="font-semibold" style={{ color: '#1A1A1A' }}>{mission.property || 'Mission'}</h3>
            {mission.address && (
              <a href={mapsUrl(mission.address)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 mt-0.5 text-left transition-colors"
                style={{ color: '#A8A09A' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#C9A84C')}
                onMouseLeave={e => (e.currentTarget.style.color = '#A8A09A')}>
                <Icon name="pin" size={13} className="shrink-0" />
                <span className="text-xs truncate max-w-[220px]">{mission.address}</span>
              </a>
            )}
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
            style={{ backgroundColor: st.bg, color: st.color }}>{missionStatusLabel(mission.status, mission.service)}</span>
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
            <div className="flex items-center gap-1.5" style={{ color: '#C9A84C' }}>
              <Icon name="clock" size={15} />
              <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{formatHour(mission.time)}</span>
            </div>
          )}
          {(mission.missionDurationMinutes ?? 0) > 0 && (
            <div className="flex items-center gap-1.5" style={{ color: '#C9A84C' }}>
              <Icon name="timer" size={15} />
              <span className="text-sm" style={{ color: '#7A7068' }}>{formatDuration(mission.missionDurationMinutes)}</span>
            </div>
          )}
          {/* Origine : type de site / récurrent / source — sans objet pour un rendez-vous. */}
          {!isAppointment && (
            <span className="text-xs px-2 py-0.5 rounded"
              style={{ backgroundColor: mission.source === 'airbnb' ? '#C9A84C15' : '#F5F3EF', color: mission.source === 'airbnb' ? '#C9A84C' : '#7A7068' }}>
              {missionOriginLabel(mission)}
            </span>
          )}
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

        {/* Vidéo d'accès du logement (si le site en a une) : comment s'y rendre,
            où trouver la clé. Chargée à la demande — aucun téléchargement auto. */}
        {mission.accessVideoUrl && mission.airbnbId && (
          <SiteAccessVideo airbnbId={mission.airbnbId} videoUrl={mission.accessVideoUrl} mode="view" />
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

      {/* Photos avant/après + rapport + temps supplémentaire — sans objet pour un
          rendez-vous (pas de logement à photographier / rapporter). */}
      {mission.status !== 'cancelled' && !isAppointment && (
        <div className="px-5 pb-4 space-y-3">
          <MissionPhotos missionId={mission.id} mode="cleaner" userId={userId} />
          <MissionReport missionId={mission.id} mode="cleaner" userId={userId} />
          {/* Réparations du logement : ce que le cleaner signale ici reste ouvert
              jusqu'à ce que le propriétaire l'ait fait réparer. */}
          {mission.airbnbId && (
            <RepairsPanel airbnbId={mission.airbnbId} missionId={mission.id}
              role="cleaner" authorName={mission.cleanerName} />
          )}

          {/* Temps supplémentaire : utile uniquement pour le NETTOYAGE (rallonger une
              durée de ménage). Masqué sur les missions de livraison pure. */}
          {hasCleaning && (extraStatus === 'pending' ? (
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
              className="w-full py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2"
              style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
              <Icon name="timer" size={14} /> Demander plus de temps
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
          ))}
        </div>
      )}

      {/* Stationnement (livraison) — saisie manuelle du montant, liée à l'adresse.
          Visible dès qu'une livraison est à effectuer et que la mission est ouverte. */}
      {hasDelivery && isOpen && (
        <div className="px-5 pb-4 space-y-2">
          {parkingPayments.length > 0 && (
            <div className="px-3 py-2.5 rounded-xl text-xs font-medium space-y-0.5" style={{ backgroundColor: '#5A8A6A15', color: '#5A8A6A' }}>
              {parkingPayments.map(p => (
                <div key={p.id}>
                  Parking payé{p.amount != null ? ` : ${p.amount.toFixed(2)} €` : ''}
                  {` à ${new Date(p.paidAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`}
                  {p.durationMinutes ? ` · ${p.durationMinutes} min` : ''}
                </div>
              ))}
            </div>
          )}
          {!parkingOpen ? (
            <button onClick={() => setParkingOpen(true)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold border flex items-center justify-center gap-2"
              style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
              <Icon name="wallet" size={15} /> Payer le parking
            </button>
          ) : (
            <div className="rounded-xl p-3 space-y-2.5" style={{ backgroundColor: '#F8F6F2' }}>
              <p className="text-[11px]" style={{ color: '#7A7068' }}>
                {parkingQuote != null
                  ? 'Choisissez la durée — le tarif est calculé automatiquement.'
                  : 'Montant du stationnement payé pour cette livraison.'}
              </p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[11px] mb-1" style={{ color: '#A8A09A' }}>Durée (min{parkingQuote != null ? '' : ', fac.'})</label>
                  <input value={parkingDuration}
                    onChange={e => { setParkingDuration(e.target.value); refreshParkingQuote(e.target.value); }}
                    inputMode="numeric" placeholder="30"
                    className="w-full px-3 py-2 rounded-lg text-sm border"
                    style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF', color: '#1A1A1A', outline: 'none' }} />
                </div>
                <div className="flex-1">
                  {parkingQuote != null ? (
                    <>
                      <label className="block text-[11px] mb-1" style={{ color: '#A8A09A' }}>Tarif</label>
                      <div className="w-full px-3 py-2 rounded-lg text-sm border font-semibold"
                        style={{ borderColor: '#E8E4DC', backgroundColor: '#F5F3EF', color: '#1A1A1A' }}>
                        {parkingQuote.toFixed(2)} €
                      </div>
                    </>
                  ) : (
                    <>
                      <label className="block text-[11px] mb-1" style={{ color: '#A8A09A' }}>Montant (€)</label>
                      <input value={parkingAmount} onChange={e => setParkingAmount(e.target.value)}
                        inputMode="decimal" placeholder="2,50"
                        className="w-full px-3 py-2 rounded-lg text-sm border"
                        style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF', color: '#1A1A1A', outline: 'none' }} />
                    </>
                  )}
                </div>
              </div>
              {parkingError && <p className="text-[11px]" style={{ color: '#B85A50' }}>{parkingError}</p>}
              <div className="flex gap-2">
                <button onClick={payParking} disabled={parkingBusy}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                  style={{ backgroundColor: '#C48A2A', color: '#FFFFFF' }}>
                  {parkingBusy ? '...' : 'Enregistrer le paiement'}
                </button>
                <button onClick={() => { setParkingOpen(false); setParkingError(''); }} disabled={parkingBusy}
                  className="px-4 py-2.5 rounded-xl text-xs border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {(canStart || canFinish || canDeliver) && (
        <div className="px-5 pb-5 space-y-2">
          {geoError && (
            <p className="text-xs px-3 py-2.5 rounded-xl" style={{ backgroundColor: '#B85A5012', color: '#B85A50' }}>{geoError}</p>
          )}
          {/* Livraison / rendez-vous : un seul clic pour clôturer, sans pointage ni GPS. */}
          {canDeliver && (
            <button onClick={deliver} disabled={busy}
              className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: isAppointment ? '#7C5CBF' : '#C48A2A', color: '#FFFFFF' }}>
              {!isAppointment && <Icon name="delivery" size={16} />}
              {busy ? '...' : isAppointment ? 'Marquer comme terminé' : 'Marquer comme livré'}
            </button>
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
              className="w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>
              {busy ? '...' : <><Icon name="check" size={16} /> Terminer la mission</>}
            </button>
          )}
          {/* Seule sortie possible pour le cleaner : rendre la mission à l'admin.
              Il ne peut ni l'annuler ni la supprimer. */}
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
  // Terminées repliées par défaut : le cleaner voit d'abord ce qu'il lui reste.
  const [showDone, setShowDone] = useState(false);
  // Horodatage de la dernière synchro quand on affiche des données du cache
  // (hors-ligne). null = données à jour (en ligne).
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  // File d'actions hors-ligne en attente / refusées.
  const [sync, setSync] = useState<QueueSummary>({ pending: 0, rejected: 0 });
  const today = toDateStr(new Date());
  const [dateStart, setDateStart] = useState(today);
  const [dateEnd, setDateEnd] = useState(today);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const load = useCallback(async () => {
    if (!user) return;
    // Hors-ligne : on sert directement le dernier planning connu (IndexedDB) sans
    // tenter le réseau, et on affiche le bandeau « données de [heure] ».
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const cached = await readCachedMissions(user.id);
      if (cached) { setMissions(cached.missions); setOfflineSince(cached.syncedAt); }
      setLoading(false);
      return;
    }
    // En ligne : affichage instantané du dernier planning connu (cache IndexedDB)
    // pendant qu'on rafraîchit en arrière-plan (stale-while-revalidate). Rouvrir
    // la page ou y revenir affiche donc les missions tout de suite, sans attente.
    const cached = await readCachedMissions(user.id);
    if (cached && cached.missions.length > 0) { setMissions(cached.missions); setLoading(false); }
    // Perf : on ne charge que ~6 mois d'historique (les missions futures sont
    // toujours incluses) — inutile de tirer tout l'historique sur mobile, et ça
    // évite que la requête ralentisse à mesure que les missions s'accumulent.
    const since = toDateStr(new Date(Date.now() - 183 * 86400000));
    const m = await getMissionsForCleanerDB(user.id, since);
    // Enrichissement vidéo d'accès : UNE requête dédiée et résiliente (découplée du
    // chargement des missions → si la colonne/feature n'existe pas, aucun impact).
    const videoMap = await getSiteVideosMap(m.map(x => x.airbnbId ?? '').filter(Boolean));
    const enriched = Object.keys(videoMap).length > 0
      ? m.map(x => (x.airbnbId && videoMap[x.airbnbId] ? { ...x, accessVideoUrl: videoMap[x.airbnbId] } : x))
      : m;
    setMissions(enriched);
    setOfflineSince(null);
    // On ne persiste pas un planning vide par-dessus un cache existant (une requête
    // en échec renvoie [] — inutile d'écraser des données valides).
    if (enriched.length > 0) await cacheMissions(user.id, enriched);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    // Recharge au changement d'état réseau : bascule bandeau ↔ données à jour.
    window.addEventListener('online', load);
    window.addEventListener('offline', load);
    const ch = supabase.channel('cleaner-missions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, load)
      .subscribe();
    return () => {
      window.removeEventListener('online', load);
      window.removeEventListener('offline', load);
      supabase.removeChannel(ch);
    };
  }, [load, user]);

  // Synchro de la file hors-ligne : auto au retour du réseau, et rafraîchissement de
  // l'indicateur + du planning à chaque changement d'état de la file.
  useEffect(() => {
    if (!user) return;
    initOfflineSync();
    const refresh = () => { queueSummary().then(setSync); load(); };
    refresh();
    window.addEventListener(QUEUE_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(QUEUE_CHANGE_EVENT, refresh);
  }, [user, load]);

  if (!user) return null;
  if (loading) return <Loading className="p-5 pt-8" variant="skeleton" />;

  const isToday = dateStart === today && dateEnd === today;
  const isSingleDay = dateStart === dateEnd;
  const tomorrow = toDateStr(new Date(Date.now() + 86400000));
  const { start: weekStart, end: weekEnd } = getWeekBounds();

  // Les missions terminées passent en bas : la prochaine à faire est toujours en tête.
  const filteredMissions = sortMissionsForCleaner(
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
    <div className="p-5 mcp-in">
      {/* Bandeau hors-ligne : données servies depuis le dernier cache local. */}
      {offlineSince && (
        <div className="mb-4 flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium"
          style={{ backgroundColor: '#F5F3EF', color: '#7A7068', border: '1px solid #E8E4DC' }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#A8A09A' }} />
          Hors-ligne · données de {new Date(offlineSince).toLocaleString('fr-FR', {
            day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
          })}
        </div>
      )}

      {/* Indicateur de synchro : actions faites hors-ligne, en attente de rejeu. */}
      {sync.pending > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium"
          style={{ backgroundColor: '#C9A84C15', color: '#C48A2A', border: '1px solid #C9A84C40' }}>
          <span>{sync.pending} action{sync.pending > 1 ? 's' : ''} en attente de synchro</span>
          <button onClick={() => syncQueue()}
            className="px-2.5 py-1 rounded-lg font-semibold shrink-0"
            style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            Synchroniser
          </button>
        </div>
      )}

      {/* Actions refusées à la reco (trop loin / GPS manquant) — à refaire sur place. */}
      {sync.rejected > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium"
          style={{ backgroundColor: '#B85A5012', color: '#B85A50', border: '1px solid #B85A5033' }}>
          <span>{sync.rejected} action{sync.rejected > 1 ? 's' : ''} refusée{sync.rejected > 1 ? 's' : ''} — à refaire sur place</span>
          <button onClick={() => dismissRejected()}
            className="px-2.5 py-1 rounded-lg font-semibold shrink-0 border"
            style={{ borderColor: '#B85A5055', color: '#B85A50' }}>
            Effacer
          </button>
        </div>
      )}

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

      {/* Progression : ce que le cleaner a fait / ce qui reste, en un coup d'œil. */}
      {filteredMissions.length > 0 && (() => {
        const total = filteredMissions.length;
        const pct = Math.round((completedCount / total) * 100);
        const allDone = completedCount === total;
        return (
          <div className="rounded-2xl p-4 mb-5" style={{ backgroundColor: allDone ? '#5A8A6A' : '#C9A84C' }}>
            <div className="flex items-end justify-between mb-2.5">
              <div>
                <p className="text-2xl font-bold leading-none" style={{ color: allDone ? '#FFFFFF' : '#1A1A1A' }}>
                  {completedCount}<span className="text-base font-semibold opacity-60">/{total}</span>
                </p>
                <p className="text-xs mt-1.5" style={{ color: allDone ? '#E4F0E8' : '#7A6030' }}>
                  {allDone ? 'Tout est terminé, bravo' : `${total - completedCount} ménage${total - completedCount > 1 ? 's' : ''} à faire`}
                </p>
              </div>
              <span className="text-sm font-bold" style={{ color: allDone ? '#FFFFFF' : '#7A6030' }}>{pct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.35)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: allDone ? '#FFFFFF' : '#1A1A1A' }} />
            </div>
          </div>
        );
      })()}

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
      ) : (() => {
        const todo = filteredMissions.filter(m => m.status !== 'completed');
        const done = filteredMissions.filter(m => m.status === 'completed');
        // Mission active mise en avant : celle en cours, sinon la prochaine à faire.
        const activeId = (todo.find(m => m.status === 'in_progress') ?? todo[0])?.id;
        return (
          <div className="space-y-3">
            {todo.map(m => (
              <MissionCard key={m.id} mission={m} userId={user.id} onUpdate={load} highlight={m.id === activeId} />
            ))}

            {/* Terminées : repliées, hors du chemin, dépliables au besoin. */}
            {done.length > 0 && (
              <div className="pt-1">
                <button onClick={() => setShowDone(s => !s)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold"
                  style={{ color: '#A8A09A' }}>
                  {done.length} terminée{done.length > 1 ? 's' : ''}
                  <span className="transition-transform" style={{ transform: showDone ? 'rotate(180deg)' : 'none' }}>
                    <Icon name="chevronDown" size={14} />
                  </span>
                </button>
                {showDone && (
                  <div className="space-y-3 mt-1">
                    {done.map(m => <MissionCard key={m.id} mission={m} userId={user.id} onUpdate={load} />)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
