// ── Calcul de dates des plannings récurrents (logique pure, sans I/O) ────────────
// Déterministe en UTC → indépendant du fuseau du serveur. Isolé de recurring.ts
// (qui importe supabase) pour rester testable sans charger la couche données.

export function parisToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

export function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=dimanche … 6=samedi
}

export function occurrenceDates(start: string, end: string, weekdays: number[]): string[] {
  const out: string[] = [];
  if (end < start || weekdays.length === 0) return out;
  let cur = start, guard = 0;
  while (cur <= end && guard < 500) {
    if (weekdays.includes(weekdayOf(cur))) out.push(cur);
    cur = addDaysStr(cur, 1);
    guard++;
  }
  return out;
}
