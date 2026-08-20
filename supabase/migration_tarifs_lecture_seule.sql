-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — La grille de prestations passe en lecture seule côté public
-- À exécuter dans Supabase > SQL Editor. Idempotent.
--
-- Constat : `tarifs` était modifiable avec la clé publique — celle qui part dans
-- le navigateur de chaque visiteur. N'importe qui pouvait changer les prix
-- affichés sur le site, en désactiver, ou tout supprimer.
--
-- La lecture reste ouverte : la page de devis publique en a besoin pour
-- construire son catalogue. L'écriture passe désormais par /api/admin/tarifs,
-- qui vérifie la session administrateur.
--
-- ⚠️ À exécuter APRÈS le déploiement du code qui écrit via la route serveur,
-- sinon l'écran d'administration ne pourra plus enregistrer.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE tarifs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tarifs_read ON tarifs;
CREATE POLICY tarifs_read ON tarifs FOR SELECT USING (true);

-- Aucune policy d'écriture : seul le service_role (routes serveur) peut écrire.

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — depuis l'application, la lecture doit continuer de fonctionner
-- (page /devis-en-ligne) et l'écriture directe être refusée.
-- ══════════════════════════════════════════════════════════════════════════════
