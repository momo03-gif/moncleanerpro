-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — La table `missions` n'est plus lisible publiquement (étape 2b)
-- À exécuter dans Supabase > SQL Editor. Idempotent.
--
-- Avec la clé publique (visible dans le site), n'importe qui lisait les 1 648
-- missions : noms des clients, adresses, consignes, prix, paie des cleaners et
-- positions GPS. Les lectures passent désormais par GET /api/missions, qui ne
-- rend à chaque rôle que ce qu'il a le droit de voir (cf. src/lib/missionRead.ts).
--
-- ⚠️ AVANT D'EXÉCUTER :
--   1. le code correspondant est en ligne DEPUIS AU MOINS 24 H (tous les
--      téléphones ont rechargé l'application) ;
--   2. migration_missions_temps_reel.sql a été exécutée, et le planning se met
--      bien à jour tout seul ;
--   3. migration_missions_ecriture_serveur.sql a été exécutée (ou l'exécuter
--      en même temps).
-- ══════════════════════════════════════════════════════════════════════════════

REVOKE SELECT ON missions FROM anon, authenticated;

-- Vue « missions non sensibles » (LOT 4) : plus utilisée par l'application,
-- mais lisible par tous — adresses et consignes comprises. On la ferme aussi.
REVOKE ALL ON cleaner_missions_public FROM anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION, avec la CLÉ PUBLIQUE :
--   · select id from missions limit 1                 → REFUSÉ (42501)
--   · select id from cleaner_missions_public limit 1  → REFUSÉ (42501)
-- Et dans l'application : planning admin, planning cleaner, missions
-- proposées, espace conciergerie (missions, logement, rapport), classement
-- mensuel du cleaner, fiche de paie.
-- RETOUR ARRIÈRE (en cas de souci) :
--   grant select on missions to anon, authenticated;
-- ══════════════════════════════════════════════════════════════════════════════
