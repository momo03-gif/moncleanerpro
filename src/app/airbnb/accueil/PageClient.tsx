'use client';

// Tableau de bord partenaire (conciergerie) : la vue opérationnelle du jour —
// départs du jour, ménages en attente/à venir, turnovers, état de la synchro.
// Objectif : répondre d'un coup d'œil à « qu'est-ce qui se passe aujourd'hui ? »
// au lieu d'atterrir sur un CRUD d'appartements.

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAirbnbsForPartner, getReservationsForPartner, getMissionsForPartnerDB,
  getReservationFeedsForPartner,
} from '@/lib/db';
import type { Apartment, Reservation, Mission, ReservationFeed } from '@/lib/types';
import { missionStatusCfg, missionStatusLabel } from '@/lib/labels';
import { formatHour } from '@/lib/format';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';

const todayStr = () => new Date().toISOString().split('T')[0];
const addDaysStr = (n: number) => new Date(Date.now() + n * 86400000).toISOString().split('T')[0];
const DONE = (s: string) => s === 'completed' || s === 'cancelled';

function fmtDay(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function PartnerHomeClient() {
  const { user } = useAuth();
  const router = useRouter();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [feeds, setFeeds] = useState<ReservationFeed[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const [a, r, m, f] = await Promise.all([
      getAirbnbsForPartner(user.id),
      getReservationsForPartner(user.id),
      getMissionsForPartnerDB(user.id),
      getReservationFeedsForPartner(user.id),
    ]);
    setApartments(a); setReservations(r); setMissions(m); setFeeds(f);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading className="p-5 pt-8 text-sm" />;

  const t = todayStr();
  const in7 = addDaysStr(7);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const arrivalsByDay = new Set(reservations.filter(r => r.status === 'confirmed').map(r => r.checkIn));
  const isTurnover = (checkOut: string) => arrivalsByDay.has(checkOut);

  // Départs du jour (réservations confirmées dont le départ = aujourd'hui).
  const departuresToday = reservations
    .filter(r => r.status === 'confirmed' && r.checkOut === t)
    .sort((a, b) => (a.checkOutTime || '').localeCompare(b.checkOutTime || ''));

  // Ménages à venir (7 jours), non terminés.
  const upcomingMissions = missions
    .filter(m => !DONE(m.status) && m.date >= t && m.date <= in7)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

  const pendingCount = missions.filter(m => m.status === 'pending' && m.date >= t).length;
  const turnovers7 = reservations.filter(r => r.status === 'confirmed' && r.checkOut >= t && r.checkOut <= in7 && isTurnover(r.checkOut)).length;
  const syncError = feeds.some(f => f.lastSyncStatus === 'error');

  return (
    <div className="p-5">
      <div className="mb-5 pt-2">
        <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>{greeting}{user?.name ? `, ${user.name}` : ''}</h1>
        <p className="text-sm mt-0.5 capitalize" style={{ color: '#A8A09A' }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Alerte synchro en panne */}
      {syncError && (
        <button onClick={() => router.push('/airbnb/sync')} className="w-full text-left rounded-2xl border px-4 py-3 mb-4 flex items-center gap-3" style={{ borderColor: '#EAC4BE', backgroundColor: '#FBECEA' }}>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#B85A50' }} />
          <p className="text-xs font-semibold flex-1" style={{ color: '#B85A50' }}>Un calendrier ne se synchronise plus — des ménages risquent de ne plus se créer.</p>
          <span className="text-xs shrink-0" style={{ color: '#B85A50' }}>Voir ›</span>
        </button>
      )}

      {/* Tuiles */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Tile label="Départs aujourd'hui" value={departuresToday.length} tone={departuresToday.length > 0 ? 'gold' : 'plain'} />
        <Tile label="Ménages en attente" value={pendingCount} tone={pendingCount > 0 ? 'warn' : 'plain'} onClick={() => router.push('/airbnb/missions')} />
        <Tile label="Turnovers (7 j)" value={turnovers7} tone={turnovers7 > 0 ? 'alert' : 'plain'} sub="départ + arrivée le même jour" />
        <Tile label="Logements" value={apartments.length} onClick={() => router.push('/airbnb')} />
      </div>

      {/* Départs du jour */}
      <h2 className="text-sm font-bold mb-3" style={{ color: '#1A1A1A' }}>Départs du jour</h2>
      {departuresToday.length === 0 ? (
        <div className="rounded-2xl p-6 text-center border mb-6" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-xs" style={{ color: '#A8A09A' }}>Aucun départ aujourd'hui.</p>
        </div>
      ) : (
        <div className="space-y-2.5 mb-6">
          {departuresToday.map(r => {
            const turnover = isTurnover(r.checkOut);
            return (
              <div key={r.id} className="rounded-2xl border px-4 py-3 flex items-center gap-3" style={{ backgroundColor: '#FFFFFF', borderColor: turnover ? '#EAC4BE' : '#E8E4DC' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{r.apartmentName ?? 'Logement'}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>
                    Départ{r.checkOutTime ? ` ${formatHour(r.checkOutTime)}` : ''}
                    {turnover && <span style={{ color: '#B85A50', fontWeight: 600 }}> · ⚠ arrivée le jour même</span>}
                  </p>
                </div>
                {r.missionId
                  ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold shrink-0" style={{ color: '#5A8A6A' }}><Icon name="check" size={13} /> Ménage créé</span>
                  : <span className="text-[11px] shrink-0" style={{ color: '#C48A2A' }}>À créer</span>}
              </div>
            );
          })}
        </div>
      )}

      {/* Ménages à venir */}
      <h2 className="text-sm font-bold mb-3" style={{ color: '#1A1A1A' }}>Ménages à venir (7 jours)</h2>
      {upcomingMissions.length === 0 ? (
        <div className="rounded-2xl p-6 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-xs" style={{ color: '#A8A09A' }}>Aucun ménage prévu cette semaine.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {upcomingMissions.slice(0, 15).map(m => {
            const cfg = missionStatusCfg(m.status);
            return (
              <button key={m.id} onClick={() => router.push(`/airbnb/mission/${m.id}`)}
                className="w-full text-left rounded-2xl border px-4 py-3 flex items-center gap-3 active:scale-[0.99] transition-transform" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{m.property || 'Logement'}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>
                    {fmtDay(m.date)}{m.time ? ` · ${formatHour(m.time)}` : ''}{m.cleanerName ? ` · ${m.cleanerName}` : ''}
                  </p>
                </div>
                <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                  {missionStatusLabel(m.status, m.service)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, sub, tone = 'plain', onClick }: {
  label: string; value: number; sub?: string; tone?: 'gold' | 'alert' | 'warn' | 'plain'; onClick?: () => void;
}) {
  const palette = {
    gold:  { bg: '#C9A84C', border: '#C9A84C', label: '#7A6030', value: '#1A1A1A', sub: '#7A6030' },
    alert: { bg: '#FFFFFF', border: '#EAC4BE', label: '#B85A50', value: '#B85A50', sub: '#C98A82' },
    warn:  { bg: '#FFFFFF', border: '#EBD9A8', label: '#A87B1E', value: '#A87B1E', sub: '#C0A560' },
    plain: { bg: '#FFFFFF', border: '#E8E4DC', label: '#A8A09A', value: '#1A1A1A', sub: '#A8A09A' },
  }[tone];
  const inner = (
    <div className="rounded-2xl p-4 border h-full text-left" style={{ backgroundColor: palette.bg, borderColor: palette.border }}>
      <p className="text-xs font-medium mb-1.5" style={{ color: palette.label }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color: palette.value }}>{value}</p>
      {sub && <p className="text-[11px] mt-1 leading-tight" style={{ color: palette.sub }}>{sub}</p>}
    </div>
  );
  return onClick ? <button onClick={onClick} className="block w-full active:scale-95 transition-transform">{inner}</button> : inner;
}
