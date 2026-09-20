// ── Qui a le droit de toucher à une checklist (logique PURE) ─────────────────
//
// Les écritures de checklist passent par une route serveur depuis que la RLS est
// active sur `checklist_items` et `mission_checklist_checks` : le navigateur
// recevait « new row violates row-level security policy », et ni le partenaire
// ne pouvait créer son standard, ni le cleaner cocher ses points.
//
// Plutôt que de rouvrir ces tables à la clé publique, on fait comme pour les
// rendez-vous, le parking et les prospects : le serveur écrit, après avoir
// vérifié QUI demande. Les règles vivent ici, hors de la route, pour être
// vérifiables sans base ni session.

export interface Actor {
  id: string;
  role: string;
}

/**
 * Modifier le STANDARD d'un logement (ajouter, renommer, archiver, réordonner,
 * installer le modèle de démarrage).
 *
 * L'admin le peut partout. Le partenaire, uniquement sur SES logements : c'est
 * son standard de ménage, mais pas celui du voisin. Un logement sans partenaire
 * (géré en direct) n'appartient qu'à l'admin.
 */
export function canEditChecklist(actor: Actor | null, apartment: { partnerId: string | null } | null): boolean {
  if (!actor || !apartment) return false;
  if (actor.role === 'admin') return true;
  return !!apartment.partnerId && apartment.partnerId === actor.id;
}

/**
 * COCHER un point sur un ménage.
 *
 * C'est le geste de celui qui fait le travail : le cleaner assigné, et l'admin
 * qui peut rattraper une omission. Le partenaire, lui, lit la conformité mais ne
 * coche pas — sinon la checklist ne prouverait plus rien.
 */
export function canCheckChecklist(
  actor: Actor | null,
  mission: { cleanerUserId: string | null } | null,
): boolean {
  if (!actor || !mission) return false;
  if (actor.role === 'admin') return true;
  return !!mission.cleanerUserId && mission.cleanerUserId === actor.id;
}
