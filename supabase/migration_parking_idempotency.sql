-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Parking : jeton d'idempotence (mode hors-ligne)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent.
--
-- Contexte : en hors-ligne, un paiement de parking est mis en file puis rejoué à la
-- reconnexion. Si l'accusé serveur du 1er envoi est perdu, la file rejoue l'action →
-- risque de DOUBLON. Le client génère un `client_token` unique par paiement ; la
-- contrainte UNIQUE ci-dessous garantit qu'un rejeu ne crée jamais une 2e ligne
-- (createParkingPaymentDB renvoie alors la ligne existante = no-op).
--
-- NULL autorisé et NON dédupliqué : les anciens paiements (sans jeton) et les rares
-- paiements sans jeton restent valides ; l'index UNIQUE partiel n'agit que sur les
-- valeurs non nulles.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE parking_payments
  ADD COLUMN IF NOT EXISTS client_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_parking_payments_client_token
  ON parking_payments (client_token)
  WHERE client_token IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :  \d parking_payments   -- la colonne client_token + l'index doivent apparaître
-- ══════════════════════════════════════════════════════════════════════════════
