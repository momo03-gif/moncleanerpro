import type { Mission } from './types';

// ══════════════════════════════════════════════════════════════════════════════
//  Badges & motivation cleaner (LOT 6) — calcul PUR, sans aucune donnée sensible.
//  Entrées : missions terminées du cleaner, comptage d'incidents (agrégat), dates.
//  Jamais de montant, prime ou taux horaire.
// ══════════════════════════════════════════════════════════════════════════════

export interface BadgeStats {
  completedTotal: number;       // missions terminées (cumul)
  morningCount: number;         // missions démarrées le matin (avant 9h)
  incidentsThisMonth: number;   // incidents du mois (agrégat)
  daysSinceLastIncident: number;// série « sans incident » en jours
}

export interface Badge {
  id: string;
  label: string;
  hint: string;
  earned: boolean;
  gold?: boolean;               // mise en valeur dorée (jalons majeurs / qualité)
}

export function computeBadgeStats(missions: Mission[], incidentsThisMonth: number, lastIncidentDate: string | null): BadgeStats {
  const completed = missions.filter(m => m.status === 'completed');
  const morningCount = completed.filter(m => (m.time || '').length >= 5 && m.time < '09:00').length;
  let daysSinceLastIncident = 9999;
  if (lastIncidentDate) {
    daysSinceLastIncident = Math.max(0, Math.floor((Date.now() - new Date(lastIncidentDate + 'T00:00:00').getTime()) / 86400000));
  } else if (completed.length > 0) {
    // Jamais d'incident : série depuis la 1re mission terminée.
    const first = completed.map(m => m.date).filter(Boolean).sort()[0];
    if (first) daysSinceLastIncident = Math.max(0, Math.floor((Date.now() - new Date(first + 'T00:00:00').getTime()) / 86400000));
  }
  return { completedTotal: completed.length, morningCount, incidentsThisMonth, daysSinceLastIncident };
}

export function computeBadges(s: BadgeStats): Badge[] {
  return [
    { id: 'm10',  label: '10 missions',  hint: 'Terminer 10 missions',  earned: s.completedTotal >= 10 },
    { id: 'm50',  label: '50 missions',  hint: 'Terminer 50 missions',  earned: s.completedTotal >= 50 },
    { id: 'm100', label: '100 missions', hint: 'Terminer 100 missions', earned: s.completedTotal >= 100, gold: true },
    { id: 'm250', label: '250 missions', hint: 'Terminer 250 missions', earned: s.completedTotal >= 250, gold: true },
    { id: 'week_clean',  label: 'Semaine sans incident', hint: '7 jours sans incident', earned: s.daysSinceLastIncident >= 7 },
    { id: 'perfect_month', label: 'Mois parfait', hint: 'Aucun incident sur le mois', earned: s.incidentsThisMonth === 0 && s.completedTotal > 0, gold: true },
    { id: 'early', label: 'Lève-tôt', hint: '5 missions matinales (avant 9h)', earned: s.morningCount >= 5 },
    { id: 'streak30', label: 'Série de 30 jours', hint: '30 jours consécutifs sans incident', earned: s.daysSinceLastIncident >= 30, gold: true },
  ];
}

// ── NIVEAUX DE PROGRESSION (missions cumulées) ──────────────────────────────────
export interface Level {
  name: 'Bronze' | 'Argent' | 'Or' | 'Platine';
  color: string;
  min: number;
  next?: number;        // seuil du niveau suivant (undefined si max)
  progress: number;     // 0..1 vers le niveau suivant
}

const TIERS: { name: Level['name']; min: number; color: string }[] = [
  { name: 'Bronze',  min: 0,   color: '#B08D57' },
  { name: 'Argent',  min: 50,  color: '#9AA0A6' },
  { name: 'Or',      min: 150, color: '#C9A84C' },
  { name: 'Platine', min: 300, color: '#7A6030' },
];

export function computeLevel(completedTotal: number): Level {
  let idx = 0;
  for (let i = TIERS.length - 1; i >= 0; i--) { if (completedTotal >= TIERS[i].min) { idx = i; break; } }
  const tier = TIERS[idx];
  const next = TIERS[idx + 1];
  const progress = next ? Math.min(1, (completedTotal - tier.min) / (next.min - tier.min)) : 1;
  return { name: tier.name, color: tier.color, min: tier.min, next: next?.min, progress };
}
