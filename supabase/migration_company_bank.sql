-- ══════════════════════════════════════════════
-- MonCleanerPro — Coordonnées bancaires société (factures)
-- Ajoute IBAN / BIC affichés dans le bloc paiement des factures.
-- Exécuter dans Supabase > SQL Editor
-- ══════════════════════════════════════════════

ALTER TABLE company_info ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE company_info ADD COLUMN IF NOT EXISTS bic TEXT;
