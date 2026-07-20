'use client';

// Onglet « Créer » de l'écran admin Missions, extrait pour alléger la page.
// Cinq modes de création (une mission, plusieurs appartements, récurrente,
// intervention ponctuelle, rendez-vous) + gestion des ménages récurrents.
// Ce panneau détient TOUT l'état de création ; il ne remonte au parent que deux
// signaux : onReload (rafraîchir les données) et onGoToMissions (basculer sur
// l'onglet Missions après une création réussie). Comportement identique à avant.

import { useState } from 'react';
import { createMissionDB, createMissionsBatchDB, createAppointmentDB, createOneShotMissionDB } from '@/lib/db';
import { createRecurringDB, updateRecurringDB, setRecurringActiveDB, deleteRecurringDB, generateRecurringMissions } from '@/lib/recurring';
import { geocodeAddress } from '@/lib/zones';
import type { MissionType, MissionSource, MissionService, Apartment, RecurringMission } from '@/lib/types';
import { useFeedback } from '@/contexts/FeedbackContext';
import { SERVICE_LABEL, canCleanerDoService, serviceParts } from '@/lib/service';
import { computeMissionGain, DURATION_PRESETS } from '@/lib/pay';
import { formatDuration, formatHour, DEPARTURE_TIMES, ARRIVAL_TIMES } from '@/lib/format';
import { inputStyle } from '@/lib/ui';

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

interface Props {
  cleaners: any[];
  hotels: any[];
  airbnbs: Apartment[];
  staff: { id: string; name: string; role: string }[];
  recurrings: RecurringMission[];
  userId?: string;
  onReload: () => Promise<void> | void;
  onGoToMissions: () => void;
}

export default function MissionCreatePanel({ cleaners, hotels, airbnbs, staff, recurrings, userId, onReload, onGoToMissions }: Props) {
  const { confirm, toast } = useFeedback();
  const [createMode, setCreateMode] = useState<'single' | 'batch' | 'appointment' | 'oneshot' | 'recurring'>('single');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState(emptyForm);

  const [apptForm, setApptForm] = useState({ title: '', description: '', date: '', time: '', assigneeId: '' });
  const [apptBusy, setApptBusy] = useState(false);
  const [apptError, setApptError] = useState('');

  const [osForm, setOsForm] = useState({ siteId: '', property: '', address: '', date: '', time: '', durationMinutes: '120', price: '', instructions: '' });
  const [osCleaners, setOsCleaners] = useState<Set<string>>(new Set());
  const [osBusy, setOsBusy] = useState(false);
  const [osError, setOsError] = useState('');

  const [recForm, setRecForm] = useState({ siteId: '', property: '', address: '', time: '', durationMinutes: '60', price: '', cleanerId: '', startDate: '', endDate: '' });
  const [recWeekdays, setRecWeekdays] = useState<Set<number>>(new Set());
  const [recBusy, setRecBusy] = useState(false);
  const [recError, setRecError] = useState('');
  const [editingRecId, setEditingRecId] = useState<string | null>(null);

  const [batchApts, setBatchApts] = useState<Set<string>>(new Set());
  const [batchDate, setBatchDate] = useState('');
  const [batchTime, setBatchTime] = useState('');
  const [batchCleaner, setBatchCleaner] = useState('');
  const [batchZone, setBatchZone] = useState('all');
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchError, setBatchError] = useState('');
  const [batchDone, setBatchDone] = useState('');

  // ── Rendez-vous ──
  async function handleCreateAppointment(e: React.FormEvent) {
    e.preventDefault();
    if (!apptForm.title.trim() || !apptForm.date) { setApptError('Titre et date requis.'); return; }
    setApptBusy(true); setApptError('');
    const a = staff.find(s => s.id === apptForm.assigneeId);
    const res = await createAppointmentDB({
      title: apptForm.title.trim(), description: apptForm.description, date: apptForm.date, time: apptForm.time,
      assigneeId: apptForm.assigneeId || undefined, assigneeRole: a?.role, assigneeName: a?.name, createdBy: userId,
    });
    setApptBusy(false);
    if (res.error) { setApptError(res.error); return; }
    setApptForm({ title: '', description: '', date: '', time: '', assigneeId: '' });
    await onReload(); onGoToMissions();
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
      cleaners: chosen, createdBy: userId,
    });
    setOsBusy(false);
    if (res.error) { setOsError(res.error); return; }
    setOsForm({ siteId: '', property: '', address: '', date: '', time: '', durationMinutes: '120', price: '', instructions: '' });
    setOsCleaners(new Set());
    await onReload(); onGoToMissions();
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
      : await createRecurringDB({ ...payload, createdBy: userId });
    setRecBusy(false);
    if (res.error) { setRecError(res.error); return; }
    resetRecForm();
    await onReload(); onGoToMissions();
  }
  async function regenRecurring() {
    setRecBusy(true);
    try { await generateRecurringMissions(); }
    catch (e) { console.error('regen recurring:', e); }
    setRecBusy(false);
    await onReload();
  }
  async function toggleRecActive(id: string, active: boolean) { await setRecurringActiveDB(id, active); await onReload(); }
  async function removeRec(id: string) {
    const ok = await confirm({ title: 'Supprimer ce ménage récurrent ?', message: 'Les missions déjà créées sont conservées.', confirmLabel: 'Supprimer', danger: true });
    if (!ok) return;
    await deleteRecurringDB(id); await onReload();
    toast('Ménage récurrent supprimé.', 'success');
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
      createdBy: userId,
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

    setForm(emptyForm);
    await onReload();
    onGoToMissions();
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
      createdBy: userId,
      createdByRole: 'admin',
    });
    setBatchBusy(false);

    if (res.error) { setBatchError(`Erreur Supabase : ${res.error}`); return; }
    setBatchDone(`${res.count} mission${res.count > 1 ? 's' : ''} créée${res.count > 1 ? 's' : ''}.`);
    setBatchApts(new Set());
    setBatchDate(''); setBatchTime(''); setBatchCleaner('');
    await onReload();
    onGoToMissions();
  }

  // Zones présentes parmi les appartements (filtre de la création groupée).
  const batchZones = (() => {
    const map = new Map<string, string>();
    airbnbs.forEach(a => { if (a.zoneName) map.set(a.zoneName, a.zoneColor ?? '#9CA3AF'); });
    return Array.from(map.entries()).map(([name, color]) => ({ name, color }));
  })();
  const batchVisibleApts = batchZone === 'all' ? airbnbs : airbnbs.filter(a => (a.zoneName ?? '') === batchZone);

  return (
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
                    onClick={() => setOsCleaners(prev => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
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
                      onClick={() => setRecWeekdays(prev => { const n = new Set(prev); if (n.has(w.n)) n.delete(w.n); else n.add(w.n); return n; })}
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
  );
}
