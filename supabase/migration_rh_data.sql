-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Module RH : données par cleaner + incidents (LOT 2)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent (IF NOT EXISTS).
-- Dépend du LOT 1 (migration_rh.sql). Purement additif.
--
-- cleaner_rh : une ligne par cleaner, recalculée par le moteur (LOT 3). Les
-- compteurs d'incidents et le score qualité reflètent le MOIS EN COURS (champ
-- period). rh_incidents garde l'historique permanent (source de vérité).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1) CLEANER_RH : agrégats RH par cleaner (mois en cours) ───────────────────
CREATE TABLE IF NOT EXISTS cleaner_rh (
  cleaner_id                    UUID PRIMARY KEY REFERENCES cleaners(id) ON DELETE CASCADE,
  period                        TEXT,                       -- mois courant « YYYY-MM »
  employment_months             INTEGER NOT NULL DEFAULT 0, -- ancienneté (mois)
  missions_completed_this_month INTEGER NOT NULL DEFAULT 0,
  days_worked_month             INTEGER NOT NULL DEFAULT 0, -- jours distincts travaillés
  avg_minutes_per_mission       NUMERIC NOT NULL DEFAULT 0, -- moyenne (fin - début)
  travel_paid_minutes           INTEGER NOT NULL DEFAULT 0, -- trajets payés (mois)
  -- compteurs d'incidents du mois (alimentés par rh_incidents)
  negative_feedback_count       INTEGER NOT NULL DEFAULT 0, -- retours négatifs
  major_mistakes_count          INTEGER NOT NULL DEFAULT 0, -- oublis majeurs
  damage_not_reported_count     INTEGER NOT NULL DEFAULT 0, -- dégradations non signalées
  quality_score                 INTEGER NOT NULL DEFAULT 0, -- part de 0, -1 par incident
  -- éligibilités (calculées au LOT 3 ; valeurs neutres par défaut)
  quality_bonus_eligible        BOOLEAN NOT NULL DEFAULT false,
  performance_bonus_eligible    BOOLEAN NOT NULL DEFAULT false,
  tcl_eligible                  BOOLEAN NOT NULL DEFAULT false,
  internet_bonus_eligible       BOOLEAN NOT NULL DEFAULT false,
  reduced_priority              BOOLEAN NOT NULL DEFAULT false,
  updated_at                    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cleaner_rh DISABLE ROW LEVEL SECURITY;

-- ── 2) RH_INCIDENTS : historique permanent des incidents ──────────────────────
-- Trois types, alignés sur les 3 compteurs de cleaner_rh.
CREATE TABLE IF NOT EXISTS rh_incidents (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cleaner_id UUID NOT NULL REFERENCES cleaners(id) ON DELETE CASCADE,
  type       TEXT NOT NULL CHECK (type IN ('retour_negatif', 'oubli_majeur', 'degradation_non_signalee')),
  note       TEXT,
  date       DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rh_incidents DISABLE ROW LEVEL SECURITY;

-- Index : lecture par cleaner (fiche) + filtrage par mois (compteurs, moteur LOT 3).
CREATE INDEX IF NOT EXISTS idx_rh_incidents_cleaner ON rh_incidents(cleaner_id);
CREATE INDEX IF NOT EXISTS idx_rh_incidents_date    ON rh_incidents(date);
