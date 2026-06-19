-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Pointage automatique des missions (temps réel + géolocalisation)
-- À exécuter dans Supabase > SQL Editor (une seule fois).
--
-- Principe : pointage discret. Une seule position au démarrage, une à la fin
-- (pas de suivi GPS continu → batterie + vie privée). Données visibles côté admin
-- uniquement (temps réel, écart vs prévu, statistiques).
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE missions ADD COLUMN IF NOT EXISTS started_at              TIMESTAMPTZ; -- heure de début (clic « Démarrer »)
ALTER TABLE missions ADD COLUMN IF NOT EXISTS ended_at                TIMESTAMPTZ; -- heure de fin (clic « Terminer »)
ALTER TABLE missions ADD COLUMN IF NOT EXISTS actual_duration_minutes INTEGER;     -- durée réelle = fin - début (min)
ALTER TABLE missions ADD COLUMN IF NOT EXISTS start_lat               NUMERIC;     -- position approx. au démarrage
ALTER TABLE missions ADD COLUMN IF NOT EXISTS start_lng               NUMERIC;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS end_lat                 NUMERIC;     -- position approx. à la fin
ALTER TABLE missions ADD COLUMN IF NOT EXISTS end_lng                 NUMERIC;

-- Index : requêtes de statistiques (missions effectivement pointées).
CREATE INDEX IF NOT EXISTS idx_missions_started ON missions(started_at);
