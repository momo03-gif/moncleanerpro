'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { OpenIncident } from '@/lib/missionReports';
import type { Mission } from '@/lib/types';
import { formatHour } from '@/lib/format';
import { missionStatusCfg } from '@/lib/labels';
import { serviceLabel, SERVICE_BADGE } from '@/lib/service';
import { collapseGroups } from '@/lib/missionOrder';
import Loading from '@/components/Loading';
import { getSessionCache, setSessionCache } from '@/lib/sessionCache';

// Perf : la couche données (supabase) est importée en différé → elle ne pèse
// pas sur le chargement initial du tableau de bord.
const loadDb = () => import('@/lib/db');
const loadReports = () => import('@/lib/missionReports');

// Cache mémoire de session pour un affichage instantané en revenant sur le
// tableau de bord (rafraîchi en arrière-plan).
type DashCache = { missions: Mission[]; cleaners: any[]; pending: any[]; incidents: OpenIncident[]; failingFeeds: number };
const DASH_CACHE_KEY = 'admin-dashboard';

const DONE = (s: string) => s === 'completed' || s === 'cancelled';

// Tuile opérationnelle cliquable. tone : 'gold' | 'alert' (rouge) | 'warn' (orange) | 'plain'.
function Tile({ label, value, sub, href, tone = 'plain' }: {
  label: string; value: string | number; sub?: string; href?: string; tone?: 'gold' | 'alert' | 'warn' | 'plain';
}) {
  const palette = {
    gold:  { bg: '#C9A84C', border: '#C9A84C', label: '#7A6030', value: '#1A1A1A', sub: '#7A6030' },
    alert: { bg: '#FFFFFF', border: '#EAC4BE', label: '#B85A50', value: '#B85A50', sub: '#C98A82' },
    warn:  { bg: '#FFFFFF', border: '#EBD9A8', label: '#A87B1E', value: '#A87B1E', sub: '#C0A560' },
    plain: { bg: '#FFFFFF', border: '#E8E4DC', label: '#A8A09A', value: '#1A1A1A', sub: '#A8A09A' },
  }[tone];
  const inner = (
    <div className="rounded-2xl p-4 md:p-5 border h-full transition-shadow hover:shadow-sm" style={{ backgroundColor: palette.bg, borderColor: palette.border }}>
      <p className="text-xs font-medium mb-2" style={{ color: palette.label }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color: palette.value }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: palette.sub }}>{sub}</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{inner}</Link> : inner;
}

