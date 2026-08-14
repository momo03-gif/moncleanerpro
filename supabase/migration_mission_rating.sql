-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Notation d'un ménage par la conciergerie
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Principe : une fois le ménage terminé, la conciergerie peut le noter de 1 à 5
-- et laisser un mot. C'est le retour qualité que Breezeway propose sous forme
-- d'étoiles — sauf qu'ici il vient du CLIENT, pas d'un inspecteur interne, donc
-- il vaut bien plus : il alimente le suivi qualité des intervenants.
--
-- La note est facultative et ne bloque rien : un ménage non noté reste un ménage
-- terminé normal.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE missions ADD COLUMN IF NOT EXISTS partner_rating         SMALLINT
  CHECK (partner_rating IS NULL OR partner_rating BETWEEN 1 AND 5);   -- 1 à 5 étoiles
ALTER TABLE missions ADD COLUMN IF NOT EXISTS partner_rating_comment TEXT;        -- mot libre (facultatif)
ALTER TABLE missions ADD COLUMN IF NOT EXISTS partner_rated_at       TIMESTAMPTZ; -- horodatage de la note

-- Index : moyenne par intervenant sur les ménages notés (suivi qualité).
CREATE INDEX IF NOT EXISTS idx_missions_rating ON missions(cleaner_id, partner_rating)
  WHERE partner_rating IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select count(*) from missions where partner_rating is not null;  -- attendu : 0
-- ══════════════════════════════════════════════════════════════════════════════
