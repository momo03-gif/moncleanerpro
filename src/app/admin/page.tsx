'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  getMissionsDB, getCleaners, getAllReservationFeeds,
  getPendingHotelsDB, approveHotelDB, refuseHotelDB,
  getPendingAirbnbPartnersDB, approveAirbnbPartnerDB, refuseAirbnbPartnerDB,
} from '@/lib/db';
import { getOpenIncidentsDB, type OpenIncident } from '@/lib/missionReports';
import type { Mission } from '@/lib/types';
import { formatHour } from '@/lib/format';
import { missionStatusCfg } from '@/lib/labels';
import Loading from '@/components/Loading';

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
  const [missions, setMissions] = useState<Mission[]>([]);
  const [cleaners, setCleaners] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<OpenIncident[]>([]);
  const [failingFeeds, setFailingFeeds] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const tomorrowD = new Date(); tomorrowD.setDate(tomorrowD.getDate() + 1);
  const tomorrow = tomorrowD.toISOString().split('T')[0];

  async function loadPending() {
    const [hotels, partners] = await Promise.all([getPendingHotelsDB(), getPendingAirbnbPartnersDB()]);
    setPending([
      ...hotels.map((h: any) => ({ ...h, kind: 'hotel' as const })),
      ...partners.map((p: any) => ({ ...p, kind: 'airbnb' as const })),
    ]);
  }

  useEffect(() => {
    async function load() {
      const [m, c, inc, feeds] = await Promise.all([
        getMissionsDB(), getCleaners(), getOpenIncidentsDB(), getAllReservationFeeds(),
      ]);
      setMissions(m); setCleaners(c); setIncidents(inc);
      setFailingFeeds(feeds.filter(f => f.lastSyncStatus === 'error').length);
      await loadPending();
      setLoading(false);
    }
    load();
  }, []);

  async function handleApprove(h: any) {
    if (h.kind === 'airbnb') await approveAirbnbPartnerDB(h.id); else await approveHotelDB(h.id);
    await loadPending();
  }
  async function handleRefuse(h: any) {
    if (h.kind === 'airbnb') await refuseAirbnbPartnerDB(h.id); else await refuseHotelDB(h.id);
    await loadPending();
  }

  // ── Calculs opérationnels ──────────────────────────────────────────────────
  const todayMissions = missions.filter(m => m.date === today)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const todayDone = todayMissions.filter(m => m.status === 'completed').length;
  const tomorrowCount = missions.filter(m => m.date === tomorrow && !DONE(m.status)).length;
  const overdue = missions.filter(m => m.date < today && !DONE(m.status));
  const unassigned = missions.filter(m => !m.cleanerId && !DONE(m.status));
  const available = cleaners.filter(c => !['busy', 'offline', 'inactive'].includes(c.status));

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

      {/* ── Planning du jour + cleaners ── */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: '#1A1A1A' }}>Aujourd'hui ({todayMissions.length})</h2>
            <Link href="/admin/missions" className="text-sm" style={{ color: '#C9A84C' }}>Voir tout →</Link>
          </div>
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
            {todayMissions.length === 0 && <div className="p-8 text-center text-sm" style={{ color: '#A8A09A' }}>Aucun ménage aujourd'hui</div>}
            {todayMissions.map((m, i) => {
              const cfg = missionStatusCfg(m.status);
              return (
                <div key={m.id} className={`px-5 py-3.5 flex items-center gap-4 ${i < todayMissions.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
                  <span className="text-sm font-semibold tabular-nums shrink-0" style={{ color: '#7A7068', width: 44 }}>{formatHour(m.time) || '—'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{m.property}</p>
                    <p className="text-xs truncate" style={{ color: m.cleanerName ? '#A8A09A' : '#B85A50' }}>
                      {m.cleanerName || 'Non assignée'}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full font-medium shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                </div>
              );
            })}
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
