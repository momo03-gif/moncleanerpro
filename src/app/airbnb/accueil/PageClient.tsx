'use client';

// Tableau de bord partenaire (conciergerie) : la vue opérationnelle du jour.
// Priorité aux ALERTES actionnables (turnover, départ sans ménage, synchro en
// panne), puis chiffres clés, actions rapides, ménages du jour avec statut, et
// aperçu des 7 prochains jours. Objectif : répondre en un coup d'œil à
// « qu'est-ce qui se passe et qu'est-ce que je dois surveiller ? ».

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
import Icon, { type IconName } from '@/components/Icon';
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
  const tomorrow = addDaysStr(1);
  const in7 = addDaysStr(7);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  const confirmed = reservations.filter(r => r.status === 'confirmed');
  const arrivalsByDay = new Set(confirmed.map(r => r.checkIn));
  const isTurnover = (checkOut: string) => arrivalsByDay.has(checkOut);

  // Ménages du jour (missions datées aujourd'hui, non annulées).
  const missionsToday = missions
    .filter(m => m.date === t && m.status !== 'cancelled')
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  const doneToday = missionsToday.filter(m => m.status === 'completed').length;

  // ── Alertes actionnables ──────────────────────────────────────────────
  const turnoversTodayTomorrow = confirmed
    .filter(r => (r.checkOut === t || r.checkOut === tomorrow) && isTurnover(r.checkOut))
    .sort((a, b) => a.checkOut.localeCompare(b.checkOut));
  // Départs (auj. + demain) sans ménage rattaché → risque d'oubli.
  const departuresNoMission = confirmed
    .filter(r => (r.checkOut === t || r.checkOut === tomorrow) && !r.missionId);
  const syncError = feeds.some(f => f.lastSyncStatus === 'error');

  // ── Chiffres clés ─────────────────────────────────────────────────────
  const pendingCount = missions.filter(m => m.status === 'pending' && m.date >= t).length;
  const turnovers7 = confirmed.filter(r => r.checkOut >= t && r.checkOut <= in7 && isTurnover(r.checkOut)).length;

  // ── Aperçu 7 prochains jours (nb de ménages non annulés par jour) ──────
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDaysStr(i);
    const count = missions.filter(m => m.date === day && m.status !== 'cancelled').length;
    const turnover = confirmed.some(r => r.checkOut === day && isTurnover(r.checkOut));
    return { day, count, turnover };
  });

  const upcomingMissions = missions
    .filter(m => !DONE(m.status) && m.date > t && m.date <= in7)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));

  return (
    <div className="p-5">
      <div className="mb-5 pt-2">
        <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>{greeting}{user?.name ? `, ${user.name}` : ''}</h1>
        <p className="text-sm mt-0.5 capitalize" style={{ color: '#A8A09A' }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* ── Alertes ─────────────────────────────────────────────────────── */}
      <div className="space-y-2.5 mb-6">
        {syncError && (
          <AlertRow tone="red" onClick={() => router.push('/airbnb/sync')}
            text="Un calendrier ne se synchronise plus — des ménages risquent de ne plus se créer." />
        )}
        {turnoversTodayTomorrow.length > 0 && (
          <AlertRow tone="red" onClick={() => router.push('/airbnb/missions')}
            text={`${turnoversTodayTomorrow.length} turnover${turnoversTodayTomorrow.length > 1 ? 's' : ''} (départ + arrivée le même jour) d'ici demain — ménage prioritaire.`} />
        )}
        {departuresNoMission.length > 0 && (
          <AlertRow tone="amber" onClick={() => router.push('/airbnb/sync')}
            text={`${departuresNoMission.length} départ${departuresNoMission.length > 1 ? 's' : ''} sans ménage prévu (aujourd'hui/demain) — à vérifier.`} />
        )}
        {!syncError && turnoversTodayTomorrow.length === 0 && departuresNoMission.length === 0 && (
          <div className="rounded-2xl border px-4 py-3 flex items-center gap-3" style={{ borderColor: '#D6E5DB', backgroundColor: '#F1F7F3' }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#5A8A6A' }} />
            <p className="text-xs font-medium" style={{ color: '#5A8A6A' }}>Tout est sous contrôle — aucune alerte.</p>
          </div>
        )}
      </div>

      {/* ── Chiffres clés ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Tile label="Ménages aujourd'hui" value={missionsToday.length} sub={missionsToday.length > 0 ? `${doneToday} terminé${doneToday > 1 ? 's' : ''}` : undefined} tone={missionsToday.length > 0 ? 'gold' : 'plain'} />
        <Tile label="En attente d'assignation" value={pendingCount} tone={pendingCount > 0 ? 'warn' : 'plain'} onClick={() => router.push('/airbnb/missions')} />
        <Tile label="Turnovers (7 j)" value={turnovers7} tone={turnovers7 > 0 ? 'alert' : 'plain'} />
        <Tile label="Logements" value={apartments.length} onClick={() => router.push('/airbnb')} />
      </div>

      {/* ── Actions rapides ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        <QuickAction icon="plus" label="Commander" onClick={() => router.push('/airbnb/missions')} />
        <QuickAction icon="sync" label="Synchroniser" onClick={() => router.push('/airbnb/sync')} />
        <QuickAction icon="building" label="Logements" onClick={() => router.push('/airbnb')} />
      </div>

      {/* ── Ménages du jour (avec statut) ───────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold" style={{ color: '#1A1A1A' }}>Ménages du jour</h2>
        {missionsToday.length > 0 && <span className="text-xs" style={{ color: '#A8A09A' }}>{doneToday}/{missionsToday.length} terminés</span>}
      </div>
      {missionsToday.length === 0 ? (
        <div className="rounded-2xl p-6 text-center border mb-6" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-xs" style={{ color: '#A8A09A' }}>Aucun ménage prévu aujourd'hui.</p>
        </div>
      ) : (
        <div className="space-y-2.5 mb-6">
          {missionsToday.map(m => {
            const cfg = missionStatusCfg(m.status);
            const turnover = m.nextArrival === m.date;
            return (
              <button key={m.id} onClick={() => router.push(`/airbnb/mission/${m.id}`)}
                className="w-full text-left rounded-2xl border px-4 py-3 flex items-center gap-3 active:scale-[0.99] transition-transform" style={{ backgroundColor: '#FFFFFF', borderColor: turnover ? '#EAC4BE' : '#E8E4DC' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{m.property || 'Logement'}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>
                    {m.time ? formatHour(m.time) : '—'}{m.cleanerName ? ` · ${m.cleanerName}` : ' · non assigné'}
                    {turnover && <span style={{ color: '#B85A50', fontWeight: 600 }}> · ⚠ turnover</span>}
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

      {/* ── Aperçu 7 prochains jours ────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold" style={{ color: '#1A1A1A' }}>7 prochains jours</h2>
        <button onClick={() => router.push('/airbnb/missions')} className="text-xs font-medium" style={{ color: '#C9A84C' }}>Voir le planning ›</button>
      </div>
      <div className="grid grid-cols-7 gap-1.5 mb-6">
        {week.map(({ day, count, turnover }) => {
          const d = new Date(day + 'T00:00:00');
          const isToday = day === t;
          return (
            <div key={day} className="rounded-xl border py-2 flex flex-col items-center gap-1" style={{ borderColor: isToday ? '#C9A84C' : '#E8E4DC', backgroundColor: isToday ? '#C9A84C12' : '#FFFFFF' }}>
              <span className="text-[10px] capitalize" style={{ color: '#A8A09A' }}>{d.toLocaleDateString('fr-FR', { weekday: 'narrow' })}</span>
              <span className="text-sm font-bold" style={{ color: isToday ? '#C9A84C' : '#1A1A1A' }}>{d.getDate()}</span>
              <span className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold"
                style={{ backgroundColor: count > 0 ? (turnover ? '#FEE2E2' : '#C9A84C20') : 'transparent', color: count > 0 ? (turnover ? '#B91C1C' : '#A87B1E') : '#D4CEC4' }}>
                {count > 0 ? count : '·'}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Ménages à venir ─────────────────────────────────────────────── */}
      {upcomingMissions.length > 0 && (
        <>
          <h2 className="text-sm font-bold mb-3" style={{ color: '#1A1A1A' }}>Prochains ménages</h2>
          <div className="space-y-2.5">
            {upcomingMissions.slice(0, 8).map(m => {
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
        </>
      )}
    </div>
  );
}

function AlertRow({ text, tone, onClick }: { text: string; tone: 'red' | 'amber'; onClick?: () => void }) {
  const c = tone === 'red'
    ? { border: '#EAC4BE', bg: '#FBECEA', dot: '#B85A50', text: '#B85A50' }
    : { border: '#EBD9A8', bg: '#FCF6E8', dot: '#A87B1E', text: '#A87B1E' };
  return (
    <button onClick={onClick} className="w-full text-left rounded-2xl border px-4 py-3 flex items-center gap-3 active:scale-[0.99] transition-transform" style={{ borderColor: c.border, backgroundColor: c.bg }}>
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.dot }} />
      <p className="text-xs font-semibold flex-1" style={{ color: c.text }}>{text}</p>
      <span className="text-xs shrink-0" style={{ color: c.text }}>›</span>
    </button>
  );
}

function QuickAction({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border py-3 flex flex-col items-center gap-1.5 active:scale-95 transition-transform" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
      <span style={{ color: '#C9A84C' }}><Icon name={icon} size={20} /></span>
      <span className="text-[11px] font-semibold" style={{ color: '#7A7068' }}>{label}</span>
    </button>
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
