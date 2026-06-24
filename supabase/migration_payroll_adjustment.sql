-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Ajustement manuel de la paie (admin)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent (IF NOT EXISTS).
--
-- Purement additif : aucune table existante modifiée. La paie de base reste
-- calculée par le moteur (temps ménage prévu). Cette table permet à l'admin de
-- corriger le montant final d'un cleaner pour un mois donné (delta € + raison),
-- sans toucher au calcul automatique. Réservé à l'admin (routes service_role).
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payroll_adjustments (
  cleaner_id  UUID NOT NULL REFERENCES cleaners(id) ON DELETE CASCADE,
  period      TEXT NOT NULL,                 -- mois concerné « YYYY-MM »
  amount      NUMERIC NOT NULL DEFAULT 0,    -- ajustement € (peut être négatif)
  note        TEXT,                          -- raison de l'ajustement (audit)
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (cleaner_id, period)
);

ALTER TABLE payroll_adjustments DISABLE ROW LEVEL SECURITY;
