-- ══════════════════════════════════════════════════════════════════
-- MonCleanerPro — Migration « Livraisons »
-- À exécuter UNE FOIS dans Supabase > SQL Editor (idempotent).
--
-- Principe : la livraison s'intègre dans le système de missions existant, sans
-- table séparée. Une mission porte un « service » (nettoyage par défaut, livraison,
-- ou les deux). Un cleaner porte ses capacités (peut nettoyer / peut livrer).
-- Le nettoyage reste le comportement par défaut : l'existant n'est pas modifié.
-- ══════════════════════════════════════════════════════════════════

-- 1) Service porté par la mission ─────────────────────────────────────────────
--    ADD COLUMN ... DEFAULT 'cleaning' applique 'cleaning' à toutes les missions
--    existantes → aucun changement de comportement.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS service TEXT
  CHECK (service IN ('cleaning', 'delivery', 'cleaning_delivery')) DEFAULT 'cleaning';
UPDATE missions SET service = 'cleaning' WHERE service IS NULL;

-- Consignes spécifiques à la livraison (quoi livrer / où déposer), admin → cleaner.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;

-- 2) Capacités du cleaner ─────────────────────────────────────────────────────
--    Les cleaners existants restent « nettoyage seul » (can_clean=true, can_deliver=false).
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS can_clean   BOOLEAN DEFAULT TRUE;
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS can_deliver BOOLEAN DEFAULT FALSE;
UPDATE cleaners SET can_clean   = TRUE  WHERE can_clean   IS NULL;
UPDATE cleaners SET can_deliver = FALSE WHERE can_deliver IS NULL;
