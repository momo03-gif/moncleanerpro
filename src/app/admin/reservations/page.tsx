'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAirbnbs, getAllReservations, getAllReservationFeeds } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { Apartment, Reservation, ReservationFeed } from '@/lib/types';
import Icon from '@/components/Icon';

const platformLabel = (p: string) => ({
  airbnb: 'Airbnb', booking: 'Booking.com', guesty: 'Guesty', hostaway: 'Hostaway',
  lodgify: 'Lodgify', smoobu: 'Smoobu', beds24: 'Beds24', amenitiz: 'Amenitiz',
  ical: 'iCal', other: 'PMS',
} as Record<string, string>)[p] ?? p;

const RES_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmée', color: '#5A8A6A', bg: '#5A8A6A15' },
  cancelled: { label: 'Annulée',   color: '#B85A50', bg: '#B85A5015' },
  tentative: { label: 'À confirmer', color: '#C48A2A', bg: '#C48A2A15' },
  blocked:   { label: 'Bloqué',    color: '#6B7280', bg: '#6B728018' },
};

function parisToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);
}

function KPI({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: '#7A7068' }}>{label}</p>
    </div>
  );
}

// État d'occupation d'un appartement, dérivé de ses réservations confirmées.
interface AptOccupancy {
  apt: Apartment;
  occupied: boolean;
  currentCheckOut?: string;       // départ du séjour en cours
  nextDeparture?: Reservation;    // 1er départ >= aujourd'hui
  nextArrival?: string;           // 1re arrivée >= aujourd'hui
}

