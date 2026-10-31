'use client';

// Création d'UNE mission : ménage, livraison, intervention (artisan) ou course
// / achat — hôtel ou logement Airbnb (maisons louées à la chambre comprises).

import { useState } from 'react';
import { createMissionDB } from '@/lib/db';
import type { MissionType, MissionSource, MissionService } from '@/lib/types';
import { useFeedback } from '@/contexts/FeedbackContext';
import { SERVICE_LABEL, canCleanerDoService, serviceParts, estAuTemps } from '@/lib/service';
import { specialitesDuMetier } from '@/lib/prestataireRegles';
import { fraisServiceCourse } from '@/lib/course';
import { getProfitConfigDB } from '@/lib/profitability';
import { computeMissionGain, DURATION_PRESETS } from '@/lib/pay';
import { formatDuration, formatHour, DEPARTURE_TIMES, money } from '@/lib/format';
import ArriveeSuivante from '@/components/ArriveeSuivante';
import { inputStyle } from '@/lib/ui';
import { resolveCoords, type ProprietesCreation } from './commun';

const emptyForm = {
  source: 'hotel' as MissionSource,
  service: 'cleaning' as MissionService,  // ménage ou livraison
  hotelId: '', airbnbId: '',
  property: '', address: '',
  cleanerId: '', date: '', time: '',
  durationMinutes: '60', price: '',
  deliveryInstructions: '',
  // Intervention (artisan) : spécialité visée + travail à faire.
  repairSpecialite: '', repairDetails: '',
  // Course / achat : quoi acheter, budget accepté, prime de l'intervenant.
  // Les frais de service (= le prix) suivent le budget tant qu'on ne les
  // retouche pas à la main (feeAuto).
  errandDetails: '', errandBudget: '', errandBonus: '', feeAuto: true,
  nextArrival: '', nextArrivalTime: '',
  // Chambres à faire quand le bien est une maison louée à la chambre.
  // Vide = toutes (maison entière).
  selectedUnits: [] as string[],
};

// Intervention et course : pas un ménage — ni chambres, ni départ voyageur, ni
// prix ou durée du ménage du logement.
const horsMenage = (s: MissionService) => s === 'repair' || s === 'errand';

// ── Encart « gain cleaner » calculé en direct ─────────────────────────────────
function GainPreview({ gain, cleaner, minutes, service }: { gain: number; cleaner: any; minutes: string; service?: MissionService }) {
  const rate = cleaner?.hourly_rate ?? 0;
  const deliveryRate = cleaner?.delivery_rate ?? 0;
  const parts = serviceParts(service);
  const formula = parts.cleaning && parts.delivery
    ? `${money(rate)}/h × ${minutes || 0} min ÷ 60 + ${money(deliveryRate)} livraison`
    : parts.delivery
      ? `${money(deliveryRate)} par livraison (montant fixe)`
      : `${money(rate)}/h × ${minutes || 0} min ÷ 60`;
  return (
    <div className="md:col-span-2 rounded-xl px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#C9A84C12', border: '1px solid #C9A84C40' }}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Gain cleaner (auto)</p>
        <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>
          {cleaner ? formula : 'Sélectionnez un cleaner pour calculer le gain'}
        </p>
      </div>
      <span className="text-xl font-bold" style={{ color: '#C9A84C' }}>{money(gain)}</span>
    </div>
  );
}

type Props = Pick<ProprietesCreation, 'cleaners' | 'hotels' | 'airbnbs' | 'userId' | 'onReload' | 'onGoToMissions'>;

