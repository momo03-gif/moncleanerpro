-- ══════════════════════════════════════════════════════════════════
-- MonCleanerPro — Migration « Partenaires Airbnb / Conciergerie »
-- À exécuter UNE FOIS dans Supabase > SQL Editor
-- Idempotent : peut être relancé sans danger.
-- ══════════════════════════════════════════════════════════════════

-- 1) Autoriser le rôle « airbnb » sur les utilisateurs ───────────────
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'cleaner', 'hotel', 'airbnb'));

-- 2) Table des partenaires Airbnb / conciergerie (avec compte) ───────
CREATE TABLE IF NOT EXISTS airbnb_partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  partner_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  status_account TEXT CHECK (status_account IN ('pending', 'approved', 'refused')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE airbnb_partners DISABLE ROW LEVEL SECURITY;
GRANT ALL ON airbnb_partners TO anon, authenticated, service_role;

-- 3) Appartements : propriétaire (compte) + nom de partenaire (libre)
--    + champs descriptifs optionnels ───────────────────────────────
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS partner_id   UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS partner_name TEXT;
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS bedrooms     INTEGER;
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS beds         INTEGER;
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS notes        TEXT;

-- 4) Missions : lien partenaire + lien appartement (source de vérité)
ALTER TABLE missions ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES users(id)    ON DELETE SET NULL;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS airbnb_id  UUID REFERENCES airbnbs(id)  ON DELETE SET NULL;

-- 5) Rattacher les appartements existants (sans propriétaire) à la
--    conciergerie « Hosting Services Lyon » (gérée côté admin) ──────
UPDATE airbnbs
   SET partner_name = 'Hosting Services Lyon'
 WHERE partner_id IS NULL
   AND (partner_name IS NULL OR partner_name = '');

-- 6) Nettoyage des données fictives de démonstration ─────────────────
--    (on conserve l'admin, le cleaner Ismo bamba et les vrais apparts)

-- Missions des hôtels fictifs
DELETE FROM missions
 WHERE client_name IN ('Hôtel Lumière', 'Résidence Étoile')
    OR property_name IN ('Hôtel Lumière', 'Résidence Étoile');

-- Hôtels fictifs (supprime en cascade leurs hotel_requests)
DELETE FROM users
 WHERE email IN ('contact@lumiere.com', 'contact@etoile.com');

-- Anciens cleaners de démonstration (s'ils existent encore)
DELETE FROM users
 WHERE email IN ('sophie@cleaner.com', 'lucas@cleaner.com');

-- 7) Realtime sur la table partenaires (optionnel) ───────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE airbnb_partners;
EXCEPTION WHEN OTHERS THEN NULL;  -- déjà présente : on ignore
END $$;
