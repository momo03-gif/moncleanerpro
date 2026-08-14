'use client';

// Tableau de bord partenaire (conciergerie) : la vue opérationnelle du jour.
// Priorité aux ALERTES actionnables (turnover, départ sans ménage, synchro en
// panne), puis chiffres clés, actions rapides, ménages du jour avec statut, et
// aperçu des 7 prochains jours. Objectif : répondre en un coup d'œil à
// « qu'est-ce qui se passe et qu'est-ce que je dois surveiller ? ».

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAirbnbsForPartner, getReservationsForPartner, getMissionsForPartnerDB,
  getReservationFeedsForPartner,
} from '@/lib/db';
import { getRepairsForPartnerDB } from '@/lib/repairs';
import { apartmentStats, totalStats } from '@/lib/partnerStats';
import type { Apartment, Reservation, Mission, ReservationFeed, Repair } from '@/lib/types';
import { missionStatusCfg, missionStatusLabel } from '@/lib/labels';
import { formatHour } from '@/lib/format';
import { missionReadiness, READINESS_STYLE } from '@/lib/readiness';
import Icon, { type IconName } from '@/components/Icon';
import Loading from '@/components/Loading';
import { AlertRow, Badge, Card, PageTitle, SectionTitle, Tile } from '@/components/ui';

