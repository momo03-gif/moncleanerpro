-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Un cleaner ne s'assigne plus une mission tout seul
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Avant : le cleaner cliquait « Accepter » et la mission lui était attribuée
-- immédiatement (status 'assigned'). Désormais il DEMANDE la mission, et l'admin
-- valide ou refuse. La mission reste en 'pending' tant que ce n'est pas validé —
-- aucun statut existant n'est renommé ni détourné.
-- ══════════════════════════════════════════════════════════════════════════════

-- Candidature en attente de validation. NULL = personne n'a demandé la mission.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS pending_cleaner_id UUID
  REFERENCES cleaners(id) ON DELETE SET NULL;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS pending_cleaner_name TEXT;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS pending_requested_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_missions_pending_cleaner
  ON missions(pending_cleaner_id) WHERE pending_cleaner_id IS NOT NULL;

COMMENT ON COLUMN missions.pending_cleaner_id IS
  'Cleaner ayant demandé la mission, en attente de validation admin. NULL = aucune demande.';
COMMENT ON COLUMN missions.pending_requested_at IS
  'Horodatage de la demande — permet à l''admin de traiter les plus anciennes d''abord.';
