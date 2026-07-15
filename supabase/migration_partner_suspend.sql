-- ══════════════════════════════════════════════════════════════════
-- MonCleanerPro — Migration « Suspension de compte partenaire »
-- À exécuter UNE FOIS dans Supabase > SQL Editor
-- Idempotent : peut être relancé sans danger.
--
-- Ajoute le statut 'suspended' aux comptes partenaires (hôtels &
-- conciergeries Airbnb). Un compte suspendu ne peut plus se connecter
-- (gating dans /api/auth/login) mais n'est pas supprimé : l'admin peut
-- le réactiver depuis Admin > Comptes.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE hotels DROP CONSTRAINT IF EXISTS hotels_status_account_check;
ALTER TABLE hotels ADD CONSTRAINT hotels_status_account_check
  CHECK (status_account IN ('pending', 'approved', 'refused', 'suspended'));

ALTER TABLE airbnb_partners DROP CONSTRAINT IF EXISTS airbnb_partners_status_account_check;
ALTER TABLE airbnb_partners ADD CONSTRAINT airbnb_partners_status_account_check
  CHECK (status_account IN ('pending', 'approved', 'refused', 'suspended'));
