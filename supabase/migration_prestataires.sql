-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Espace PRESTATAIRE (sous-traitants).
-- À exécuter dans Supabase > SQL Editor. Idempotent.
--
-- ⚠️ À EXÉCUTER AVANT LE DÉPLOIEMENT DU CODE QUI L'ACCOMPAGNE : le code lit les
-- nouvelles colonnes (cleaners.prestataire_id, missions.prestataire_*).
--
-- LE MODÈLE
--   · Un prestataire est une entreprise extérieure : un compte `users` de rôle
--     'prestataire' + une fiche `prestataires` (raison sociale, taux horaire).
--   · Ses AGENTS sont des comptes cleaner ordinaires (même application terrain :
--     démarrer, photos « après », rapport, GPS), rattachés par
--     cleaners.prestataire_id. Ils ne font PAS partie de l'équipe : ni RH, ni
--     paie, ni missions proposées, ni classement.
--   · L'admin confie une mission au prestataire (missions.prestataire_id) ; le
--     prestataire la donne à l'un de ses agents (missions.cleaner_id).
--   · Ce qu'on doit au prestataire = son taux horaire × durée de la mission,
--     figé au moment où on la lui confie (prestataire_rate_snapshot /
--     prestataire_gain). cleaner_gain reste à 0 : on ne paie pas ses agents.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Le rôle ──────────────────────────────────────────────────────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'cleaner', 'hotel', 'airbnb', 'prestataire'));

-- ── 2. La fiche prestataire ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prestataires (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,              -- raison sociale
  contact_name  TEXT,
  email         TEXT,
  phone         TEXT,
  siret         TEXT,
  hourly_rate   NUMERIC NOT NULL DEFAULT 0, -- ce qu'on lui paie de l'heure
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rien depuis un navigateur : tout passe par /api/prestataire (service_role).
ALTER TABLE prestataires ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON prestataires FROM anon, authenticated;

-- ── 3. Les agents ───────────────────────────────────────────────────────────
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS prestataire_id UUID
  REFERENCES prestataires(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS cleaners_prestataire_idx ON cleaners(prestataire_id);

-- ── 4. Les missions confiées ────────────────────────────────────────────────
ALTER TABLE missions ADD COLUMN IF NOT EXISTS prestataire_id UUID
  REFERENCES prestataires(id) ON DELETE SET NULL;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS prestataire_name TEXT;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS prestataire_rate_snapshot NUMERIC;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS prestataire_gain NUMERIC;
CREATE INDEX IF NOT EXISTS missions_prestataire_idx ON missions(prestataire_id);

-- Les colonnes ajoutées à une table dont les droits sont donnés colonne par
-- colonne ne sont lisibles par personne tant qu'on ne les donne pas : c'est
-- voulu, le montant dû au prestataire ne sort que par le serveur.

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION
--   select column_name from information_schema.columns
--    where table_name = 'missions' and column_name like 'prestataire%';  -- 4 lignes
--   select column_name from information_schema.columns
--    where table_name = 'cleaners' and column_name = 'prestataire_id';    -- 1 ligne
--   select * from prestataires;                                          -- table vide
-- ══════════════════════════════════════════════════════════════════════════════
