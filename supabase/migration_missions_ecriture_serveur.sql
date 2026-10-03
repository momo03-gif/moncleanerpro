-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Le navigateur n'écrit plus dans `missions` (étape 1 du chantier)
-- À exécuter dans Supabase > SQL Editor. Idempotent.
--
-- Toutes les écritures sur les missions passent désormais par /api/missions,
-- qui lit l'identité dans la session signée et vérifie les droits de chacun
-- (cf. src/lib/missionActions.ts). Avec la clé publique, n'importe qui pouvait
-- jusqu'ici démarrer, clôturer, réassigner ou réécrire une mission.
--
-- ⚠️ AVANT D'EXÉCUTER : le code correspondant doit être en ligne DEPUIS AU
-- MOINS 24 H, pour que tous les téléphones aient rechargé l'application. Une
-- ancienne version encore ouverte écrirait directement et serait refusée.
--
-- Vérifier ensuite dans l'application : démarrer / terminer un ménage côté
-- cleaner, classer les missions côté admin, créer une mission côté
-- conciergerie, noter un ménage.
-- ══════════════════════════════════════════════════════════════════════════════

REVOKE INSERT, UPDATE ON missions FROM anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION, avec la CLÉ PUBLIQUE :
--   · update missions set manual_order = manual_order where id = '<id>'  → REFUSÉ (42501)
--   · insert into missions (date_from) values ('2030-01-01')             → REFUSÉ (42501)
--   · select id from missions limit 1                                     → OK (étape 2)
-- RETOUR ARRIÈRE (en cas de souci) :
--   grant insert, update on missions to anon, authenticated;
-- ══════════════════════════════════════════════════════════════════════════════