// Date LOCALE (en-CA → YYYY-MM-DD) : sinon « aujourd'hui » bascule d'un jour
// entre minuit et 2h en heure française (toISOString renvoie l'UTC).
const todayStr = () => new Date().toLocaleDateString('en-CA');
const addDaysStr = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };
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
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);

  const autoSynced = useRef(false);

  // Chargement pur des données (aucune logique de synchro) : réutilisable tel quel
  // après une synchro, sans auto-référence.
  const refetch = useCallback(async () => {
    if (!user) return null;
    const [a, r, m, f, rep] = await Promise.all([
      getAirbnbsForPartner(user.id),
      getReservationsForPartner(user.id),
      getMissionsForPartnerDB(user.id),
      getReservationFeedsForPartner(user.id),
      getRepairsForPartnerDB(user.id),
    ]);
    setApartments(a); setReservations(r); setMissions(m); setFeeds(f); setRepairs(rep);
    setLoading(false);
    return f;
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const f = await refetch();
      if (cancelled || !f || !user) return;
      // Synchro auto à l'ouverture (une fois par visite) si les données datent de
      // plus de 30 min : les départs/arrivées sont frais au moment où le partenaire
      // regarde, sans dépendre uniquement des crons 2×/jour. Non bloquant.
      if (!autoSynced.current && f.length > 0) {
        autoSynced.current = true;
        const latest = f.map(x => x.lastSyncAt).filter(Boolean).sort().pop();
        const stale = !latest || Date.now() - new Date(latest).getTime() > 30 * 60 * 1000;
        if (stale) {
          fetch('/api/reservations/sync', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ partnerId: user.id }),
          }).then(() => refetch()).catch(() => { /* silencieux : le cron prendra le relais */ });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [refetch, user]);

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

  // Préparation des logements : ménages du jour dont le voyageur arrive et qui
  // ne sont pas encore terminés (ou l'ont été trop tard). C'est l'alerte la plus
  // opérationnelle de la journée pour une conciergerie.
  const atRisk = missionsToday
    .map(m => ({ mission: m, r: missionReadiness(m) }))
    .filter(x => x.r && (x.r.tone === 'urgent' || x.r.tone === 'late'));

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

  // Vue « property management » du jour : arrivées, départs, occupation.
  const arrivalsToday = confirmed.filter(r => r.checkIn === t).length;
  const departuresToday = confirmed.filter(r => r.checkOut === t).length;
  // Logement occupé aujourd'hui = un séjour confirmé couvre la journée (arrivée ≤ auj. ≤ départ).
  const occupiedToday = apartments.filter(a => confirmed.some(r => r.airbnbId === a.id && r.checkIn <= t && r.checkOut >= t)).length;
  const freeToday = apartments.length - occupiedToday;

  // Activité de la semaine (7 jours glissants) : nb de ménages + coût estimé.
  const weekMissions = missions.filter(m => m.status !== 'cancelled' && m.date >= t && m.date < in7);
  const weekCost = Math.round(weekMissions.reduce((s, m) => s + (m.price || 0), 0));
  const weekDone = weekMissions.filter(m => m.status === 'completed').length;

  // Performance du mois en cours, par logement (ménages, coût, ponctualité, note).
  const month = t.slice(0, 7);
  const monthName = new Date().toLocaleDateString('fr-FR', { month: 'long' });
  const statsRows = apartmentStats(apartments, missions, repairs, month);
  const monthTotals = totalStats(statsRows);

  // Prochain départ à venir (après aujourd'hui) — visibilité sur le mouvement suivant.
  const nextDeparture = confirmed
    .filter(r => r.checkOut > t)
    .sort((a, b) => a.checkOut.localeCompare(b.checkOut))[0];

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

  // Config incomplète = pas encore de logement OU pas encore de calendrier connecté.
  // Tant que ce n'est pas fait, on affiche un guide de démarrage plutôt que le
  // tableau de bord vide (première prise en main limpide).
  const setupIncomplete = apartments.length === 0 || feeds.length === 0;

  if (setupIncomplete) {
    return (
      <div className="p-5 mcp-in">
        <PageTitle
          title={`${greeting}${user?.name ? `, ${user.name}` : ''}`}
          subtitle="Configurons votre espace en 3 étapes."
        />
        <div className="rounded-2xl border p-5 border-gold bg-gold-soft">
          <p className="text-sm font-bold mb-1 text-ink">Bien démarrer</p>
          <p className="text-xs mb-4 text-muted">Une fois configuré, vos ménages se créeront automatiquement à chaque départ.</p>
          <div className="space-y-3">
            {/* Un seul geste : le logement et son calendrier se connectent dans le
                même parcours (le logement se crée à la volée si besoin). */}
            <SetupStep n={1} done={apartments.length > 0 && feeds.length > 0}
              title="Connecter un logement"
              desc={feeds.length > 0
                ? `${feeds.length} calendrier${feeds.length > 1 ? 's' : ''} connecté${feeds.length > 1 ? 's' : ''}`
                : 'Collez le lien de votre calendrier Airbnb, Booking, Smoobu…'}
              actionLabel="Connecter" onAction={() => router.push('/airbnb/sync?connect=1')}
              showAction={feeds.length === 0} />
            <SetupStep n={2} done={false} info
              title="C'est automatique"
              desc="À chaque départ synchronisé, un ménage est créé et suivi ici." />
            <SetupStep n={3} done={false} info
              title="Votre standard de ménage"
              desc="Sur la fiche d'un logement, définissez ce que l'intervenant devra cocher à chaque ménage." />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 mcp-in">
      <PageTitle
        title={`${greeting}${user?.name ? `, ${user.name}` : ''}`}
        subtitle={new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      />

      {/* ── Alertes ─────────────────────────────────────────────────────── */}
      <div className="space-y-2.5 mb-6">
        {/* Logement pas prêt alors que le voyageur arrive : l'urgence du jour. */}
        {atRisk.map(({ mission, r }) => (
          <AlertRow key={mission.id} tone={r!.tone === 'late' ? 'danger' : 'warn'}
            onClick={() => router.push(`/airbnb/mission/${mission.id}`)}
            text={`${mission.property || 'Logement'} — ${r!.label}${r!.detail ? ` · ${r!.detail}` : ''}.`} />
        ))}
        {syncError && (
          <AlertRow tone="danger" onClick={() => router.push('/airbnb/sync')}
            text="Un calendrier ne se synchronise plus — des ménages risquent de ne plus se créer." />
        )}
        {turnoversTodayTomorrow.length > 0 && (
          <AlertRow tone="danger" onClick={() => router.push('/airbnb/missions')}
            text={`${turnoversTodayTomorrow.length} turnover${turnoversTodayTomorrow.length > 1 ? 's' : ''} (départ + arrivée le même jour) d'ici demain — ménage prioritaire.`} />
        )}
        {departuresNoMission.length > 0 && (
          <AlertRow tone="warn" onClick={() => router.push('/airbnb/sync')}
            text={`${departuresNoMission.length} départ${departuresNoMission.length > 1 ? 's' : ''} sans ménage prévu (aujourd'hui/demain) — à vérifier.`} />
        )}
        {!syncError && atRisk.length === 0 && turnoversTodayTomorrow.length === 0 && departuresNoMission.length === 0 && (
          <AlertRow tone="success" text="Tout est sous contrôle — aucune alerte." />
        )}
      </div>

      {/* ── Chiffres clés du jour (vue property management) ─────────────── */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Tile label="Arrivées aujourd'hui" value={arrivalsToday} tone={arrivalsToday > 0 ? 'gold' : 'plain'} onClick={() => router.push('/airbnb/missions')} />
        <Tile label="Départs aujourd'hui" value={departuresToday} tone={departuresToday > 0 ? 'gold' : 'plain'} onClick={() => router.push('/airbnb/missions')} />
        <Tile label="Occupés aujourd'hui" value={occupiedToday} sub={`${freeToday} libre${freeToday > 1 ? 's' : ''} · ${apartments.length} au total`} />
        <Tile label="Ménages en attente" value={pendingCount} tone={pendingCount > 0 ? 'warn' : 'plain'} onClick={() => router.push('/airbnb/missions?tab=track')} />
      </div>

      {/* ── Cette semaine (activité + coût estimé) ──────────────────────── */}
      <Card className="p-4 mb-3 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-1 text-muted">Cette semaine</p>
          <p className="text-2xl font-bold text-ink">
            {weekMissions.length}
            <span className="text-sm font-medium text-muted"> ménage{weekMissions.length > 1 ? 's' : ''}</span>
          </p>
          <p className="text-[11px] text-muted">{weekDone} terminé{weekDone > 1 ? 's' : ''}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gold-ink">{weekCost}€</p>
          <p className="text-[11px] text-muted">coût ménages estimé</p>
        </div>
      </Card>

      {/* Prochain départ (repère quand rien aujourd'hui) */}
      {departuresToday === 0 && nextDeparture && (
        <p className="text-xs mb-6 px-1 text-muted">
          Prochain départ : <span className="font-semibold text-ink">{nextDeparture.apartmentName ?? 'Logement'}</span> le {new Date(nextDeparture.checkOut + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
        </p>
      )}
      {(departuresToday > 0 || !nextDeparture) && <div className="mb-3" />}

      {/* ── Actions rapides ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-2.5 mb-6">
        <QuickAction icon="plus" label="Commander" onClick={() => router.push('/airbnb/missions?tab=create')} />
        <QuickAction icon="invoice" label="Devis" onClick={() => router.push('/airbnb/devis')} />
        <QuickAction icon="sync" label="Synchroniser" onClick={() => router.push('/airbnb/sync')} />
        <QuickAction icon="building" label="Logements" onClick={() => router.push('/airbnb')} />
      </div>

      {/* ── Ménages du jour (avec statut) ───────────────────────────────── */}
      <SectionTitle aside={missionsToday.length > 0 ? <span className="text-xs text-muted">{doneToday}/{missionsToday.length} terminés</span> : undefined}>
        Ménages du jour
      </SectionTitle>
      {missionsToday.length === 0 ? (
        <Card className="p-6 text-center mb-6">
          <p className="text-xs text-muted">Aucun ménage prévu aujourd&apos;hui.</p>
        </Card>
      ) : (
        <div className="space-y-2.5 mb-6">
          {missionsToday.map(m => {
            const cfg = missionStatusCfg(m.status);
            const turnover = m.nextArrival === m.date;
            const r = missionReadiness(m);
            return (
              <button key={m.id} onClick={() => router.push(`/airbnb/mission/${m.id}`)}
                className={`w-full text-left rounded-2xl border bg-card px-4 py-3 flex items-center gap-3 active:scale-[0.99] transition-transform ${turnover ? 'border-danger-line' : 'border-line'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate text-ink">{m.property || 'Logement'}</p>
                  <p className="text-xs mt-0.5 text-muted">
                    {m.time ? formatHour(m.time) : '—'}{m.cleanerName ? ` · ${m.cleanerName}` : ' · non assigné'}
                    {turnover && <span className="font-semibold text-danger"> · turnover</span>}
                  </p>
                  {/* Préparation du logement : « Prêt à 12h35 », « 2h avant l'arrivée ». */}
                  {r && (
                    <p className={`text-[11px] mt-1 font-semibold ${READINESS_STYLE[r.tone].text}`}>
                      {r.label}{r.detail ? <span className="font-normal"> · {r.detail}</span> : null}
                    </p>
                  )}
                </div>
                <Badge style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                  {missionStatusLabel(m.status, m.service)}
                </Badge>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Aperçu 7 prochains jours ────────────────────────────────────── */}
      <SectionTitle aside={
        <button onClick={() => router.push('/airbnb/missions')} className="text-xs font-medium text-gold-ink">
          Voir le planning ›
        </button>
      }>
        7 prochains jours
      </SectionTitle>
      <div className="grid grid-cols-7 gap-1.5 mb-6">
        {week.map(({ day, count, turnover }) => {
          const d = new Date(day + 'T00:00:00');
          const isToday = day === t;
          return (
            <div key={day}
              className={`rounded-xl border py-2 flex flex-col items-center gap-1 ${isToday ? 'border-gold bg-gold-soft' : 'border-line bg-card'}`}>
              <span className="text-[10px] capitalize text-muted">{d.toLocaleDateString('fr-FR', { weekday: 'narrow' })}</span>
              <span className={`text-sm font-bold ${isToday ? 'text-gold-ink' : 'text-ink'}`}>{d.getDate()}</span>
              <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold ${
                count === 0 ? 'text-faint' : turnover ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn'
              }`}>
                {count > 0 ? count : '·'}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Performance du mois par logement ────────────────────────────── */}
      <SectionTitle aside={<span className="text-xs capitalize text-muted">{monthName}</span>}>
        Vos logements ce mois
      </SectionTitle>
      <Card className="p-4 mb-3">
        <div className="grid grid-cols-4 gap-2 mb-3">
          <Figure label="Ménages" value={String(monthTotals.cleanings)} />
          <Figure label="Coût" value={`${monthTotals.cost}€`} />
          <Figure label="Turnovers" value={String(monthTotals.turnovers)} />
          <Figure label="Note" value={monthTotals.avgRating !== null ? `${monthTotals.avgRating}/5` : '—'} />
        </div>
        <div className="space-y-1.5">
          {statsRows.filter(r => r.cleanings > 0 || r.openRepairs > 0).map(r => (
            <button key={r.apartmentId} onClick={() => router.push(`/airbnb/logement/${r.apartmentId}`)}
              className="w-full text-left flex items-center justify-between gap-3 border-b border-hairline pb-1.5 last:border-0">
              <span className="text-sm truncate text-ink">{r.apartmentName}</span>
              <span className="text-[11px] shrink-0 flex items-center gap-2 text-muted">
                <span>{r.cleanings} ménage{r.cleanings > 1 ? 's' : ''}</span>
                {r.avgRating !== null && <span className="font-semibold text-gold-ink">{r.avgRating}/5</span>}
                {r.openRepairs > 0 && <span className="font-semibold text-danger">{r.openRepairs} réparation{r.openRepairs > 1 ? 's' : ''}</span>}
              </span>
            </button>
          ))}
          {statsRows.every(r => r.cleanings === 0 && r.openRepairs === 0) && (
            <p className="text-xs text-muted">Aucun ménage terminé ce mois-ci pour l&apos;instant.</p>
          )}
        </div>
        {monthTotals.turnovers > 0 && (
          <p className="text-[11px] mt-2 text-faint">
            « Turnovers » = ménages faits un jour où un voyageur arrivait — les journées les plus tendues.
          </p>
        )}
      </Card>

      {/* ── Ménages à venir ─────────────────────────────────────────────── */}
      {upcomingMissions.length > 0 && (
        <>
          <SectionTitle>Prochains ménages</SectionTitle>
          <div className="space-y-2.5">
            {upcomingMissions.slice(0, 8).map(m => {
              const cfg = missionStatusCfg(m.status);
              return (
                <button key={m.id} onClick={() => router.push(`/airbnb/mission/${m.id}`)}
                  className="w-full text-left rounded-2xl border bg-card border-line px-4 py-3 flex items-center gap-3 active:scale-[0.99] transition-transform">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate text-ink">{m.property || 'Logement'}</p>
                    <p className="text-xs mt-0.5 text-muted">
                      {fmtDay(m.date)}{m.time ? ` · ${formatHour(m.time)}` : ''}{m.cleanerName ? ` · ${m.cleanerName}` : ''}
                    </p>
                  </div>
                  <Badge style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                    {missionStatusLabel(m.status, m.service)}
                  </Badge>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// Chiffre clé compact de la vue performance.
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-2 py-2 text-center">
      <p className="text-base font-bold text-ink">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="rounded-2xl border bg-card border-line py-3 flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
      <span className="text-gold-ink"><Icon name={icon} size={20} /></span>
      <span className="text-[11px] font-semibold text-muted">{label}</span>
    </button>
  );
}

function SetupStep({ n, done, title, desc, actionLabel, onAction, showAction, info }: {
  n: number; done: boolean; title: string; desc: string;
  actionLabel?: string; onAction?: () => void; showAction?: boolean; info?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
        done ? 'bg-success text-white' : info ? 'bg-gold-soft text-gold-ink border border-gold-line' : 'bg-card text-muted border-[1.5px] border-line'
      }`}>
        {done ? <Icon name="check" size={14} /> : info ? <Icon name="sync" size={14} /> : n}
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-[11px] text-muted">{desc}</p>
      </div>
      {showAction && onAction && actionLabel && (
        <button onClick={onAction}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg shrink-0 bg-gold text-ink active:scale-95 transition-transform">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
