-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Rentabilité (paramètres + coût produits par appartement)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Sert au calcul de la marge réelle par appartement :
--   marge = prix client − paie cleaner − coût livraison − produits − parking − essence estimée
-- Les paramètres globaux (coût produits, marge cible, carburant) sont éditables dans l'app.
-- ══════════════════════════════════════════════════════════════════════════════

-- Paramètres globaux de rentabilité — UNE seule ligne (id = 1).
CREATE TABLE IF NOT EXISTS profit_config (
  id                 INT PRIMARY KEY DEFAULT 1,
  product_cost_cents INT NOT NULL DEFAULT 50,        -- coût produits moyen par ménage (centimes)
  margin_target      NUMERIC NOT NULL DEFAULT 0.30,  -- marge cible (0.30 = 30 %)
  fuel_base_address  TEXT,                            -- adresse du dépôt / point de départ
  fuel_base_lat      DOUBLE PRECISION,
  fuel_base_lng      DOUBLE PRECISION,
  fuel_consumption   NUMERIC NOT NULL DEFAULT 7,     -- L / 100 km
  fuel_price         NUMERIC NOT NULL DEFAULT 1.90,  -- € / L
  fuel_route_factor  NUMERIC NOT NULL DEFAULT 1.4,   -- distance route ≈ vol d'oiseau × 1,4
  cdi_charge_rate    NUMERIC NOT NULL DEFAULT 0.45,  -- charges patronales sur un CDI (0.45 = +45 %)
  CONSTRAINT profit_config_singleton CHECK (id = 1)
);
INSERT INTO profit_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Override du coût produits pour un appartement spécifique (centimes). NULL = défaut global.
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS product_cost_cents INT;

-- Type de contrat du cleaner : auto-entrepreneur (coût = paie) ou CDI (coût = paie +
-- charges patronales). Défaut 'auto' (situation actuelle : tous auto-entrepreneurs).
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS employment_type TEXT NOT NULL DEFAULT 'auto'
  CHECK (employment_type IN ('auto', 'cdi'));
