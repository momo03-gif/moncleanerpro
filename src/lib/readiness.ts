// ── Préparation du logement (vue conciergerie) ────────────────────────────────
//
// La question numéro un d'une conciergerie n'est pas « le ménage a-t-il un
// statut ? » mais « le logement sera-t-il PRÊT avant que le voyageur arrive ? ».
// Ce module traduit (statut de mission + prochaine arrivée) en une phrase
// actionnable, la même partout dans l'espace partenaire.
//
// CE QU'ON N'AFFICHE JAMAIS ICI : l'heure de début, l'heure de fin, la durée du
// ménage. Le temps de travail est une affaire interne (il pilote la paie des
// intervenants) et c'est l'admin qui le gère. Le partenaire suit l'AVANCEMENT —
// le statut, et les points de la checklist cochés (cf. lib/checklists.ts).
//
// Les heures d'ARRIVÉE, elles, viennent des réservations du partenaire : ce sont
// ses propres données, on peut les utiliser librement.

import { formatHour } from './format';

export type ReadinessTone =
  | 'ready'     // ménage terminé, logement prêt
  | 'late'      // l'arrivée est passée (ou la date), et le ménage n'est pas fait
  | 'progress'  // ménage en cours
  | 'urgent'    // arrivée imminente et ménage pas terminé
  | 'planned';  // rien d'urgent

export interface Readiness {
  tone: ReadinessTone;
  /** Phrase courte, affichable telle quelle (« Logement prêt »). */
  label: string;
  /** Précision optionnelle (« 3h avant l'arrivée de 15h »). */
  detail?: string;
  /** Vrai quand un voyageur arrive le jour même du ménage. */
  turnover: boolean;
}

/** Champs de mission nécessaires — volontairement minimal (testable sans DB). */
export interface ReadinessInput {
  status: string;
  date: string;              // YYYY-MM-DD
  nextArrival?: string;      // YYYY-MM-DD de la prochaine arrivée
  nextArrivalTime?: string;  // HH:MM
}

/** Minutes écoulées depuis minuit pour "HH:MM" (null si illisible). */
function minutesOfDay(hm: string | null | undefined): number | null {
  if (!hm) return null;
  const [h, m] = hm.split(':');
  const hh = parseInt(h, 10), mm = parseInt(m ?? '0', 10) || 0;
  return Number.isNaN(hh) ? null : hh * 60 + mm;
}

/** Écart en minutes, formaté « 2h10 » / « 45 min ». */
function gapLabel(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs < 60) return `${abs} min`;
  const h = Math.floor(abs / 60), m = abs % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

/**
 * Traduit une mission en état de préparation du logement.
 * `now` est injecté pour rester pur (et testable).
 * Renvoie null quand il n'y a rien d'utile à dire (mission annulée).
 */
export function missionReadiness(m: ReadinessInput, now: Date = new Date()): Readiness | null {
  if (m.status === 'cancelled') return null;

  const today = now.toLocaleDateString('en-CA');
  const turnover = !!m.nextArrival && m.nextArrival === m.date;
  const arrivalMin = turnover ? minutesOfDay(m.nextArrivalTime) : null;
  const nowMin = now.getHours() * 60 + now.getMinutes();

  // ── Ménage terminé : le logement est prêt ──────────────────────────────────
  if (m.status === 'completed') {
    return {
      tone: 'ready',
      label: 'Logement prêt',
      detail: turnover ? 'ménage terminé avant l’arrivée du jour' : 'ménage terminé',
      turnover,
    };
  }

  // ── Ménage en cours ────────────────────────────────────────────────────────
  if (m.status === 'in_progress') {
    if (turnover && arrivalMin !== null && m.date === today) {
      const left = arrivalMin - nowMin;
      return left < 0
        ? { tone: 'late', label: 'Ménage en cours', detail: `le voyageur devait arriver à ${formatHour(m.nextArrivalTime!)}`, turnover }
        : { tone: 'progress', label: 'Ménage en cours', detail: `${gapLabel(left)} avant l'arrivée de ${formatHour(m.nextArrivalTime!)}`, turnover };
    }
    return { tone: 'progress', label: 'Ménage en cours', turnover };
  }

  // ── Pas encore commencé ────────────────────────────────────────────────────
  if (m.date < today) {
    return { tone: 'late', label: 'Ménage non effectué', detail: 'la date est passée', turnover };
  }
  if (!turnover) return { tone: 'planned', label: 'Ménage prévu', turnover };

  if (m.date === today) {
    const left = arrivalMin === null ? null : arrivalMin - nowMin;
    if (left === null) return { tone: 'urgent', label: 'Arrivée aujourd\'hui', detail: 'ménage pas encore fait', turnover };
    if (left < 0) return { tone: 'late', label: `Arrivée dépassée (${formatHour(m.nextArrivalTime!)})`, detail: 'ménage pas encore fait', turnover };
    return { tone: left <= 180 ? 'urgent' : 'planned', label: `Arrivée à ${formatHour(m.nextArrivalTime!)}`, detail: `${gapLabel(left)} pour faire le ménage`, turnover };
  }

  return {
    tone: 'planned',
    label: 'Turnover',
    detail: m.nextArrivalTime ? `arrivée à ${formatHour(m.nextArrivalTime)}` : 'départ et arrivée le même jour',
    turnover,
  };
}

/** Classes Tailwind du projet associées à un ton (bandeaux/pastilles). */
export const READINESS_STYLE: Record<ReadinessTone, { box: string; text: string; dot: string }> = {
  ready:    { box: 'bg-success-soft border-success-line', text: 'text-success', dot: 'bg-success' },
  late:     { box: 'bg-danger-soft border-danger-line',   text: 'text-danger',  dot: 'bg-danger' },
  progress: { box: 'bg-gold-soft border-gold-line',       text: 'text-gold-ink', dot: 'bg-gold' },
  urgent:   { box: 'bg-warn-soft border-warn-line',       text: 'text-warn',    dot: 'bg-warn' },
  planned:  { box: 'bg-surface border-line',              text: 'text-muted',   dot: 'bg-line' },
};
