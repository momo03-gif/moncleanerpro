-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Véhicule du livreur (plaque) pour le paiement du stationnement
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Toute session de stationnement (PayByPhone, etc.) est rattachée à une plaque
-- d'immatriculation. On la stocke sur le livreur (cleaner) ; elle est transmise au
-- fournisseur lors du paiement.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS license_plate TEXT;
