-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — La capacité incluse dépend de la TAILLE du logement
-- À exécuter dans Supabase > SQL Editor, après migration_devis_fourchette.sql.
-- Idempotent.
--
-- Avant : un barème de capacité GLOBAL, identique pour tous les paliers. Un
-- studio et une maison facturaient le même supplément pour 4 voyageurs, alors
-- que 4 personnes dans un studio, c'est inhabituel, et dans une maison, c'est
-- en dessous de sa capacité normale.
--
-- Maintenant : chaque palier annonce le nombre de voyageurs COMPRIS dans son
-- prix (« T3 : jusqu'à 6 »). Au-delà, et seulement au-delà, chaque voyageur
-- supplémentaire ajoute un montant unique, réglable dans l'admin.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE devis_surface_tiers ADD COLUMN IF NOT EXISTS capacity_included INTEGER;
COMMENT ON COLUMN devis_surface_tiers.capacity_included IS
  'Voyageurs compris dans le prix du palier. NULL = pas de limite, aucun supplément.';

ALTER TABLE devis_settings ADD COLUMN IF NOT EXISTS extra_guest_fee NUMERIC NOT NULL DEFAULT 5;
COMMENT ON COLUMN devis_settings.extra_guest_fee IS
  'Montant par voyageur AU-DELÀ de la capacité comprise dans le palier.';

-- Capacités reprises de la grille : le haut de la fourchette annoncée.
-- Studio 2 · T2 4 · T3 6 · T4 8 · T5 10 · Maison 12.
UPDATE devis_surface_tiers SET capacity_included = 2  WHERE max_m2 <= 35  AND capacity_included IS NULL;
UPDATE devis_surface_tiers SET capacity_included = 4  WHERE max_m2 > 35  AND max_m2 <= 60  AND capacity_included IS NULL;
UPDATE devis_surface_tiers SET capacity_included = 6  WHERE max_m2 > 60  AND max_m2 <= 80  AND capacity_included IS NULL;
UPDATE devis_surface_tiers SET capacity_included = 8  WHERE max_m2 > 80  AND max_m2 <= 110 AND capacity_included IS NULL;
UPDATE devis_surface_tiers SET capacity_included = 10 WHERE max_m2 > 110 AND max_m2 <= 160 AND capacity_included IS NULL;
UPDATE devis_surface_tiers SET capacity_included = 12 WHERE max_m2 > 160 AND max_m2 <= 200 AND capacity_included IS NULL;
-- Le palier « sur devis » n'a pas de capacité : il ne chiffre rien de toute façon.

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select max_m2, label, capacity_included, base_price, price_max
--   from devis_surface_tiers order by max_m2;
--   select extra_guest_fee from devis_settings;   -- attendu : 5
-- ══════════════════════════════════════════════════════════════════════════════
