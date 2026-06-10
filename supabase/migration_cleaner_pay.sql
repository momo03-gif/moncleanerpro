-- ══════════════════════════════════════════════════════════════════
-- MonCleanerPro — Migration « Paiement cleaner : taux horaire × durée »
-- À exécuter UNE FOIS dans Supabase > SQL Editor (idempotent)
--
-- Sépare strictement :
--   • Facturation CLIENT (price, client_price, invoices) → INCHANGÉE
--   • Paiement CLEANER (cleaner_gain) → recalculé : taux horaire × minutes / 60
-- ══════════════════════════════════════════════════════════════════

-- ── CLEANERS : un taux horaire unique ───────────────────────────────
-- Backfill depuis l'ancien tarif horaire hôtel (le plus proche).
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS hourly_rate NUMERIC DEFAULT 0;
UPDATE cleaners SET hourly_rate = COALESCE(NULLIF(hourly_rate, 0), hourly_rate_hotel, 0);
-- (hourly_rate_hotel / rate_airbnb sont conservées en base mais ne sont plus utilisées.)

-- ── APPARTEMENTS : durée estimée de nettoyage (minutes) ─────────────
-- Obligatoire, défaut 60 min. On backfill avant d'imposer NOT NULL.
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS estimated_cleaning_minutes INTEGER;
UPDATE airbnbs SET estimated_cleaning_minutes = 60 WHERE estimated_cleaning_minutes IS NULL;
ALTER TABLE airbnbs ALTER COLUMN estimated_cleaning_minutes SET DEFAULT 60;
ALTER TABLE airbnbs ALTER COLUMN estimated_cleaning_minutes SET NOT NULL;

-- ── MISSIONS : durée propre à la mission + snapshots de paie ────────
-- Les snapshots figent le calcul : si le taux du cleaner change demain,
-- les missions déjà terminées gardent leur gain.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS mission_duration_minutes INTEGER;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS cleaner_hourly_rate_snapshot NUMERIC;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS apartment_default_duration_snapshot INTEGER;

-- Backfill de la durée des missions existantes depuis hours_worked (heures → minutes).
-- cleaner_gain existant est conservé tel quel (historique figé, pas de recalcul).
UPDATE missions SET mission_duration_minutes = ROUND(COALESCE(hours_worked, 0) * 60)
  WHERE mission_duration_minutes IS NULL;
