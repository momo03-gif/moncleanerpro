// ── Cache mémoire de session (client) ───────────────────────────────────────
// Petit cache clé→valeur vivant le temps de la session de l'onglet. Il est
// PERDU au rechargement complet de la page, mais CONSERVÉ pendant les navigations
// client (d'une page à l'autre dans l'app). C'est exactement le cas ressenti :
// revenir sur une page déjà visitée affiche instantanément les dernières données
// connues, pendant qu'un rafraîchissement en arrière-plan met à jour (pattern
// « stale-while-revalidate »).
//
// Volontairement simple et non persistant : pas de risque de servir des données
// périmées après un rechargement, et aucune migration.

const store = new Map<string, unknown>();

export function getSessionCache<T>(key: string): T | undefined {
  return store.get(key) as T | undefined;
}

export function setSessionCache<T>(key: string, value: T): void {
  store.set(key, value);
}
