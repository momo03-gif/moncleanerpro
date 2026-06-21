-- ══════════════════════════════════════════════════════════════════
-- MonCleanerPro — Migration « Taux horaire facturé par hôtel »
-- À exécuter UNE FOIS dans Supabase > SQL Editor (idempotent).
--
-- Les hôtels sont facturés À L'HEURE, à un taux PROPRE À CHAQUE HÔTEL
-- (ex. 25 €/h à l'hôtel 1, 30 €/h à l'hôtel 2). L'admin règle ce taux sur
-- le profil de l'hôtel. Le prix d'une mission hôtel = taux × heures réalisées,
-- ce qui fait remonter le CA hôtel dans Stats, Comptabilité et Facturation.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE hotels ADD COLUMN IF NOT EXISTS billing_hourly_rate NUMERIC DEFAULT 0;
UPDATE hotels SET billing_hourly_rate = 0 WHERE billing_hourly_rate IS NULL;
