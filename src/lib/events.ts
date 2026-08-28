// ── Événements navigateur internes ────────────────────────────────────────────
// Module volontairement SANS dépendance (surtout pas supabase) : il est importé
// par la barre latérale, rendue sur toutes les pages admin. Un écran annonce un
// changement, un autre composant l'écoute — sans requête ni état partagé.

// La file des demandes de devis a changé (détail : nombre en attente).
// Émis par l'écran /admin/devis, écouté par la pastille du menu.
export const DEVIS_PENDING_EVENT = 'devis-pending-changed';
