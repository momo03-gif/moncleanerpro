-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Verrouillage de `cleaners` (lecture) et de la PAIE des missions
-- À exécuter dans Supabase > SQL Editor. Idempotent.
--
-- 1) `cleaners` — e-mail, téléphone, TAUX HORAIRE, type de contrat et plaque de
--    chaque salarié. Aucun de ces champs n'a à être lisible avec la clé publique.
--    Les écrans passent désormais par /api/cleaners, qui rend tout à l'admin,
--    sa propre fiche à chacun, et le strict nécessaire aux listes de sélection.
--
-- 2) `missions` — les colonnes d'ARGENT. La paie d'un cleaner ne se décide plus
--    dans un navigateur : elle est recalculée par le serveur à partir du taux en
--    base, partout — affectation, approbation d'un temps supplémentaire, ajout
--    de temps, modification d'une mission, génération des récurrences.
--
-- Postgres ne sait pas retirer une colonne d'un droit d'UPDATE : il faut retirer
-- le droit, puis le rendre colonne par colonne. La liste ci-dessous EXCLUT
-- volontairement cleaner_gain, cleaner_hourly_rate_snapshot et price.
--
-- ⚠️ AVANT D'EXÉCUTER : déployer le code correspondant, et vérifier dans
-- l'application (écran cleaners, fiche de paie, approbation d'un temps
-- supplémentaire, création d'une récurrence).
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Coordonnées et rémunération des salariés ─────────────────────────────────
REVOKE SELECT ON cleaners FROM anon, authenticated;
GRANT SELECT (
  id, user_id, name, status, can_clean, can_deliver, formation_completee, created_at
) ON cleaners TO anon, authenticated;

-- 2) Les colonnes d'argent des missions ───────────────────────────────────────
-- ⚠️ Cette partie demande la liste EXACTE des colonnes de `missions`. Pour ne
-- rien oublier, lancer d'abord cette requête, qui ÉCRIT le GRANT à coller :
--
--   select 'grant update (' || string_agg(column_name, ', ' order by ordinal_position)
--          || ') on missions to anon, authenticated;'
--     from information_schema.columns
--    where table_schema = 'public' and table_name = 'missions'
--      and column_name not in ('cleaner_gain', 'cleaner_hourly_rate_snapshot', 'price');
--
-- Puis :
--   revoke update on missions from anon, authenticated;
--   <coller ici le grant produit par la requête ci-dessus>

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION, avec la CLÉ PUBLIQUE :
--   · select hourly_rate from cleaners   → REFUSÉ (42501)
--   · select id, name from cleaners      → OK
--   · update missions set price = 0      → REFUSÉ, une fois la partie 2 jouée
-- ══════════════════════════════════════════════════════════════════════════════
