-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Configuration des disponibilités de rendez-vous (éditable admin)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent.
-- Ligne unique (id=1). Config non sensible → lisible par la page publique.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS booking_config (
  id            INT PRIMARY KEY DEFAULT 1,
  working_days  INT[]  NOT NULL DEFAULT '{1,2,3,4,5,6}',      -- 0=dimanche,1=lundi … 6=samedi (conv. JS getDay)
  morning       TEXT[] NOT NULL DEFAULT '{09:00,10:00,11:00}',
  afternoon     TEXT[] NOT NULL DEFAULT '{14:00,15:00,16:00,17:00}',
  slot_min      INT    NOT NULL DEFAULT 60,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT booking_config_single CHECK (id = 1)
);
ALTER TABLE booking_config DISABLE ROW LEVEL SECURITY;

INSERT INTO booking_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
