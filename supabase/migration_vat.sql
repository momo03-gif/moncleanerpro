-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Taux de TVA pour le calculateur de prix rentable
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Additif.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE profit_config ADD COLUMN IF NOT EXISTS vat_rate NUMERIC NOT NULL DEFAULT 0.20; -- 0.20 = 20 %
