// ── Dates « à Paris » (logique pure) ─────────────────────────────────────────
//
// L'activité est à Lyon ; le serveur, lui, tourne en UTC. Entre minuit et 1 h
// (2 h l'été), `new Date().toISOString().slice(0, 10)` ou
// `toLocaleDateString('en-CA')` y donnent encore la date de LA VEILLE — de quoi
// manquer les ménages du jour, fausser une échéance ou déclencher une fausse
// alerte (syncSilence, 03/11/2026). Toute « date du jour » côté serveur passe
// donc par ici. Les dates manipulées sont des chaînes AAAA-MM-JJ.

const JOUR = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Le jour (AAAA-MM-JJ), à Paris, d'un instant donné. */
export function jourParis(instant: Date | number | string = new Date()): string {
  return JOUR.format(new Date(instant));
}

/** Aujourd'hui à Paris (AAAA-MM-JJ). */
export function aujourdhuiParis(): string {
  return jourParis(new Date());
}

/** Le mois en cours à Paris (AAAA-MM). */
export function moisParis(): string {
  return aujourdhuiParis().slice(0, 7);
}

/** Premier jour du mois en cours à Paris (AAAA-MM-01). */
export function debutMoisParis(): string {
  return `${moisParis()}-01`;
}

/** Une date AAAA-MM-JJ décalée de `n` jours (calcul calendaire, sans fuseau). */
export function ajouterJours(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Dans `n` jours (ou il y a, si négatif), à Paris. */
export function dansJoursParis(n: number): string {
  return ajouterJours(aujourdhuiParis(), n);
}
