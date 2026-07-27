-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Photos des réparations/incidents (2 max par incident)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent.
-- Les images sont dans le bucket Storage `mission_photos` (sous-dossier repairs/) ;
-- la table ne garde que la liste des URLs.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE repairs ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]';
