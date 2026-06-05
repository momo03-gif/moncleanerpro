-- ══════════════════════════════════════════════════════════════════
-- MonCleanerPro — Migration « Prix appartement + canapé-lit »
-- À exécuter UNE FOIS dans Supabase > SQL Editor (idempotent)
-- ══════════════════════════════════════════════════════════════════

-- Prix facturé par ménage : saisi sur la fiche appartement, repris
-- automatiquement sur chaque mission (comptabilité du logiciel).
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS client_price NUMERIC;

-- Nombre de canapés-lits (comme chambres / lits).
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS sofa_beds INTEGER;
