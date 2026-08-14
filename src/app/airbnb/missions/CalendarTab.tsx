'use client';

// ── Multi-calendrier de la conciergerie ───────────────────────────────────────
// Une ligne par logement, une colonne par jour. C'est la vue que les PMS
// (Hostaway, Hostify) appellent « multi-calendar » : on lit l'occupation, les
// arrivées, les départs et l'état du ménage sans changer d'écran.
//
// Ce qu'on ajoute par rapport à eux : la pastille de ménage porte SON état
// (à assigner / en cours / fait) et le départ sans ménage prévu est signalé en
// creux — c'est le trou qui coûte cher à une conciergerie.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { buildCalendar, daySummary, departuresWithoutCleaning } from '@/lib/partnerCalendar';
import type { Apartment, Mission, Reservation } from '@/lib/types';
import { EmptyState, Button, Card } from '@/components/ui';
import Icon from '@/components/Icon';

const DAYS_SHOWN = 14;

const todayStr = () => new Date().toLocaleDateString('en-CA');
const shift = (day: string, delta: number) => {
  const d = new Date(day + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString('en-CA');
};

// Couleur de la pastille de ménage. Volontairement proche des badges de statut
// utilisés ailleurs : même statut, même couleur, partout dans l'espace.
const MISSION_DOT: Record<string, string> = {
  pending: 'bg-warn',
  accepted: 'bg-gold',
  in_progress: 'bg-gold',
  completed: 'bg-success',
};

export default function CalendarTab({ apartments, reservations, missions }: {
  apartments: Apartment[];
  reservations: Reservation[];
  missions: Mission[];
}) {
  const router = useRouter();
  const [start, setStart] = useState(todayStr);

  if (apartments.length === 0) {
    return (
      <EmptyState icon="building"
        title="Aucun logement"
        hint="Ajoutez un logement pour voir votre calendrier."
        action={<Button onClick={() => router.push('/airbnb')}>Ajouter un logement</Button>} />
    );
  }

  const rows = buildCalendar(apartments, reservations, missions, start, DAYS_SHOWN);
  const days = rows[0].cells.map(c => c.day);
  const t = todayStr();
  const summary = daySummary(rows, t);
  const gaps = departuresWithoutCleaning(rows);
  const showsToday = days.includes(t);

  const monthLabel = (() => {
    const first = new Date(days[0] + 'T00:00:00');
    const last = new Date(days[days.length - 1] + 'T00:00:00');
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `${fmt(first)} → ${fmt(last)}`;
  })();

  return (
    <div>
      {/* Navigation de période */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <button onClick={() => setStart(s => shift(s, -7))} aria-label="Semaine précédente"
          className="w-9 h-9 rounded-xl border border-line flex items-center justify-center text-muted active:scale-95 transition-transform">
          ‹
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-ink">{monthLabel}</p>
          {!showsToday && (
            <button onClick={() => setStart(todayStr())} className="text-[11px] font-medium text-gold-ink">
              Revenir à aujourd&apos;hui
            </button>
          )}
        </div>
        <button onClick={() => setStart(s => shift(s, 7))} aria-label="Semaine suivante"
          className="w-9 h-9 rounded-xl border border-line flex items-center justify-center text-muted active:scale-95 transition-transform">
          ›
        </button>
      </div>

      {/* Résumé du jour — ce qu'on regarde en premier le matin */}
      {showsToday && (
        <Card className="px-4 py-3 mb-3 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">Aujourd&apos;hui</span>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span><span className="font-bold text-ink">{summary.arrivals}</span> arrivée{summary.arrivals > 1 ? 's' : ''}</span>
            <span><span className="font-bold text-ink">{summary.departures}</span> départ{summary.departures > 1 ? 's' : ''}</span>
            {summary.turnovers > 0 && <span className="font-semibold text-danger">{summary.turnovers} turnover{summary.turnovers > 1 ? 's' : ''}</span>}
            <span><span className="font-bold text-ink">{summary.cleaningsDone}/{summary.cleanings}</span> ménage{summary.cleanings > 1 ? 's' : ''}</span>
          </div>
        </Card>
      )}

      {/* Départs sans ménage prévu sur la période affichée */}
      {gaps.length > 0 && (
        <button onClick={() => router.push('/airbnb/missions?tab=create')}
          className="w-full text-left rounded-2xl border border-warn-line bg-warn-soft px-4 py-3 mb-3">
          <p className="text-xs font-semibold text-warn">
            {gaps.length} départ{gaps.length > 1 ? 's' : ''} sans ménage prévu sur cette période
          </p>
          <p className="text-[11px] mt-0.5 text-warn">
            {gaps.slice(0, 3).map(g => `${g.apartmentName} le ${new Date(g.day + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`).join(' · ')}
            {gaps.length > 3 ? ' …' : ''}
          </p>
        </button>
      )}

      {/* Grille : la colonne des logements reste fixe, les jours défilent. */}
      <div className="overflow-x-auto -mx-5 px-5">
        <div className="inline-block min-w-full">
          {/* En-tête des jours */}
          <div className="flex">
            <div className="w-[108px] shrink-0" />
            {days.map(day => {
              const d = new Date(day + 'T00:00:00');
              const isToday = day === t;
              const weekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div key={day} className={`w-11 shrink-0 text-center pb-1.5 ${isToday ? 'text-gold-ink' : weekend ? 'text-faint' : 'text-muted'}`}>
                  <p className="text-[9px] uppercase">{d.toLocaleDateString('fr-FR', { weekday: 'narrow' })}</p>
                  <p className={`text-xs ${isToday ? 'font-bold' : 'font-medium'}`}>{d.getDate()}</p>
                </div>
              );
            })}
          </div>

          {/* Une ligne par logement */}
          {rows.map(row => (
            <div key={row.apartmentId} className="flex items-stretch border-t border-hairline">
              <button onClick={() => router.push(`/airbnb/logement/${row.apartmentId}`)}
                className="w-[108px] shrink-0 pr-2 py-2 text-left">
                <span className="block text-[11px] font-semibold leading-tight truncate text-ink">{row.apartmentName}</span>
              </button>
              {row.cells.map(cell => {
                const isToday = cell.day === t;
                const clickable = !!cell.missionId || cell.departure;
                return (
                  <button
                    key={cell.day}
                    disabled={!clickable}
                    onClick={() => {
                      if (cell.missionId) router.push(`/airbnb/mission/${cell.missionId}`);
                      else if (cell.departure) router.push('/airbnb/missions?tab=create');
                    }}
                    aria-label={`${row.apartmentName} — ${cell.day}${cell.turnover ? ' turnover' : cell.departure ? ' départ' : cell.arrival ? ' arrivée' : ''}`}
                    className={`w-11 shrink-0 py-2 flex flex-col items-center justify-center gap-1 border-l border-hairline
                      ${cell.occupied ? 'bg-gold-soft' : 'bg-card'}
                      ${isToday ? 'ring-1 ring-inset ring-gold' : ''}
                      ${clickable ? 'active:scale-95 transition-transform' : ''}`}
                  >
                    {/* Mouvements du jour */}
                    <span className="h-3 flex items-center gap-0.5">
                      {cell.departure && <span className="text-warn"><Icon name="arrowDown" size={11} /></span>}
                      {cell.arrival && <span className="text-success"><Icon name="arrowUp" size={11} /></span>}
                      {!cell.departure && !cell.arrival && cell.occupied && <span className="w-3 h-px bg-gold-line" />}
                    </span>
                    {/* État du ménage — un départ sans pastille = ménage manquant */}
                    <span className={`w-2 h-2 rounded-full ${
                      cell.missionId ? (MISSION_DOT[cell.missionStatus ?? 'pending'] ?? 'bg-warn')
                        : cell.departure ? 'border border-dashed border-danger' : 'bg-transparent'
                    }`} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 text-[11px] text-muted">
        <span className="flex items-center gap-1"><span className="inline-flex text-success"><Icon name="arrowUp" size={12} /></span> arrivée</span>
        <span className="flex items-center gap-1"><span className="inline-flex text-warn"><Icon name="arrowDown" size={12} /></span> départ</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gold-soft border border-gold-line inline-block" /> occupé</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warn inline-block" /> ménage à assigner</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gold inline-block" /> en cours</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success inline-block" /> fait</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-dashed border-danger inline-block" /> ménage manquant</span>
      </div>
    </div>
  );
}
