-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Alertes WhatsApp (dégâts signalés)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Principe : un dégât constaté dans un logement doit SORTIR de l'application.
-- La notification in-app et le push web supposent que la conciergerie ouvre
-- l'app ; WhatsApp, elle le lit. On n'envoie que sur consentement explicite
-- (`whatsapp_enabled`), et uniquement des messages utilitaires — jamais de
-- promotion : c'est la règle de Meta autant que la nôtre.
--
-- Le numéro est stocké au format international sans espaces (+33612345678).
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_phone   TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select count(*) from users where whatsapp_enabled;  -- attendu : 0
-- ══════════════════════════════════════════════════════════════════════════════