export default function AdminReservationsPage() {
  const today = parisToday();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [feeds, setFeeds] = useState<ReservationFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const load = useCallback(async () => {
    const [a, r, f] = await Promise.all([getAirbnbs(), getAllReservations(), getAllReservationFeeds()]);
    setApartments(a); setReservations(r); setFeeds(f);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('admin-reservations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  async function syncAll() {
    setSyncing(true); setSyncMsg('');
    try {
      const res = await fetch('/api/reservations/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      setSyncMsg(data.ok ? `${data.imported} réservation(s) importée(s) · ${data.missionsCreated} mission(s) créée(s).` : `Erreur : ${data.error}`);
    } catch { setSyncMsg('Synchronisation impossible.'); }
    await load();
    setSyncing(false);
  }

  // Occupation par appartement (réservations confirmées uniquement).
  const occupancy = useMemo<AptOccupancy[]>(() => {
    const byApt = new Map<string, Reservation[]>();
    for (const r of reservations) {
      if (r.status !== 'confirmed') continue;
      const list = byApt.get(r.airbnbId) ?? [];
      list.push(r);
      byApt.set(r.airbnbId, list);
    }
    return apartments.map(apt => {
      const list = (byApt.get(apt.id) ?? []).sort((a, b) => a.checkOut.localeCompare(b.checkOut));
      const current = list.find(r => r.checkIn <= today && today < r.checkOut);
      const nextDeparture = list.find(r => r.checkOut >= today);
      const nextArrival = list.map(r => r.checkIn).filter(d => d >= today).sort()[0];
      return { apt, occupied: !!current, currentCheckOut: current?.checkOut, nextDeparture, nextArrival };
    });
  }, [apartments, reservations, today]);

  const kpis = useMemo(() => {
    let occupied = 0, leavingSoon = 0, needsCleaning = 0, missionCreated = 0;
    for (const o of occupancy) {
      if (o.occupied) occupied++;
      if (o.nextDeparture && daysBetween(today, o.nextDeparture.checkOut) <= 3) leavingSoon++;
      if (o.nextDeparture && !o.nextDeparture.missionId) needsCleaning++;
      if (o.nextDeparture && o.nextDeparture.missionId) missionCreated++;
    }
    return { occupied, leavingSoon, needsCleaning, missionCreated };
  }, [occupancy, today]);

  // Appartements pertinents en haut (un départ à venir ou occupés).
  const sortedOcc = useMemo(() =>
    [...occupancy].sort((a, b) => {
      const da = a.nextDeparture?.checkOut ?? '9999';
      const db = b.nextDeparture?.checkOut ?? '9999';
      return da.localeCompare(db);
    }), [occupancy]);

  if (loading) return <div className="p-6 text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Réservations &amp; occupation</h1>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>
            {feeds.length} calendrier(s) connecté(s) · synchro automatique 2×/jour
          </p>
        </div>
        <button onClick={syncAll} disabled={syncing}
          className="py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
          style={{ backgroundColor: '#1A1A1A', color: '#FFFFFF' }}>
          <Icon name="sync" size={16} /> {syncing ? 'Synchronisation...' : 'Synchroniser tout'}
        </button>
      </div>
      {syncMsg && <p className="text-xs mb-4 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>{syncMsg}</p>}

      {/* KPIs occupation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPI label="Occupés actuellement" value={kpis.occupied} color="#5B6EF5" />
        <KPI label="Bientôt libérés (≤ 3j)" value={kpis.leavingSoon} color="#C48A2A" />
        <KPI label="Ménage à prévoir" value={kpis.needsCleaning} color="#B85A50" />
        <KPI label="Mission créée" value={kpis.missionCreated} color="#5A8A6A" />
      </div>

      {/* Tableau d'occupation par appartement */}
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Par appartement</h2>
      {sortedOcc.filter(o => o.occupied || o.nextDeparture).length === 0 ? (
        <div className="rounded-2xl p-10 text-center border mb-8" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune réservation active. Connectez des calendriers côté partenaires.</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden mb-8" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          {sortedOcc.filter(o => o.occupied || o.nextDeparture).map(o => {
            const turnover = o.nextDeparture && o.nextArrival && o.nextArrival === o.nextDeparture.checkOut;
            return (
              <div key={o.apt.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b last:border-0" style={{ borderColor: '#F2EFE9' }}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{o.apt.name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs" style={{ color: '#7A7068' }}>
                    {o.occupied && <span style={{ color: '#5B6EF5' }}>Occupé jusqu&apos;au {fmtDate(o.currentCheckOut!)}</span>}
                    {o.nextDeparture && <span>Départ {fmtDate(o.nextDeparture.checkOut)}</span>}
                    {turnover && <span className="font-semibold" style={{ color: '#B91C1C' }}>Turnover jour même</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {o.nextDeparture ? (
                    o.nextDeparture.missionId ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: '#5A8A6A15', color: '#5A8A6A' }}>
                        <Icon name="check" size={12} /> Mission créée
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: '#B85A5015', color: '#B85A50' }}>
                        Ménage à prévoir
                      </span>
                    )
                  ) : (
                    <span className="text-[11px] px-2 py-1 rounded-full" style={{ backgroundColor: '#6B728018', color: '#6B7280' }}>Libre</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Réservations synchronisées (toutes plateformes) */}
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Réservations synchronisées</h2>
      {reservations.length === 0 ? (
        <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune réservation importée pour le moment.</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <div className="grid grid-cols-12 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider border-b" style={{ color: '#A8A09A', borderColor: '#F2EFE9' }}>
            <span className="col-span-4">Appartement</span>
            <span className="col-span-2">Plateforme</span>
            <span className="col-span-2 text-center">Arrivée</span>
            <span className="col-span-2 text-center">Départ</span>
            <span className="col-span-2 text-right">Mission</span>
          </div>
          {reservations.slice(0, 200).map(r => {
            const st = RES_STATUS[r.status] ?? RES_STATUS.confirmed;
            return (
              <div key={r.id} className="grid grid-cols-12 items-center px-4 py-3 border-b last:border-0" style={{ borderColor: '#F2EFE9' }}>
                <div className="col-span-4 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{r.apartmentName ?? '—'}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <span className="col-span-2 text-xs" style={{ color: '#7A7068' }}>{platformLabel(r.platform)}</span>
                <span className="col-span-2 text-center text-xs" style={{ color: '#7A7068' }}>{fmtDate(r.checkIn)}</span>
                <span className="col-span-2 text-center text-xs font-semibold" style={{ color: '#1A1A1A' }}>{fmtDate(r.checkOut)}</span>
                <div className="col-span-2 text-right">
                  {r.missionId ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#5A8A6A' }}><Icon name="check" size={13} /> Créée</span>
                  ) : r.status === 'confirmed' ? (
                    <span className="text-[11px]" style={{ color: '#C48A2A' }}>À venir</span>
                  ) : (
                    <span className="text-[11px]" style={{ color: '#A8A09A' }}>—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
