'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getMissionsDB, getHotelRequestsDB, getActiveCleanersDB,
  createMissionDB, validateRequestDB, refuseRequestDB,
  getApprovedHotelsDB, getAirbnbs,
  assignCleanerToMissionsDB,
  updateMissionsOrderDB, getAssignableStaffDB,
} from '@/lib/db';
import { listRecurringDB } from '@/lib/recurring';
import type { RecurringMission } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedback } from '@/contexts/FeedbackContext';
import { supabase } from '@/lib/supabase';
import type { Mission, HotelAnnounce, Apartment } from '@/lib/types';
import { canCleanerDoService } from '@/lib/service';
import Icon from '@/components/Icon';
import { groupMissionsByCleaner } from '@/lib/missionOrder';
import { inputStyle } from '@/lib/ui';
import DateRangeFilter from '@/components/DateRangeFilter';
import { presetRange, inRange, type DateRange } from '@/lib/dateRange';
import { MISSION_TYPE_LABEL } from '@/lib/labels';
import Loading from "@/components/Loading";
import AdminMissionCard from './AdminMissionCard';
import MissionCreatePanel from './MissionCreatePanel';

// Libellés statuts/types des missions : centralisés (lib/labels.ts).
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

const TABS = ['Demandes hôtel', 'Missions', 'Créer'] as const;

// ── Page principale ───────────────────────────────────────────────────────────

export default function MissionsPage() {
  const { user } = useAuth();
  const { toast } = useFeedback();
  // Onglet par défaut « malin » : on ouvre sur les Missions (vue opérationnelle du
  // quotidien) et on ne bascule sur les Demandes hôtel au 1er chargement QUE s'il y
  // en a en attente. Le badge de comptage sur l'onglet évite d'en manquer.
  const [tab, setTab] = useState<typeof TABS[number]>('Missions');
  const didAutoTab = useRef(false);
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
  // Données passées au panneau de création (chargées par load()).
  const [staff, setStaff] = useState<{ id: string; name: string; role: string }[]>([]);
  const [recurrings, setRecurrings] = useState<RecurringMission[]>([]);

  const load = useCallback(async () => {
    const [m, r, c, h, a, s, rec] = await Promise.all([
      getMissionsDB(), getHotelRequestsDB(), getActiveCleanersDB(),
      getApprovedHotelsDB(), getAirbnbs(), getAssignableStaffDB(), listRecurringDB(),
    ]);
    setMissions(m); setRequests(r); setCleaners(c); setStaff(s); setRecurrings(rec);
    // Appartements triés par ordre alphabétique (listes de sélection).
    setHotels(h); setAirbnbs([...a].sort((x, y) => x.name.localeCompare(y.name, 'fr', { sensitivity: 'base', numeric: true })));
    // Choix de l'onglet initial : une seule fois, avant le 1er affichage (couvert par
    // l'écran de chargement → pas de flash). Ne réécrit jamais un choix manuel.
    if (!didAutoTab.current) {
      didAutoTab.current = true;
      if (r.some(x => x.status === 'pending')) setTab('Demandes hôtel');
    }
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
    toast(`Demande acceptée${c?.name ? ` — assignée à ${c.name}` : ''}.`, 'success');
  }

  async function handleRefuse(id: string) {
    await refuseRequestDB(id); await load();
    toast('Demande refusée.', 'info');
  }

  const pendingReqs = requests.filter(r => r.status === 'pending').length;


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
    const count = selectedIds.size;
    setBulkBusy(true);
    await assignCleanerToMissionsDB(Array.from(selectedIds), bulkCleaner, c.name ?? '');
    setBulkBusy(false);
    clearSelection();
    setBulkCleaner('');
    await load();
    toast(`${count} mission${count > 1 ? 's' : ''} assignée${count > 1 ? 's' : ''} à ${c.name}.`, 'success');
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
    let created = 0, skipped = 0;
    for (const m of selectedForDelivery) {
      const exists = missions.some(x => (x.service === 'delivery') && x.date === m.date
        && (m.airbnbId ? x.airbnbId === m.airbnbId : x.property === m.property));
      if (exists) { skipped++; continue; }
      created++;
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
    toast(
      created > 0
        ? `${created} livraison${created > 1 ? 's' : ''} créée${created > 1 ? 's' : ''}${skipped > 0 ? ` · ${skipped} déjà existante${skipped > 1 ? 's' : ''}` : ''}.`
        : 'Livraisons déjà existantes pour cette sélection.',
      created > 0 ? 'success' : 'info',
    );
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
        <MissionCreatePanel
          cleaners={cleaners}
          hotels={hotels}
          airbnbs={airbnbs}
          staff={staff}
          recurrings={recurrings}
          userId={user?.id}
          onReload={load}
          onGoToMissions={() => { setFilter('all'); setTab('Missions'); }}
        />
      )}
    </div>
  );
}
