// Ce que partagent les onglets de l'écran admin Réservations.

export const RES_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmée', color: '#5A8A6A', bg: '#5A8A6A15' },
  cancelled: { label: 'Annulée',   color: '#B85A50', bg: '#B85A5015' },
  tentative: { label: 'À confirmer', color: '#C48A2A', bg: '#C48A2A15' },
  blocked:   { label: 'Bloqué',    color: '#6B7280', bg: '#6B728018' },
};

export function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);
}

/** Titre d'une journée de départs : « Aujourd'hui », « Demain », sinon la date. */
export function titreJour(jour: string, aujourdhui: string): string {
  const ecart = daysBetween(aujourdhui, jour);
  if (ecart === 0) return 'Aujourd’hui';
  if (ecart === 1) return 'Demain';
  return new Date(jour + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** POST JSON vers une route de l'app ; renvoie le corps (vide si illisible). */
export async function postJson<T = Record<string, unknown>>(url: string, corps: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps),
  });
  return res.json().catch(() => ({} as T));
}

export const titreSection = 'text-sm font-semibold uppercase tracking-wider';
export const carte = { backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' };
