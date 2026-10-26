-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Prestataires : spécialités déclarées à l'inscription.
-- À exécuter dans Supabase > SQL Editor. Idempotent.
-- Le code tolère une base non migrée (les spécialités sont alors ignorées).
-- Clés possibles : voir SPECIALITES dans src/lib/prestataireRegles.ts.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE prestataires ADD COLUMN IF NOT EXISTS specialites TEXT[] NOT NULL DEFAULT '{}';
