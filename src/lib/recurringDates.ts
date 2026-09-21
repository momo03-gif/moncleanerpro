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

/**
 * Nombre de semaines entre deux dates, en comptant depuis le LUNDI de chaque
 * semaine. Sans ce calage, « une semaine sur deux » à partir d'un dimanche
 * basculerait de parité au changement de semaine.
 */
export function semainesEcoulees(origine: string, date: string): number {
  const lundi = (d: string) => {
    const j = weekdayOf(d);
    return addDaysStr(d, j === 0 ? -6 : 1 - j);   // 0 = dimanche → lundi précédent
  };
  const a = lundi(origine), b = lundi(date);
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  const jours = (Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000;
  return Math.round(jours / 7);
}

/**
 * Dates d'un planning récurrent.
 *
 * `intervalleSemaines` porte la fréquence commerciale : 1 = chaque semaine,
 * 2 = une semaine sur deux, 4 = une fois par mois. Sans lui, on ne savait dire
 * que « tous les mardis » — or une offre grand public se vend en fréquences.
 *
 * La parité se compte depuis la PREMIÈRE intervention, pas depuis la date de
 * souscription. Sinon un client qui souscrit un dimanche pour des mardis
 * attendrait neuf jours : le dimanche appartient à la semaine commencée le
 * lundi précédent, et la semaine suivante tombe alors sur la mauvaise parité.
 */
export function occurrenceDates(
  start: string, end: string, weekdays: number[], intervalleSemaines = 1,
): string[] {
  const out: string[] = [];
  if (end < start || weekdays.length === 0) return out;
  const pas = Math.max(1, Math.round(intervalleSemaines) || 1);

  // La première date qui tombe un des jours retenus sert d'origine.
  let origine: string | null = null;
  let cur = start, guard = 0;
  while (cur <= end && guard < 500) {
    if (weekdays.includes(weekdayOf(cur))) { origine = cur; break; }
    cur = addDaysStr(cur, 1);
    guard++;
  }
  if (!origine) return out;

  cur = origine; guard = 0;
  while (cur <= end && guard < 500) {
    if (weekdays.includes(weekdayOf(cur))
      && (pas === 1 || semainesEcoulees(origine, cur) % pas === 0)) {
      out.push(cur);
    }
    cur = addDaysStr(cur, 1);
    guard++;
  }
  return out;
}
