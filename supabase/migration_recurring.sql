-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Interventions récurrentes (ménage programmé à jours fixes)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Un planning récurrent décrit un ménage qui se répète chaque semaine à jours fixes
-- (ex. Lun/Mer/Ven). Les MISSIONS sont matérialisées automatiquement sur un horizon
-- glissant (via le cron, comme la synchro réservations). Ce sont des missions
-- 'cleaning' normales → facturables et payées comme les autres.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS recurring_missions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  airbnb_id         UUID REFERENCES airbnbs(id)  ON DELETE SET NULL,  -- site lié (optionnel)
  property_name     TEXT,                                             -- snapshot si pas de site
  address           TEXT,
  cleaner_id        UUID REFERENCES cleaners(id) ON DELETE SET NULL,
  cleaner_name      TEXT,
  service           TEXT NOT NULL DEFAULT 'cleaning',
  weekdays          INT[] NOT NULL DEFAULT '{}',     -- 0=dimanche … 6=samedi
  time_from         TEXT,                            -- HH:mm
  duration_minutes  INT NOT NULL DEFAULT 60,
  price             NUMERIC(10,2) NOT NULL DEFAULT 0,
  start_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date          DATE,                            -- nul = sans fin
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  last_generated_date DATE,
  created_by        UUID,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lien mission → planning récurrent, pour le dédoublonnage d'une occurrence générée.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS recurring_id UUID REFERENCES recurring_missions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_missions_recurring ON missions(recurring_id, date_from);
CREATE INDEX IF NOT EXISTS idx_recurring_active ON recurring_missions(active);
