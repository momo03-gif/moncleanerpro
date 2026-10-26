-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Connexion par numéro de téléphone (comptes prestataires).
-- À exécuter dans Supabase > SQL Editor. Idempotent.
-- ⚠️ À EXÉCUTER AVANT LE DÉPLOIEMENT : l'inscription prestataire écrit login_phone.
-- ══════════════════════════════════════════════════════════════════════════════

-- Un prestataire se connecte avec son téléphone + un mot de passe (son email
-- reste demandé, pour le contact et les documents).
-- Identifiant téléphone NORMALISÉ (chiffres, indicatif inclus : 33612345678,
-- cf. normalizePhone dans src/lib/phone.ts) : « 06 12… » et « +33 6 12… » sont
-- le même compte. Unique : un numéro = un seul compte.
ALTER TABLE users ADD COLUMN IF NOT EXISTS login_phone TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_login_phone_key ON users (login_phone) WHERE login_phone IS NOT NULL;

-- Jamais lisible depuis le navigateur : la connexion se fait côté serveur.
REVOKE ALL (login_phone) ON users FROM anon, authenticated;
