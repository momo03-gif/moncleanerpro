-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Réapprovisionnement des consommables par logement
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Principe : les consommables manquants sont DÉJÀ signalés par l'intervenant en
-- fin de ménage (mission_reports.consumables). Il ne manquait que la mémoire du
-- « je l'ai racheté » : sans elle, la conciergerie relit trois fois la même
-- alerte. Cette table ne stocke que ça — la liste de courses se recalcule à la
-- volée (signalé APRÈS le dernier réapprovisionnement = encore à acheter).
--
-- C'est l'équivalent de l'« inventory tracking » de Turno/Breezeway, sans le
-- poids d'une gestion de stock : une conciergerie ne compte pas ses rouleaux,
-- elle veut savoir quoi racheter avant le prochain voyageur.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS supply_restocks (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  airbnb_id    UUID NOT NULL REFERENCES airbnbs(id) ON DELETE CASCADE,
  item         TEXT NOT NULL,              -- libellé du consommable (cf. CONSUMABLE_ITEMS)
  restocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restocked_by TEXT                        -- nom de l'auteur (snapshot)
);

CREATE INDEX IF NOT EXISTS idx_supply_restocks_airbnb
  ON supply_restocks(airbnb_id, item, restocked_at DESC);

ALTER TABLE supply_restocks DISABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :  select count(*) from supply_restocks;  -- attendu : 0
-- ══════════════════════════════════════════════════════════════════════════════
