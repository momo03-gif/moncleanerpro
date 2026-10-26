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
  /** Déclaré services à la personne : peut recevoir les ménages de particuliers (crédit d'impôt). */
  sap_declare?: boolean;
  /** Clés de SPECIALITES (lib/prestataireRegles), déclarées à l'inscription. */
  specialites?: string[];
  /** Demande d'inscription pas encore validée (liste admin). */
  en_attente?: boolean;
  /** Kbis et attestation URSSAF présents et à jour (liste admin). */
  vigilance_ok?: boolean;
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
  /** Relevé réglé (null = pas encore payé). */
  paiement: { montant: number; paidAt: string; note: string | null } | null;
}

export interface DocumentPrestataire {
  id: string;
  kind: 'urssaf' | 'kbis' | 'assurance' | 'autre';
  fileName: string | null;
  deliveredOn: string | null;
  uploadedAt: string;
  /** Lien de lecture signé, valable une heure. */
  url: string | null;
}

export interface Vigilance {
  aJour: boolean;
  details: { kind: 'urssaf' | 'kbis'; etat: 'manquant' | 'expire' | 'ok'; jusqu?: string }[];
}

/**
 * Dépose un document (PDF ou photo) puis l'enregistre. `prestataireId` : pour
 * l'admin qui dépose au nom d'un prestataire ; le prestataire n'en a pas besoin.
 */
export async function deposerDocument(
  fichier: File, kind: DocumentPrestataire['kind'], deliveredOn: string, prestataireId?: string,
): Promise<Resultat> {
  if (fichier.size > 10 * 1024 * 1024) return { ok: false, error: 'Fichier trop lourd (10 Mo maximum).' };
  const ext = (fichier.name.split('.').pop() ?? 'pdf').toLowerCase();
  const { deposerFichier } = await import('@/lib/depot');
  const depot = await deposerFichier('prestataire-doc', { docKind: kind, ext, ...(prestataireId ? { prestataireId } : {}) },
    fichier, fichier.type || 'application/octet-stream');
  if (depot.error !== null) return { ok: false, error: 'Envoi du fichier impossible. Réessayez.' };
  return appelPrestataire('doc-add', {
    path: depot.path, kind, fileName: fichier.name, deliveredOn: deliveredOn || null,
    ...(prestataireId ? { id: prestataireId } : {}),
  });
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
