-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Correction d'un devis DÉJÀ ENVOYÉ (révisions)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent.
--
-- Avant : un devis passé en « Envoyé » était figé. Quand le client s'était
-- trompé de prestation, il fallait créer un second devis — deux numéros pour
-- une seule affaire, et le client recevait deux liens sans savoir lequel vaut.
--
-- Maintenant : on corrige LE MÊME devis (même numéro, même lien). Chaque
-- correction incrémente `revision`, garde une copie du contenu précédent et
-- porte un mot d'explication affiché au client (« la prestation adaptée à
-- votre logement est … »). Le devis repasse en attente de décision.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE devis ADD COLUMN IF NOT EXISTS revision       INTEGER NOT NULL DEFAULT 1;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS revision_note  TEXT;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS revised_at     TIMESTAMPTZ;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS previous_lines JSONB;
ALTER TABLE devis ADD COLUMN IF NOT EXISTS previous_total NUMERIC;

COMMENT ON COLUMN devis.revision IS
  'Version du devis. 1 = version d''origine. Incrémentée à chaque correction.';
COMMENT ON COLUMN devis.revision_note IS
  'Mot d''explication de la DERNIÈRE correction, affiché au client sur son lien.';
COMMENT ON COLUMN devis.revised_at IS
  'Date de la dernière correction (NULL tant que le devis n''a jamais été corrigé).';
COMMENT ON COLUMN devis.previous_lines IS
  'Lignes de la version précédente, pour montrer au client ce qui a changé.';
COMMENT ON COLUMN devis.previous_total IS
  'Total HT de la version précédente (comparaison avant/après).';

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select number, status, revision, revised_at, revision_note from devis
--   order by created_at desc limit 10;   -- attendu : revision = 1 partout
-- ══════════════════════════════════════════════════════════════════════════════
