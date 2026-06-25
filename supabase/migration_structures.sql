-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Sites généralisés (appartement / bureau / salle de sport / autre)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- La table `airbnbs` représente désormais des SITES nettoyés de tout type, pas
-- seulement des logements Airbnb. On ajoute un type de structure ; le défaut
-- 'apartment' s'applique à tout l'existant → aucun changement de comportement.
-- Les sites non-appartements (bureau, salle de sport…) sont des clients facturables
-- (client_price + estimated_cleaning_minutes déjà présents), SANS synchro de
-- réservations ni partenaire obligatoire — créés comme un appartement.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS structure_type TEXT NOT NULL DEFAULT 'apartment'
  CHECK (structure_type IN ('apartment', 'office', 'gym', 'other'));
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS structure_label TEXT;  -- libellé libre pour 'other'

UPDATE airbnbs SET structure_type = 'apartment' WHERE structure_type IS NULL;
