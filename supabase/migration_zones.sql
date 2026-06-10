-- ══════════════════════════════════════════════════════════════════
-- MonCleanerPro — Migration « Zones couleur par proximité »
-- À exécuter UNE FOIS dans Supabase > SQL Editor (idempotent)
--
-- Ajoute coordonnées GPS + zone couleur sur chaque appartement.
-- Les missions n'ont PAS de colonnes de zone : elles lisent la zone de
-- leur appartement lié (join airbnb_id) → toujours à jour, pas de doublon.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS latitude   NUMERIC;
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS longitude  NUMERIC;
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS zone_id    TEXT;
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS zone_color TEXT;
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS zone_name  TEXT;
