// Helpers partagés entre les modules de données (extraits de db.ts).

// Appel d'une route serveur : les opérations sensibles (création de compte, mot de
// passe, validation partenaire) passent par des routes serveur en service_role,
// jamais avec la clé publique.
export async function postServer(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

// La DB stocke parfois l'heure en HH:mm:ss → on tronque à HH:mm.
export function trimTime(t: string | null | undefined): string {
  return (t ?? '').substring(0, 5);
}
