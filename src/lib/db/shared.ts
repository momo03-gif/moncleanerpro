// Helpers partagés entre les modules de données (extraits de db.ts).

// Appel d'une route serveur : les opérations sensibles (création de compte, mot de
// passe, validation partenaire) passent par des routes serveur en service_role,
// jamais avec la clé publique.
// Panne RÉSEAU (pas de réponse, délai dépassé, serveur injoignable) — à
// distinguer d'un REFUS du serveur : la première se rattrape en gardant
// l'action sur le téléphone, le second s'affiche au cleaner.
export class PanneReseau extends Error {
  constructor() { super('Connexion impossible pour le moment.'); this.name = 'PanneReseau'; }
}
export function estPanneReseau(e: unknown): boolean {
  return e instanceof PanneReseau;
}

export async function postServer(url: string, body: unknown, delaiMs = 15000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), delaiMs);   // réseau faible : jamais d'attente infinie
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal,
    });
  } catch {
    throw new PanneReseau();
  } finally {
    clearTimeout(timer);
  }
  // Passerelle injoignable (502/503/504) : c'est le réseau, pas un refus.
  if (res.status === 502 || res.status === 503 || res.status === 504) throw new PanneReseau();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// Lecture via une route serveur (données sensibles non lisibles par la clé publique).
export async function getServer(url: string): Promise<any> {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// La DB stocke parfois l'heure en HH:mm:ss → on tronque à HH:mm.
export function trimTime(t: string | null | undefined): string {
  return (t ?? '').substring(0, 5);
}

// Photos, rapports, réparations, cloche, abonnements push : par le serveur
// (cf. lib/annexes.ts). Lève une erreur si la route refuse.
export async function annexe(op: string, body: Record<string, unknown> = {}): Promise<any> {
  return postServer('/api/annexes', { op, ...body });
}
