// ── Suivi des prospects — logique PURE (sans I/O) ─────────────────────────────
//
// Ce qui fait la valeur de l'écran, c'est l'ORDRE : une relance en retard doit
// remonter avant tout le reste, sinon l'outil n'est qu'une liste de plus.
// Isolé de prospects.ts (qui parle à la base) pour rester testable.

export type ProspectStatut = 'attente' | 'envoye' | 'accepte' | 'refuse';
export type ProspectNature =
  'hotellerie' | 'ehpad' | 'conciergerie' | 'particulier' | 'chantier' | 'bureaux' | 'autre';

export interface Prospect {
  id: string;
  nom: string;
  entreprise?: string;
  email?: string;
  telephone?: string;
  nature: ProspectNature;
  statut: ProspectStatut;
  montant?: number | null;
  /** Prochaine relance (YYYY-MM-DD). */
  relance?: string | null;
  notes?: string;
  devisId?: string;
  devisNumber?: string;
  source: 'devis' | 'manuel';
  createdAt?: string;
}

export const STATUT_LABEL: Record<ProspectStatut, string> = {
  attente: 'En attente d’envoi',
  envoye: 'Devis envoyé',
  accepte: 'Devis accepté',
  refuse: 'Devis refusé',
};

export const NATURE_LABEL: Record<ProspectNature, string> = {
  hotellerie: 'Hôtellerie',
  ehpad: 'EHPAD & résidences',
  conciergerie: 'Conciergerie & Airbnb',
  particulier: 'Particulier',
  chantier: 'Fin de chantier',
  bureaux: 'Bureaux & commerces',
  autre: 'Autre',
};

/** Une affaire close ne se relance pas. */
export const isClosed = (s: ProspectStatut) => s === 'accepte' || s === 'refuse';

export type Urgency = 'overdue' | 'today' | 'soon' | 'upcoming' | 'none' | 'closed';

/**
 * Urgence d'une relance. `today` est injecté (YYYY-MM-DD) pour que le calcul ne
 * dépende pas de l'horloge de la machine — et soit testable.
 */
export function relanceUrgency(p: Pick<Prospect, 'statut' | 'relance'>, today: string): Urgency {
  if (isClosed(p.statut)) return 'closed';
  if (!p.relance) return 'none';
  if (p.relance < today) return 'overdue';
  if (p.relance === today) return 'today';
  const days = Math.round(
    (new Date(p.relance + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime()) / 86400000,
  );
  return days <= 3 ? 'soon' : 'upcoming';
}

/** Phrase affichée dans la colonne « Relance ». */
export function relanceLabel(p: Pick<Prospect, 'statut' | 'relance'>, today: string): string {
  const u = relanceUrgency(p, today);
  if (u === 'closed') return '—';
  if (u === 'none') return 'Non planifiée';
  if (u === 'today') return "Aujourd'hui";
  const jour = new Date(p.relance! + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  return u === 'overdue' ? `En retard · ${jour}` : jour;
}

const URGENCY_RANK: Record<Urgency, number> = {
  overdue: 0, today: 1, soon: 2, upcoming: 3, none: 4, closed: 5,
};

export type SortMode = 'relance' | 'recent' | 'nom';

/** Filtre (statut + recherche) puis trie. */
export function filterAndSort(
  list: Prospect[],
  { statut, search, sort, today }: { statut: ProspectStatut | 'tous'; search: string; sort: SortMode; today: string },
): Prospect[] {
  let out = statut === 'tous' ? [...list] : list.filter(p => p.statut === statut);

  const q = search.trim().toLowerCase();
  if (q) {
    out = out.filter(p =>
      (p.nom ?? '').toLowerCase().includes(q)
      || (p.entreprise ?? '').toLowerCase().includes(q)
      || (p.email ?? '').toLowerCase().includes(q)
      || (p.telephone ?? '').toLowerCase().includes(q));
  }

  if (sort === 'nom') return out.sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  if (sort === 'recent') return out.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

  // Par défaut : l'urgence. À urgence égale, la date de relance la plus proche,
  // puis la demande la plus ancienne (celle qui attend depuis le plus longtemps).
  return out.sort((a, b) => {
    const ra = URGENCY_RANK[relanceUrgency(a, today)];
    const rb = URGENCY_RANK[relanceUrgency(b, today)];
    if (ra !== rb) return ra - rb;
    if (a.relance && b.relance && a.relance !== b.relance) return a.relance.localeCompare(b.relance);
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
  });
}

export interface ProspectStats {
  total: number;
  counts: Record<ProspectStatut, number>;
  /** Part d'acceptés parmi les devis tranchés. null si rien n'est tranché. */
  tauxAcceptation: number | null;
  /** Fiches à relancer aujourd'hui ou en retard. */
  urgents: number;
  /** Montant cumulé des affaires encore ouvertes. */
  potentiel: number;
}

export function computeStats(list: Prospect[], today: string): ProspectStats {
  const counts: Record<ProspectStatut, number> = { attente: 0, envoye: 0, accepte: 0, refuse: 0 };
  let urgents = 0, potentiel = 0;

  for (const p of list) {
    counts[p.statut]++;
    const u = relanceUrgency(p, today);
    if (u === 'overdue' || u === 'today') urgents++;
    if (!isClosed(p.statut)) potentiel += p.montant ?? 0;
  }

  const tranches = counts.accepte + counts.refuse;
  return {
    total: list.length,
    counts,
    tauxAcceptation: tranches > 0 ? Math.round((counts.accepte / tranches) * 100) : null,
    urgents,
    potentiel: Math.round(potentiel),
  };
}

/** Date du jour au format YYYY-MM-DD, en heure LOCALE (pas UTC). */
export const todayISO = () => new Date().toLocaleDateString('en-CA');

/** Date dans N jours — sert aux raccourcis « relancer dans 3 jours ». */
export function inDays(n: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString('en-CA');
}