export default function CreationMission({ cleaners, hotels, airbnbs, userId, onReload, onGoToMissions }: Props) {
  const { toast } = useFeedback();
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [form, setForm] = useState(emptyForm);

  function selectHotel(hotelId: string) {
    const h = hotels.find(x => x.id === hotelId);
    setForm(p => ({ ...p, hotelId, property: h?.hotel_name ?? '', address: h?.address ?? '' }));
  }

  // ── Maison louée à la chambre ────────────────────────────────────────────────
  // Le ménage porte toujours sur la MAISON (un bien = un déplacement) : si l'admin
  // choisit une chambre, on bascule sur son annonce maison et on pré-coche cette
  // chambre. Sinon on créerait une mission sur une chambre isolée, incohérente
  // avec ce que produit la synchro.
  const houseOf = (id: string) => {
    const a = airbnbs.find(x => x.id === id);
    return a?.parentAirbnbId ? airbnbs.find(x => x.id === a.parentAirbnbId) : a;
  };
  const roomsOf = (houseId?: string) => houseId ? airbnbs.filter(a => a.parentAirbnbId === houseId) : [];

  const selectedHouse = airbnbs.find(a => a.id === form.airbnbId);
  const houseRooms = roomsOf(form.airbnbId);

  // Forfait correspondant au nombre de chambres cochées (toutes = maison entière).
  function tierFor(house: typeof selectedHouse, count: number, total: number) {
    if (!house?.groupTiers || total === 0) return null;
    return house.groupTiers[String(Math.min(Math.max(count, 1), total))] ?? null;
  }

  function applyUnits(units: string[]) {
    const total = houseRooms.length;
    const t = tierFor(selectedHouse, units.length, total);
    setForm(p => ({
      ...p,
      selectedUnits: units,
      ...(t?.price != null ? { price: String(t.price) } : {}),
      ...(t?.minutes != null ? { durationMinutes: String(t.minutes) } : {}),
    }));
  }

  function selectAirbnb(airbnbId: string) {
    const house = houseOf(airbnbId);
    const chosen = airbnbs.find(x => x.id === airbnbId);
    const a = house ?? chosen;
    const matchedCleaner = a?.cleanerId
      ? cleaners.find(c => c.id === a.cleanerId || c.user_id === a.cleanerId)
      : null;
    // Chambre choisie → maison + cette chambre pré-cochée.
    const preset = chosen?.parentAirbnbId && chosen.name ? [chosen.name] : [];
    const rooms = roomsOf(a?.id);
    const t = rooms.length ? tierFor(a, preset.length || rooms.length, rooms.length) : null;
    setForm(p => ({
      ...p,
      airbnbId: a?.id ?? '',
      property: a?.name ?? '',
      address: a?.address ?? '',
      cleanerId: matchedCleaner?.id ?? '',
      selectedUnits: preset,
      // Intervention : ni le prix ni la durée du ménage du logement.
      price: horsMenage(p.service) ? p.price
        : t?.price != null ? String(t.price) : (a?.clientPrice != null ? String(a.clientPrice) : p.price),
      durationMinutes: horsMenage(p.service) ? p.durationMinutes
        : t?.minutes != null ? String(t.minutes)
        : (a?.estimatedCleaningMinutes != null ? String(a.estimatedCleaningMinutes) : p.durationMinutes),
    }));
  }

  // Gain cleaner calculé en direct, selon la prestation (ménage = horaire ; livraison = fixe).
  const formCleaner = cleaners.find(c => c.id === form.cleanerId);
  const formGain = computeMissionGain({
    service: form.service,
    hourlyRate: formCleaner?.hourly_rate ?? 0,
    deliveryRate: formCleaner?.delivery_rate ?? 0,
    durationMinutes: Number(form.durationMinutes) || 0,
    bonus: form.service === 'errand' ? Number(form.errandBonus) || 0 : 0,
  });

  // Course : réglages par défaut (frais de service, prime), lus au moment où
  // l'on choisit « Course / achat ».
  const [errandCfg, setErrandCfg] = useState<{ pct: number; min: number } | null>(null);
  async function choisirCourse() {
    const cfg = await getProfitConfigDB();
    const reglages = { pct: cfg.errandFeePercent ?? 15, min: cfg.errandFeeMin ?? 20 };
    setErrandCfg(reglages);
    setForm(p => (p.service !== 'errand' ? p : {
      ...p,
      errandBonus: p.errandBonus || String(cfg.errandBonus ?? 0),
      price: p.feeAuto ? String(fraisServiceCourse(Number(p.errandBudget) || 0, reglages.pct, reglages.min)) : p.price,
    }));
  }
  function changerBudget(v: string) {
    setForm(p => ({
      ...p, errandBudget: v,
      price: p.feeAuto && errandCfg ? String(fraisServiceCourse(Number(v) || 0, errandCfg.pct, errandCfg.min)) : p.price,
    }));
  }

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

    const isRepair = form.service === 'repair';
    const isErrand = form.service === 'errand';
    if (isRepair && !form.repairDetails.trim()) {
      setCreateError('Décrivez le travail à faire.');
      setCreating(false);
      return;
    }
    if (isErrand && !form.errandDetails.trim()) {
      setCreateError('Décrivez la course : quoi acheter ou faire.');
      setCreating(false);
      return;
    }
    const hors = isRepair || isErrand;
    const type: MissionType = form.source === 'airbnb' || hors ? 'regular' : 'checkout';

    // Mission Airbnb : on la lie à l'appartement (source de vérité pour
    // l'adresse et les codes d'accès) et au partenaire propriétaire s'il existe.
    const apt = form.source === 'airbnb' ? airbnbs.find(a => a.id === form.airbnbId) : undefined;

    // Maison à annonces multiples : aucune chambre cochée = maison entière.
    const rooms = roomsOf(apt?.id);
    const units = form.selectedUnits.filter(u => rooms.some(r => r.name === u));
    const isWhole = rooms.length > 0 && (units.length === 0 || units.length >= rooms.length);
    // Une intervention vise le logement, pas un périmètre de ménage par chambre.
    const parChambre = rooms.length > 0 && !hors;

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
      nextArrival: hors ? undefined : (form.nextArrival || undefined),
      nextArrivalTime: hors ? undefined : (form.nextArrivalTime || undefined),
      createdBy: userId,
      createdByRole: 'admin' as const,
      // Périmètre, formulé comme la synchro : une mission saisie à la main doit
      // être indiscernable d'une mission automatique pour le cleaner.
      ...(parChambre ? {
        coveredUnits: isWhole ? 'Maison entière' : units.join(' + ') + ' + communs',
        wholeProperty: isWhole,
        coveredUnitNames: isWhole ? rooms.map(r => r.name) : units,
      } : {}),
    };

    setCreateError('');
    // Une mission = ménage OU livraison, un seul assigné.
    const c = cleaners.find(x => x.id === form.cleanerId);
    const coords = await resolveCoords(airbnbs, form.airbnbId, form.address);
    const result = await createMissionDB({
      ...common, type, service: form.service,
      deliveryInstructions: form.service === 'delivery' ? form.deliveryInstructions : undefined,
      ...(isRepair ? { repairSpecialite: form.repairSpecialite || undefined, repairDetails: form.repairDetails.trim() } : {}),
      ...(isErrand ? {
        errandDetails: form.errandDetails.trim(),
        errandBudget: Number(form.errandBudget) > 0 ? Number(form.errandBudget) : undefined,
        errandBonus: Math.max(0, Number(form.errandBonus) || 0),
      } : {}),
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
    toast('Mission créée.', 'success');
    await onReload();
    onGoToMissions();
    setCreating(false);
  }

  return (
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

      {/* Prestation : ménage (défaut), livraison ou intervention (artisan). */}
      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Prestation</label>
        <div className="flex gap-2 flex-wrap">
          {(['cleaning', 'delivery', 'repair', 'errand'] as MissionService[]).map(s => (
            <button key={s} type="button"
              onClick={() => { if (s === 'errand') void choisirCourse(); setForm(p => (p.service === s ? p : {
                ...p, service: s, cleanerId: '',
                // Le prix du ménage ne vaut pas pour une intervention (et inversement).
                ...(horsMenage(s) || horsMenage(p.service) ? { price: '', feeAuto: true } : {}),
              })); }}
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

        {/* Intervention : quel métier, quel travail. Se confie ensuite à un artisan
            depuis la mission (« Confier à un prestataire »). */}
        {form.service === 'repair' && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Type d&apos;intervention</label>
              <select value={form.repairSpecialite} onChange={e => setForm(p => ({ ...p, repairSpecialite: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
                style={{ ...inputStyle, color: form.repairSpecialite ? '#1A1A1A' : '#A8A09A' }}>
                <option value="">Choisir (facultatif)</option>
                {specialitesDuMetier('artisan').map(sp => <option key={sp.key} value={sp.key}>{sp.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Travail à faire</label>
              <textarea required value={form.repairDetails} onChange={e => setForm(p => ({ ...p, repairDetails: e.target.value }))}
                rows={3} placeholder="Ex : changer le cylindre de la porte d'entrée (2 clés), reboucher 3 trous dans le salon."
                className="w-full px-4 py-3 rounded-xl text-sm border resize-none" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>
            <p className="text-xs" style={{ color: '#A8A09A' }}>
              Une fois créée, confiez-la à un artisan depuis la mission (« Confier à un prestataire ») : ceux de la bonne spécialité sont proposés en premier.
            </p>
          </div>
        )}

        {/* Course / achat : on avance l'argent, le client rembourse les achats au
            réel et paie les frais de service (déplacement compris). */}
        {form.service === 'errand' && (
          <div className="mt-3 space-y-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Course à faire</label>
              <textarea required value={form.errandDetails} onChange={e => setForm(p => ({ ...p, errandDetails: e.target.value }))}
                rows={3} placeholder="Ex : acheter une machine à café Nespresso et l'installer ; faire doubler la clé d'entrée (2 exemplaires)."
                className="w-full px-4 py-3 rounded-xl text-sm border resize-none" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Budget max accepté (€)</label>
                <input type="number" min="0" step="0.5" inputMode="decimal" value={form.errandBudget} onChange={e => changerBudget(e.target.value)}
                  placeholder="Ex : 250" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Frais de service (€)</label>
                <input type="number" min="0" step="0.5" inputMode="decimal" value={form.price}
                  onChange={e => setForm(p => ({ ...p, price: e.target.value, feeAuto: false }))}
                  placeholder="0" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Prime intervenant (€)</label>
                <input type="number" min="0" step="0.5" inputMode="decimal" value={form.errandBonus}
                  onChange={e => setForm(p => ({ ...p, errandBonus: e.target.value }))}
                  placeholder="0" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
            </div>
            <p className="text-xs" style={{ color: '#A8A09A' }}>
              {errandCfg
                ? `Frais de service proposés : ${errandCfg.pct} % du budget, ${money(errandCfg.min)} minimum, déplacement compris — modifiables. `
                : ''}
              Les achats sont refacturés au réel sur leur propre ligne, sur la photo du ticket. Ne rien acheter au-delà du budget sans l&apos;accord du client.
            </p>
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
          {estAuTemps(form.service) && (
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>{horsMenage(form.service) ? 'Durée estimée (minutes)' : 'Temps de nettoyage (minutes)'}</label>
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
          {/* Livraison : jamais facturée au client → pas de prix client. Course :
              ses frais de service sont saisis plus haut. */}
          {form.service !== 'delivery' && form.service !== 'errand' && (
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
              {airbnbs.map(a => (
                <option key={a.id} value={a.id}>
                  {a.parentAirbnbId ? `↳ ${a.name} (chambre)` : a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Maison louée à la chambre : QUE faut-il faire ce jour-là ? Le prix
              et la durée suivent le forfait du nombre de chambres cochées —
              les communs sont refaits à chaque passage, donc rien ne s'additionne. */}
          {houseRooms.length > 0 && !horsMenage(form.service) && (
            <div className="rounded-xl border p-4" style={{ borderColor: '#EBD9A8', backgroundColor: '#FBF4E2' }}>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#9A7B22' }}>
                Chambres à faire
              </label>
              <div className="flex flex-wrap gap-2">
                {houseRooms.map(r => {
                  const on = form.selectedUnits.includes(r.name);
                  return (
                    <button key={r.id} type="button"
                      onClick={() => applyUnits(on ? form.selectedUnits.filter(u => u !== r.name) : [...form.selectedUnits, r.name])}
                      className="px-3 py-2 rounded-lg text-xs font-medium border transition-colors"
                      style={{
                        borderColor: on ? '#C9A84C' : '#E8E4DC',
                        backgroundColor: on ? '#C9A84C18' : '#FFFFFF',
                        color: on ? '#9A7B22' : '#7A7068',
                      }}>
                      {r.name}
                    </button>
                  );
                })}
                <button type="button" onClick={() => applyUnits(houseRooms.map(r => r.name))}
                  className="px-3 py-2 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: '#C9A84C', color: '#9A7B22', backgroundColor: '#FFFFFF' }}>
                  Maison entière
                </button>
              </div>
              <p className="text-xs mt-2" style={{ color: '#7A7068' }}>
                {form.selectedUnits.length === 0
                  ? 'Aucune chambre cochée : la mission portera sur la maison entière.'
                  : form.selectedUnits.length >= houseRooms.length
                    ? 'Toutes les chambres : maison entière, au tarif maison.'
                    : `${form.selectedUnits.length} chambre${form.selectedUnits.length > 1 ? 's' : ''} + communs. Prix et durée ajustés au forfait.`}
              </p>
            </div>
          )}
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
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>{form.service === 'repair' ? 'Date de l’intervention' : form.service === 'errand' ? 'Date de la course' : 'Date de nettoyage'}</label>
            <input required type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>{horsMenage(form.service) ? 'Heure' : 'Heure départ clients'}</label>
            {horsMenage(form.service) ? (
              <input required type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            ) : (
            <select required value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
              style={{ ...inputStyle, color: form.time ? '#1A1A1A' : '#A8A09A' }}>
              <option value="">Choisir</option>
              {DEPARTURE_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
            </select>
            )}
          </div>
          {!horsMenage(form.service) && (
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Prochaine arrivée d&apos;un voyageur</label>
            <ArriveeSuivante dateMenage={form.date}
              value={{ date: form.nextArrival, time: form.nextArrivalTime }}
              onChange={v => setForm(p => ({ ...p, nextArrival: v.date, nextArrivalTime: v.time }))}
              champClass="w-full px-4 py-3 rounded-xl text-sm border appearance-none" champStyle={inputStyle} />
          </div>
          )}
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>{horsMenage(form.service) ? 'Durée estimée (minutes)' : 'Temps de nettoyage (minutes)'}</label>
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
            {!horsMenage(form.service) && <p className="text-xs mt-1.5" style={{ color: '#A8A09A' }}>Pré-rempli depuis l'appartement — modifiable si plus sale que prévu.</p>}
          </div>
          {/* Intervention : prix fixé à la main (devis), jamais celui du ménage. */}
          {form.service === 'repair' ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Prix client (€) — facturation</label>
              <input type="number" min="0" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                placeholder="0" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>
          ) : form.service === 'errand' ? null : form.price && (
            <div className="md:col-span-2 px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>
              Prix client (facturation) repris de l'appartement : <span style={{ color: '#5A8A6A', fontWeight: 600 }}>{money(form.price)}</span>
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
  );
}
