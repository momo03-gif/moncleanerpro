// ── Signature des requêtes Smoobu (logique PURE, testable) ────────────────────
//
// Smoobu abandonne l'en-tête `Api-Key` historique le 25 septembre 2026 : on
// implémente directement l'authentification HMAC, sinon la connexion casserait
// quelques semaines après sa mise en service.
//
// Chaîne signée (séparateur : saut de ligne) :
//   MÉTHODE \n chemin \n query triée \n timestamp \n nonce \n sha256(corps) \n clé
// Signature : HMAC-SHA256 de cette chaîne avec le SECRET, encodée en base64.

/** sha256 d'un corps vide — valeur constante, attendue sur les requêtes GET. */
export const EMPTY_BODY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

/**
 * Query string canonique : paramètres triés par nom, encodés, séparés par `&`.
 * Smoobu compare la signature à SA reconstruction de la requête : un ordre
 * différent invalide tout.
 */
export function canonicalQuery(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => [k, String(v)] as const)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

/** Chaîne canonique à signer. */
export function canonicalString(parts: {
  method: string;
  path: string;              // « /api/reservations »
  query?: string;            // déjà canonique (cf. canonicalQuery)
  timestamp: string;         // ISO 8601 UTC
  nonce: string;             // unique, valable 5 minutes
  bodyHash?: string;         // sha256 hex du corps ; vide → EMPTY_BODY_SHA256
  apiKey: string;
}): string {
  return [
    parts.method.toUpperCase(),
    parts.path,
    parts.query ?? '',
    parts.timestamp,
    parts.nonce,
    parts.bodyHash ?? EMPTY_BODY_SHA256,
    parts.apiKey,
  ].join('\n');
}
