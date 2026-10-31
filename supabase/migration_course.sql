-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Missions « Course / achat » (machine à café, sommier, double
-- de clé…). À exécuter dans Supabase > SQL Editor. Idempotent. Purement additif.
-- ⚠️ À EXÉCUTER AVANT LE DÉPLOIEMENT : créer une course écrit service = 'errand'.
--
-- L'ARGENT, en 3 morceaux (cf. src/lib/course.ts) :
--   • les ACHATS : refacturés au client au réel, sur justificatif — ce n'est pas
--     du chiffre d'affaires, c'est un remboursement (ligne à part sur la facture) ;
--   • les FRAIS DE SERVICE (déplacement compris) = missions.price : ce que
--     gagne la société ;
--   • le CLEANER : taux horaire × durée + une prime fixe par course.
-- Si le cleaner a avancé l'argent, c'est une note de frais, remboursée À PART de
-- sa paie (errand_reimbursed_at).
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_service_check;
ALTER TABLE missions ADD CONSTRAINT missions_service_check
  CHECK (service IN ('cleaning', 'delivery', 'cleaning_delivery', 'appointment', 'repair', 'errand'));

ALTER TABLE missions ADD COLUMN IF NOT EXISTS errand_details TEXT;              -- quoi acheter / faire
ALTER TABLE missions ADD COLUMN IF NOT EXISTS errand_budget NUMERIC;            -- maximum accepté par le client
ALTER TABLE missions ADD COLUMN IF NOT EXISTS errand_spent NUMERIC;             -- montant réel du ticket
ALTER TABLE missions ADD COLUMN IF NOT EXISTS errand_paid_by TEXT;              -- 'cleaner' ou 'company'
ALTER TABLE missions ADD COLUMN IF NOT EXISTS errand_bonus NUMERIC;             -- prime cleaner, figée à la création
ALTER TABLE missions ADD COLUMN IF NOT EXISTS errand_reimbursed_at TIMESTAMPTZ; -- note de frais remboursée
DO $$ BEGIN
  ALTER TABLE missions ADD CONSTRAINT missions_errand_paid_by_check
    CHECK (errand_paid_by IS NULL OR errand_paid_by IN ('cleaner', 'company'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Réglages par défaut (Statistiques > Rentabilité > Paramètres).
ALTER TABLE profit_config ADD COLUMN IF NOT EXISTS errand_fee_percent NUMERIC DEFAULT 15; -- % du budget
ALTER TABLE profit_config ADD COLUMN IF NOT EXISTS errand_fee_min NUMERIC DEFAULT 20;     -- minimum (€)
ALTER TABLE profit_config ADD COLUMN IF NOT EXISTS errand_bonus NUMERIC DEFAULT 0;        -- prime cleaner (€)
