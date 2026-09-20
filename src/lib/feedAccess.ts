// ── Qui a le droit de toucher aux calendriers connectés (logique PURE) ───────
//
// `reservation_feeds` contient les clés API des conciergeries : une clé Hostify
// ouvre TOUT le compte de gestion du client. Cette table ne doit donc être
// écrite que par le serveur, après vérification de l'identité — et ses colonnes
// secrètes ne doivent jamais être lisibles depuis le navigateur.
//
// Les règles vivent ici pour être vérifiables sans base ni session.

export interface Actor {
  id: string;
  role: string;
}

/**
 * Connecter, mettre en pause ou déconnecter un calendrier.
 *
 * L'admin partout. Le partenaire, uniquement sur SES logements : c'est son
 * calendrier, pas celui du voisin. Un logement géré en direct (sans partenaire)
 * n'appartient qu'à l'admin — sinon n'importe quel compte partenaire pourrait
 * brancher un flux sur un logement qui ne le concerne pas.
 */
export function canManageFeed(
  actor: Actor | null,
  apartment: { partnerId: string | null } | null,
): boolean {
  if (!actor || !apartment) return false;
  if (actor.role === 'admin') return true;
  return !!apartment.partnerId && apartment.partnerId === actor.id;
}

/**
 * Colonnes qu'un navigateur a le droit de lire.
 *
 * Tout SAUF les identifiants : `api_key`, `api_secret`, `api_token` et sa date
 * d'expiration restent côté serveur. `connection_kind` et
 * `external_property_id` sont sûrs — ils servent seulement à afficher
 * « connecté par API » et à retrouver le logement chez l'éditeur.
 *
 * Cette liste est la même que celle appliquée en base (droits par colonne, cf.
 * migration_feeds_verrouillage.sql). Un test vérifie qu'elle ne dérive pas.
 */
export const FEED_PUBLIC_COLUMNS = [
  'id', 'airbnb_id', 'partner_id', 'platform', 'ical_url', 'label', 'active',
  'last_sync_at', 'last_sync_status', 'last_error', 'created_at',
  'connection_kind', 'external_property_id',
] as const;

/** Colonnes qui ne doivent JAMAIS sortir du serveur. */
export const FEED_SECRET_COLUMNS = [
  'api_key', 'api_secret', 'api_token', 'api_token_expires_at',
] as const;
