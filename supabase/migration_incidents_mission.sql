-- ══════════════════════════════════════════════════════════════════
-- MonCleanerPro — Migration « Incidents liés aux missions »
-- À exécuter UNE FOIS dans Supabase > SQL Editor (idempotent).
--
-- Un incident peut désormais être signalé depuis une MISSION et distinguer
-- les incidents LIÉS AU CLEANER (impactent ses stats RH) des incidents EXTERNES
-- (non liés à son travail → cleaner_id NULL → aucun impact sur ses statistiques).
-- ══════════════════════════════════════════════════════════════════

-- 1) Lien vers la mission concernée.
ALTER TABLE rh_incidents ADD COLUMN IF NOT EXISTS mission_id UUID REFERENCES missions(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_rh_incidents_mission ON rh_incidents(mission_id);

-- 2) cleaner_id devient OPTIONNEL : NULL = incident externe (non attribué).
ALTER TABLE rh_incidents ALTER COLUMN cleaner_id DROP NOT NULL;

-- 3) Élargir les types d'incident (l'ancienne contrainte n'autorisait que 3 types).
ALTER TABLE rh_incidents DROP CONSTRAINT IF EXISTS rh_incidents_type_check;
ALTER TABLE rh_incidents ADD CONSTRAINT rh_incidents_type_check CHECK (type IN (
  'retour_negatif',          -- retour négatif client (cleaner)
  'oubli',                   -- oubli (cleaner)
  'oubli_majeur',            -- ancien type conservé (compat)
  'qualite_insuffisante',    -- qualité insuffisante (cleaner)
  'degradation_non_signalee',-- dégradation non signalée (cleaner)
  'incident_externe',        -- non lié au cleaner
  'autre'                    -- autre
));
