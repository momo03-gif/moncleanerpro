-- ══════════════════════════════════════════════════════════════════
-- MonCleanerPro — Migration « Commande liée ménage + livraison »
-- À exécuter UNE FOIS dans Supabase > SQL Editor (idempotent).
--
-- Une commande « Nettoyage + livraison » réalisée par DEUX personnes différentes
-- est représentée par DEUX missions liées (1 ménage service='cleaning' + 1 livraison
-- service='delivery'), partageant le même group_id. Chacune garde son assigné, son
-- statut et sa paie — on réutilise intégralement le système de missions existant.
-- (Le cas « une seule personne fait les deux » reste une mission service='cleaning_delivery'.)
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE missions ADD COLUMN IF NOT EXISTS group_id UUID;
CREATE INDEX IF NOT EXISTS idx_missions_group ON missions(group_id);
