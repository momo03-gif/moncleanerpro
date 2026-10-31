// ── Course / achat pour un client (logique PURE, sans I/O) ───────────────────
//
// Acheter une machine à café, changer un sommier, faire doubler des clés… On
// avance l'argent, le client nous rembourse, et on facture le service.
//
// L'ARGENT, en 3 morceaux qu'on ne mélange jamais :
//   • les ACHATS (errand_spent) : refacturés AU RÉEL, sur justificatif. Ce n'est
//     pas du chiffre d'affaires mais un remboursement — ligne à part sur la
//     facture, hors base du crédit d'impôt ;
//   • les FRAIS DE SERVICE, déplacement compris = le prix de la mission : ce que
//     gagne la société. Proposés à la création : un % du budget, avec un minimum ;
//   • le CLEANER : taux horaire × durée + une prime fixe par course (errand_bonus).
//     Jamais un % de l'achat : il n'a pas à gagner plus en achetant plus cher.
//
// QUI PAIE AU MAGASIN : le cleaner (il avance → note de frais, remboursée À PART
// de sa paie) ou la carte de la société. Choisi au moment du ticket.

export const COURSE_PAYEURS = [
  { key: 'cleaner', label: 'Moi (à me rembourser)', admin: 'Avancé par l’intervenant' },
  { key: 'company', label: 'Carte de la société', admin: 'Carte de la société' },
] as const;

export type CoursePayeur = (typeof COURSE_PAYEURS)[number]['key'];

export const COURSE_TICKET_ERROR =
  'Indiquez le montant du ticket et qui a payé, puis ajoutez la photo du ticket : c’est le justificatif remis au client.';

export const LIBELLE_ACHATS = 'Achats avancés (au réel, justificatif joint)';

const centimes = (v: number) => Math.round(Math.max(0, v) * 100) / 100;

export function payeurValide(v: unknown): CoursePayeur | null {
  return v === 'cleaner' || v === 'company' ? v : null;
}

export function libellePayeur(v: unknown, cote: 'admin' | 'cleaner' = 'admin'): string {
  const p = COURSE_PAYEURS.find(x => x.key === v);
  if (!p) return 'Non renseigné';
  return cote === 'admin' ? p.admin : p.label;
}

/** Frais de service proposés : `pourcent` % du budget, jamais moins que `minimum`. */
export function fraisServiceCourse(budget: number, pourcent: number, minimum: number): number {
  const parPourcent = centimes((Number(budget) || 0) * (Number(pourcent) || 0) / 100);
  return Math.max(centimes(Number(minimum) || 0), parPourcent);
}

/** Le ticket dépasse-t-il le budget accepté par le client ? */
export function depasseBudget(depense: number | null | undefined, budget: number | null | undefined): boolean {
  return budget != null && Number(budget) > 0 && depense != null && Number(depense) > Number(budget);
}

/** Note de frais due à l'intervenant : il a avancé l'argent et n'est pas encore remboursé. */
export function aRembourser(m: {
  errandPaidBy?: string | null; errandSpent?: number | null; errandReimbursedAt?: string | null;
}): boolean {
  return m.errandPaidBy === 'cleaner' && (Number(m.errandSpent) || 0) > 0 && !m.errandReimbursedAt;
}

/** Montant du ticket saisi par l'intervenant : positif, au centime. null si illisible. */
export function montantTicket(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return Number.isFinite(n) && n > 0 ? centimes(n) : null;
}

/** Prime de l'intervenant pour une course (0 sur toute autre mission). Ligne en base. */
export function primeCourse(m: { service?: unknown; errand_bonus?: unknown } | null | undefined): number {
  return m?.service === 'errand' ? centimes(Number(m.errand_bonus) || 0) : 0;
}

// ── Récapitulatifs (page « Courses & avances ») ──────────────────────────────
// Deux circuits d'argent qu'on ne mélange jamais :
//   • l'intervenant a avancé → on lui DOIT un remboursement (note de frais) ;
//   • la carte de la société a payé → rien à rembourser, mais à pointer avec
//     le relevé bancaire, mois par mois.

interface CourseLigne {
  id: string; date: string; status: string;
  cleanerId?: string; cleanerName?: string;
  errandSpent?: number; errandPaidBy?: string; errandReimbursedAt?: string;
}

const avecTicket = <T extends CourseLigne>(m: T) => m.status !== 'cancelled' && (Number(m.errandSpent) || 0) > 0;

export interface AvancesCleaner<T> {
  cleanerId: string; cleanerName: string;
  /** Ce qu'on lui doit encore. */
  aRembourser: number;
  /** Ce qu'on lui a déjà remboursé. */
  rembourse: number;
  courses: T[];
}

/** Avances des intervenants, par intervenant — ceux à qui on doit le plus d'abord. */
export function avancesParCleaner<T extends CourseLigne>(missions: T[]): AvancesCleaner<T>[] {
  const parCleaner = new Map<string, AvancesCleaner<T>>();
  for (const m of missions) {
    if (m.errandPaidBy !== 'cleaner' || !avecTicket(m)) continue;
    const cle = m.cleanerId ?? 'inconnu';
    const g = parCleaner.get(cle) ?? { cleanerId: cle, cleanerName: m.cleanerName ?? 'Intervenant', aRembourser: 0, rembourse: 0, courses: [] };
    if (m.errandReimbursedAt) g.rembourse = centimes(g.rembourse + Number(m.errandSpent));
    else g.aRembourser = centimes(g.aRembourser + Number(m.errandSpent));
    g.courses.push(m);
    parCleaner.set(cle, g);
  }
  return [...parCleaner.values()]
    .map(g => ({ ...g, courses: [...g.courses].sort((a, b) => b.date.localeCompare(a.date)) }))
    .sort((a, b) => b.aRembourser - a.aRembourser || a.cleanerName.localeCompare(b.cleanerName));
}

export interface DepensesMois<T> { mois: string; total: number; courses: T[] }

/** Dépenses payées avec la carte de la société, par mois (YYYY-MM), le plus récent d'abord. */
export function depensesSocieteParMois<T extends CourseLigne>(missions: T[]): DepensesMois<T>[] {
  const parMois = new Map<string, DepensesMois<T>>();
  for (const m of missions) {
    if (m.errandPaidBy !== 'company' || !avecTicket(m)) continue;
    const mois = m.date.slice(0, 7);
    const g = parMois.get(mois) ?? { mois, total: 0, courses: [] };
    g.total = centimes(g.total + Number(m.errandSpent));
    g.courses.push(m);
    parMois.set(mois, g);
  }
  return [...parMois.values()]
    .map(g => ({ ...g, courses: [...g.courses].sort((a, b) => b.date.localeCompare(a.date)) }))
    .sort((a, b) => b.mois.localeCompare(a.mois));
}
