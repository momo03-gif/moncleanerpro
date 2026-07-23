// ── Filtre par période (réutilisé Admin / Cleaner / Hôtel / Airbnb) ────────────
// Helpers purs : pas de dépendance React. Les dates sont au format 'YYYY-MM-DD'
// (même format que les colonnes DATE de Supabase), ce qui permet une comparaison
// lexicographique directe.

export type DateRange = { start: string; end: string };
export type PresetKey = 'today' | 'tomorrow' | 'week' | 'month';

// Date locale (pas UTC) → évite le décalage d'un jour en soirée.
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

// Aujourd'hui + n jours, en date LOCALE (n négatif = passé). DST-safe (setDate).
export function addDaysStr(n: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

export const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'tomorrow', label: 'Demain' },
  { key: 'week', label: 'Cette semaine' },
  { key: 'month', label: 'Ce mois' },
];

// Bornes d'un raccourci. Semaine = lundi → dimanche ; Mois = 1er → dernier jour.
export function presetRange(key: PresetKey): DateRange {
  const now = new Date();

  if (key === 'today') {
    const t = toDateStr(now);
    return { start: t, end: t };
  }

  if (key === 'tomorrow') {
    const d = new Date(now);
    d.setDate(now.getDate() + 1);
    const t = toDateStr(d);
    return { start: t, end: t };
  }

  if (key === 'week') {
    const day = now.getDay(); // 0 = dimanche … 6 = samedi
    const start = new Date(now);
    start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: toDateStr(start), end: toDateStr(end) };
  }

  // month
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toDateStr(start), end: toDateStr(end) };
}

// Renvoie la clé du raccourci correspondant exactement à la période, sinon null
// (= période personnalisée saisie via Du/Au).
export function activePreset(start: string, end: string): PresetKey | null {
  for (const p of PRESETS) {
    const r = presetRange(p.key);
    if (r.start === start && r.end === end) return p.key;
  }
  return null;
}

// Libellé lisible de la période sélectionnée (résumé affiché dans le filtre).
// Ex : « Aujourd'hui », « Cette semaine », « 7 juin 2026 », « 7 → 10 juin 2026 ».
export function formatRangeLabel(start: string, end: string): string {
  const preset = activePreset(start, end);
  if (preset) {
    const labels: Record<PresetKey, string> = {
      today: "Aujourd'hui",
      tomorrow: 'Demain',
      week: 'Cette semaine',
      month: 'Ce mois',
    };
    return labels[preset];
  }

  if (!start || !end) return '—';

  const fmt = (s: string, withYear: boolean) =>
    new Date(s + 'T00:00:00').toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      ...(withYear ? { year: 'numeric' } : {}),
    });

  if (start === end) return fmt(start, true);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${fmt(start, !sameYear)} → ${fmt(end, true)}`;
}

// Une date simple (mission) tombe-t-elle dans la période ?
export function inRange(date: string, range: DateRange): boolean {
  if (!date) return false;
  return date >= range.start && date <= range.end;
}

// Une période (annonce du..au) chevauche-t-elle la période sélectionnée ?
export function overlapsRange(from: string, to: string | undefined, range: DateRange): boolean {
  if (!from) return false;
  const end = to && to >= from ? to : from;
  return from <= range.end && end >= range.start;
}