export default function AdminDashboard() {
  // Affichage instantané depuis le cache de session si on revient sur la page.
  const cached = getSessionCache<DashCache>(DASH_CACHE_KEY);
  const [missions, setMissions] = useState<Mission[]>(cached?.missions ?? []);
  const [cleaners, setCleaners] = useState<any[]>(cached?.cleaners ?? []);
  const [pending, setPending] = useState<any[]>(cached?.pending ?? []);
  const [incidents, setIncidents] = useState<OpenIncident[]>(cached?.incidents ?? []);
  const [failingFeeds, setFailingFeeds] = useState<number>(cached?.failingFeeds ?? 0);
  const [loading, setLoading] = useState(cached === undefined);

  const today = new Date().toISOString().split('T')[0];
  const tomorrowD = new Date(); tomorrowD.setDate(tomorrowD.getDate() + 1);
  const tomorrow = tomorrowD.toISOString().split('T')[0];

  async function loadPending() {
    const { getPendingHotelsDB, getPendingAirbnbPartnersDB } = await loadDb();
    const [hotels, partners] = await Promise.all([getPendingHotelsDB(), getPendingAirbnbPartnersDB()]);
    const list = [
      ...hotels.map((h: any) => ({ ...h, kind: 'hotel' as const })),
      ...partners.map((p: any) => ({ ...p, kind: 'airbnb' as const })),
    ];
    setPending(list);
    return list;
  }

  useEffect(() => {
    async function load() {
      const [db, reports] = await Promise.all([loadDb(), loadReports()]);
      // Perf : le tableau de bord n'affiche que le jour même, le lendemain, les
      // retards récents et les rendez-vous à venir → on borne à ~90 jours
      // d'historique (le futur reste inclus). Évite de charger tout l'historique.
      const since = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0];
      const [m, c, inc, feeds] = await Promise.all([
        db.getMissionsDB(since), db.getCleaners(), reports.getOpenIncidentsDB(), db.getAllReservationFeeds(),
      ]);
      const failing = feeds.filter(f => f.lastSyncStatus === 'error').length;
      setMissions(m); setCleaners(c); setIncidents(inc);
      setFailingFeeds(failing);
      const pendingList = await loadPending();
      setSessionCache<DashCache>(DASH_CACHE_KEY, { missions: m, cleaners: c, pending: pendingList, incidents: inc, failingFeeds: failing });
      setLoading(false);
    }
    load();
  }, []);

  async function handleApprove(h: any) {
    const { approveAirbnbPartnerDB, approveHotelDB } = await loadDb();
    if (h.kind === 'airbnb') await approveAirbnbPartnerDB(h.id); else await approveHotelDB(h.id);
    await loadPending();
  }
  async function handleRefuse(h: any) {
    const { refuseAirbnbPartnerDB, refuseHotelDB } = await loadDb();
    if (h.kind === 'airbnb') await refuseAirbnbPartnerDB(h.id); else await refuseHotelDB(h.id);
    await loadPending();
  }

  // ── Calculs opérationnels ──────────────────────────────────────────────────
  const todayMissions = missions.filter(m => m.date === today)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const todayDone = todayMissions.filter(m => m.status === 'completed').length;
  const tomorrowCount = missions.filter(m => m.date === tomorrow && !DONE(m.status)).length;
  const overdue = missions.filter(m => m.date < today && !DONE(m.status));
  // « À assigner » : missions de terrain sans cleaner. Un rendez-vous confié à un admin
  // (assigneeUserId, sans cleanerId) n'est PAS « à assigner ».
  const unassigned = missions.filter(m => !m.cleanerId && !m.assigneeUserId && !DONE(m.status));
  const available = cleaners.filter(c => !['busy', 'offline', 'inactive'].includes(c.status));

  // Rendez-vous à venir (aujourd'hui et après), pour les rendre visibles quelle que
  // soit leur date — pas seulement dans le planning du jour.
  const upcomingAppointments = missions
    .filter(m => m.service === 'appointment' && m.date >= today && !DONE(m.status))
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')))
    .slice(0, 6);

  if (loading) return <Loading className="p-6 text-sm" />;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Tableau de bord</h1>
        <p className="text-sm mt-1 capitalize" style={{ color: '#A8A09A' }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── Alerte : synchronisation en panne ── */}
      {failingFeeds > 0 && (
        <Link href="/admin/reservations" className="block mb-6">
          <div className="rounded-2xl border px-5 py-3.5 flex items-center gap-3" style={{ borderColor: '#EAC4BE', backgroundColor: '#FBECEA' }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#B85A50' }} />
            <p className="text-sm font-semibold" style={{ color: '#B85A50' }}>
              {failingFeeds} calendrier{failingFeeds > 1 ? 's' : ''} ne se synchronise{failingFeeds > 1 ? 'nt' : ''} plus — des ménages risquent de ne plus se créer automatiquement.
            </p>
            <span className="ml-auto text-xs shrink-0" style={{ color: '#B85A50' }}>Voir →</span>
          </div>
        </Link>
      )}

      {/* ── Cockpit : 6 tuiles opérationnelles ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-8">
        <Tile label="Aujourd'hui" value={todayMissions.length} sub={`${todayDone} terminées`} href="/admin/missions" tone="gold" />
        <Tile label="Demain" value={tomorrowCount} sub="à venir" href="/admin/missions" />
        <Tile label="En retard" value={overdue.length} sub={overdue.length ? 'à régler' : 'rien à signaler'} href="/admin/missions" tone={overdue.length ? 'alert' : 'plain'} />
        <Tile label="À assigner" value={unassigned.length} sub={unassigned.length ? 'sans cleaner' : 'tout est assigné'} href="/admin/missions" tone={unassigned.length ? 'warn' : 'plain'} />
        <Tile label="Incidents" value={incidents.length} sub={incidents.length ? 'à traiter' : 'aucun'} tone={incidents.length ? 'alert' : 'plain'} />
        <Tile label="Cleaners dispos" value={available.length} sub={`sur ${cleaners.length}`} href="/admin/cleaners" />
      </div>

      {/* ── Comptes en attente ── */}
      {pending.length > 0 && (
        <div className="rounded-2xl border overflow-hidden mb-8" style={{ borderColor: '#C48A2A40', backgroundColor: '#FFFFFF' }}>
          <div className="px-5 py-3.5 flex items-center gap-3 border-b" style={{ borderColor: '#F2EFE9', backgroundColor: '#C48A2A08' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#C48A2A' }} />
            <h2 className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Comptes en attente</h2>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#C48A2A18', color: '#C48A2A' }}>{pending.length}</span>
          </div>
          {pending.map((h, i) => (
            <div key={h.id} className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 ${i < pending.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{h.name}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: h.kind === 'airbnb' ? '#C9A84C15' : '#F5F3EF', color: h.kind === 'airbnb' ? '#C9A84C' : '#7A7068' }}>
                    {h.kind === 'airbnb' ? 'Airbnb' : 'Hôtel'}
                  </span>
                </div>
                {h.address && <p className="text-xs" style={{ color: '#A8A09A' }}>{h.address}</p>}
                <p className="text-xs" style={{ color: '#A8A09A' }}>{h.email}{h.phone ? ` · ${h.phone}` : ''}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleApprove(h)} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Valider</button>
                <button onClick={() => handleRefuse(h)} className="px-4 py-2 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>Refuser</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Incidents signalés (rapports avec un dégât/problème) ── */}
      {incidents.length > 0 && (
        <div className="rounded-2xl border overflow-hidden mb-8" style={{ borderColor: '#EAC4BE', backgroundColor: '#FFFFFF' }}>
          <div className="px-5 py-3.5 flex items-center gap-3 border-b" style={{ borderColor: '#F2EFE9', backgroundColor: '#B85A5008' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#B85A50' }} />
            <h2 className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Incidents signalés</h2>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#B85A5015', color: '#B85A50' }}>{incidents.length}</span>
          </div>
          {incidents.slice(0, 6).map((inc, i) => (
            <div key={inc.missionId} className={`px-5 py-3.5 ${i < Math.min(incidents.length, 6) - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{inc.property || 'Logement'}</p>
                {inc.date && <span className="text-xs shrink-0" style={{ color: '#A8A09A' }}>{inc.date}</span>}
              </div>
              <p className="text-sm mt-0.5" style={{ color: '#B85A50' }}>{inc.issues}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Rendez-vous à venir ── */}
      {upcomingAppointments.length > 0 && (
        <div className="rounded-2xl border overflow-hidden mb-8" style={{ borderColor: '#7C5CBF33', backgroundColor: '#FFFFFF' }}>
          <div className="px-4 sm:px-5 py-3.5 flex items-center gap-3 border-b" style={{ borderColor: '#F2EFE9', backgroundColor: '#7C5CBF08' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#7C5CBF' }} />
            <h2 className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Rendez-vous à venir</h2>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#7C5CBF15', color: '#7C5CBF' }}>{upcomingAppointments.length}</span>
          </div>
          {upcomingAppointments.map((m, i) => (
            <div key={m.id} className={`px-4 sm:px-5 py-3.5 flex items-center gap-3 sm:gap-4 ${i < upcomingAppointments.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
              <div className="shrink-0 text-center" style={{ width: 52 }}>
                <p className="text-xs font-semibold capitalize" style={{ color: '#7C5CBF' }}>
                  {new Date(m.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                </p>
                <p className="text-[11px]" style={{ color: '#A8A09A' }}>{formatHour(m.time) || '—'}</p>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{m.property || 'Rendez-vous'}</p>
                <p className="text-xs truncate" style={{ color: (m.cleanerName || m.assigneeName) ? '#A8A09A' : '#B85A50' }}>
                  {m.cleanerName || m.assigneeName || 'Non assigné'}
                </p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded font-semibold shrink-0" style={{ backgroundColor: '#7C5CBF15', color: '#7C5CBF' }}>Rendez-vous</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Planning du jour + cleaners ── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: '#1A1A1A' }}>Aujourd'hui ({todayMissions.length})</h2>
            <Link href="/admin/missions" className="text-sm" style={{ color: '#C9A84C' }}>Voir tout →</Link>
          </div>
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
            {todayMissions.length === 0 && <div className="p-8 text-center text-sm" style={{ color: '#A8A09A' }}>Rien de prévu aujourd'hui</div>}
            {(() => {
              // Interventions ponctuelles multi-cleaners regroupées en une seule ligne.
              const entries = collapseGroups(todayMissions);
              return entries.map((e, i) => {
                const m = e.mission;
                const cfg = missionStatusCfg(m.status);
                const isAppointment = m.service === 'appointment';
                const badge = SERVICE_BADGE[m.service ?? 'cleaning'];
                // Assigné(s) : intervention groupée → liste ; RDV → cleaner ou admin.
                const who = e.groupSize > 1
                  ? `${e.groupSize} intervenants${e.assignees.length ? ` · ${e.assignees.join(', ')}` : ''}`
                  : (m.cleanerName || m.assigneeName || (isAppointment ? 'Non assigné' : 'Non assignée'));
                return (
                  <div key={m.groupId || m.id} className={`px-5 py-3.5 flex items-center gap-4 ${i < entries.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
                    <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: '#7A7068', width: 44 }}>{formatHour(m.time) || '—'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{m.property}</p>
                        {(isAppointment || m.service === 'delivery') && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0" style={{ backgroundColor: badge.bg, color: badge.color }}>{serviceLabel(m.service)}</span>
                        )}
                        {e.groupSize > 1 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0" style={{ backgroundColor: '#5A8A6A15', color: '#5A8A6A' }}>Ponctuelle</span>
                        )}
                      </div>
                      <p className="text-xs truncate" style={{ color: (m.cleanerName || m.assigneeName || e.groupSize > 1) ? '#A8A09A' : '#B85A50' }}>{who}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full font-medium shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: '#1A1A1A' }}>Cleaners</h2>
            <Link href="/admin/cleaners" className="text-sm" style={{ color: '#C9A84C' }}>Voir tout →</Link>
          </div>
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
            {cleaners.map((c, i) => {
              const load = todayMissions.filter(m => m.cleanerId === c.id).length;
              const dispo = !['busy', 'offline', 'inactive'].includes(c.status);
              return (
                <div key={c.id} className={`px-5 py-4 flex items-center gap-3 ${i < cleaners.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>{c.name.charAt(0)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{c.name}</p>
                    <p className="text-xs" style={{ color: '#A8A09A' }}>{load > 0 ? `${load} mission${load > 1 ? 's' : ''} aujourd'hui` : 'libre aujourd\'hui'}</p>
                  </div>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dispo ? '#5A8A6A' : '#A8A09A' }} title={dispo ? 'Disponible' : 'Indisponible'} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
