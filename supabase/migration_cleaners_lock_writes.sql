-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Verrouillage des ÉCRITURES sur `cleaners` (clé anon)
-- À exécuter dans Supabase > SQL Editor, APRÈS le déploiement du code qui route
-- les écritures cleaners via /api/cleaners (sinon la gestion des cleaners /
-- disponibilités / plaque casse entre le REVOKE et le déploiement).
--
-- Contexte : `cleaners` est LUE partout dans le navigateur (dont resolveToCleaner
-- TableId, appelé par CHAQUE action cleaner + le mode hors-ligne) → un RLS deny-all
-- casserait l'app. On applique donc le MÊME modèle que `users` : on garde la LECTURE
-- anon mais on COUPE les écritures (le vrai trou : créer un faux cleaner / modifier
-- un salaire/taux/statut). Toutes les écritures passent désormais par des routes
-- serveur service_role (/api/cleaners, /api/admin/users) — non affectées par ce REVOKE.
--
-- NB : ceci n'active PAS la RLS (le linter `rls_disabled_in_public` continuera de
-- signaler `cleaners`, comme `users`) ; la confidentialité des COLONNES salaire
-- (hourly_rate, delivery_rate…) reste un lot ultérieur (nécessite de déplacer les
-- lectures de taux + la liste admin côté serveur).
-- ══════════════════════════════════════════════════════════════════════════════

REVOKE INSERT, UPDATE, DELETE ON public.cleaners FROM anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION (client clé ANON) :
--   update cleaners set hourly_rate = 999 where id = '...';   -- attendu : permission denied
--   select count(*) from cleaners;                            -- attendu : fonctionne (lecture conservée)
-- Via /api/cleaners (service_role, admin/self) : les mises à jour fonctionnent.
-- ══════════════════════════════════════════════════════════════════════════════
