-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Verrouillage de `airbnbs`, `cleaners` et `depenses`
-- À exécuter dans Supabase > SQL Editor. Idempotent.
--
-- 1) `airbnbs` — l'adresse exacte de chaque logement, le code du portail, celui
--    de la boîte à clés, les directives d'entrée, le contact de secours. De quoi
--    entrer chez les clients de nos clients. Six écritures passaient par le
--    navigateur ; elles passent désormais par /api/airbnbs, qui vérifie la
--    session, qu'un partenaire n'agit que sur SES logements, et qui ignore les
--    champs qui nous sont propres (prix facturé, temps de ménage, zone).
--
-- 2) `cleaners` — e-mail, téléphone et TAUX HORAIRE de chaque salarié. Aucune
--    écriture ne venait du navigateur : la fermer ne demande aucun code.
--
-- 3) `depenses` — la comptabilité. Idem : l'écran passe déjà par
--    /api/admin/depenses, qui vérifie désormais la session admin.
--
-- CE QUE CETTE MIGRATION NE FAIT PAS : fermer la LECTURE. Les écrans du cleaner,
-- du partenaire et de l'admin lisent ces tables en permanence, et les déplacer
-- demande une passe dédiée. Fermer l'écriture empêche déjà qu'on modifie à
-- distance une adresse, un code d'accès ou un taux horaire.
--
-- ⚠️ AVANT D'EXÉCUTER : déployer le code qui fait passer les écritures de
-- `airbnbs` par /api/airbnbs.
-- ══════════════════════════════════════════════════════════════════════════════

REVOKE INSERT, UPDATE, DELETE ON airbnbs   FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON cleaners  FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON depenses  FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON invoices  FROM anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION, avec la CLÉ PUBLIQUE : toute écriture sur ces quatre tables doit
-- être REFUSÉE (42501), la lecture doit continuer de fonctionner.
-- Et dans l'application :
--   · créer et modifier un logement (admin ET partenaire) ;
--   · affecter un cleaner à un logement, recalculer les zones ;
--   · ajouter puis supprimer une dépense.
-- ══════════════════════════════════════════════════════════════════════════════
