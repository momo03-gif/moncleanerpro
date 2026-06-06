-- ══════════════════════════════════════════════════════════════════
-- MonCleanerPro — Migration « Prochaine arrivée client sur la mission »
-- À exécuter UNE FOIS dans Supabase > SQL Editor (idempotent)
-- ══════════════════════════════════════════════════════════════════

-- Date/heure de la prochaine arrivée client à l'appartement.
-- Si next_arrival = date du ménage -> turnover le jour même (alerte rouge).
ALTER TABLE missions ADD COLUMN IF NOT EXISTS next_arrival DATE;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS next_arrival_time TIME;
