-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — No show / prolongation : le motif du ménage non réalisé.
-- À exécuter dans Supabase > SQL Editor. Idempotent. Purement additif.
-- 'no_show'      = le voyageur n'est jamais venu (logement non utilisé) ;
-- 'prolongation' = le voyageur est encore dans le logement.
-- Même clôture et mêmes forfaits ; seuls les textes changent (cf. lib/noShow.ts).
-- NULL sur les anciens no show = 'no_show'.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE missions ADD COLUMN IF NOT EXISTS no_show_reason TEXT;
DO $$ BEGIN
  ALTER TABLE missions ADD CONSTRAINT missions_no_show_reason_check
    CHECK (no_show_reason IS NULL OR no_show_reason IN ('no_show', 'prolongation'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
