-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Prestataires : métier (pro du nettoyage ou artisan).
-- À exécuter dans Supabase > SQL Editor. Idempotent.
-- Le code tolère une base non migrée (tout le monde est alors « nettoyage »).
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE prestataires ADD COLUMN IF NOT EXISTS metier TEXT NOT NULL DEFAULT 'nettoyage';
DO $$ BEGIN
  ALTER TABLE prestataires ADD CONSTRAINT prestataires_metier_check CHECK (metier IN ('nettoyage', 'artisan'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
