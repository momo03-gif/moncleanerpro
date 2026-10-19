// ── Appels navigateur → /api/prestataire ───────────────────────────────────
// Un seul geste pour toutes les opérations (admin ou prestataire) : la route
// décide, d'après la session, ce que l'appelant a le droit de faire.

export interface Prestataire {
  id: string;
  user_id?: string;
  name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  siret?: string | null;
  hourly_rate: number;
  status: 'active' | 'suspended';
  created_at?: string;
  /** Agents actifs (liste admin). */
  agents?: number;
  /** Dû pour les missions terminées ce mois-ci (liste admin). */
  duMois?: number;
}

export interface Agent {
  id: string;
  user_id?: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  created_at?: string;
}

export interface Releve {
  periode: string;
  missions: number;
  minutes: number;
  montant: number;
  lignes: { id: string; date: string; time: string; lieu: string; agent: string | null; minutes: number; montant: number }[];
}

export type Resultat<T = Record<string, unknown>> = ({ ok: true } & T) | { ok: false; error: string };

export async function appelPrestataire<T = Record<string, unknown>>(op: string, corps: Record<string, unknown> = {}): Promise<Resultat<T>> {
  try {
    const res = await fetch('/api/prestataire', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op, ...corps }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) return { ok: false, error: data.error ?? `Erreur ${res.status}` };
    return { ok: true, ...data } as Resultat<T>;
  } catch {
    return { ok: false, error: 'Connexion impossible. Réessayez.' };
  }
}

/** 'YYYY-MM' du mois courant (heure locale). */
export function moisCourant(): string {
  return new Date().toLocaleDateString('en-CA').slice(0, 7);
}

/** '2026-10' → 'octobre 2026'. */
export function libelleMois(periode: string): string {
  const [a, m] = periode.split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

/** Décale un mois 'YYYY-MM' de `delta` mois. */
export function decalerMois(periode: string, delta: number): string {
  const [a, m] = periode.split('-').map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
