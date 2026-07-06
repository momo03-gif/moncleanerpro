// ── Type de client d'une mission : Airbnb / Hôtel / EHPAD ────────────────────
// Source unique pour distinguer les trois familles de clients dans les données
// (stats, facturation, rentabilité). Un EHPAD est un compte hôtelier
// (source 'hotel') dont le `client_type` vaut 'ehpad' ; on le reconnaît via le
// user_id du créateur de la mission (missions.created_by).

export type ClientKind = 'airbnb' | 'hotel' | 'ehpad';

export const CLIENT_KIND_LABEL: Record<ClientKind, string> = {
  airbnb: 'Airbnb',
  hotel: 'Hôtel',
  ehpad: 'EHPAD',
};

export const CLIENT_KIND_COLOR: Record<ClientKind, string> = {
  airbnb: '#C9A84C',
  hotel: '#5B6EF5',
  ehpad: '#5A8A6A',
};

// Classe une mission. `ehpadUserIds` = user_id des comptes marqués EHPAD.
// Tant que la colonne client_type n'est pas renseignée, l'ensemble est vide et
// tous les comptes hôteliers restent « hôtel » (repli sûr).
export function clientKindOf(
  m: { source?: string | null; createdBy?: string | null },
  ehpadUserIds: Set<string>,
): ClientKind {
  if (m.source === 'airbnb') return 'airbnb';
  if (m.createdBy && ehpadUserIds.has(m.createdBy)) return 'ehpad';
  return 'hotel';
}
