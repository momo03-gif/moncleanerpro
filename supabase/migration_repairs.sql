-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Réparations rattachées à un site (appartement)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Principe : un dégât constaté sur place (par le cleaner en fin de mission, ou
-- saisi par l'admin) devient une RÉPARATION rattachée à l'APPARTEMENT — pas à la
-- mission. Elle reste ouverte, visible dans l'onglet « Réparations » du partenaire,
-- tant que le propriétaire (ou l'admin) ne l'a pas marquée réparée. La mission
-- d'origine n'est qu'une trace (mission_id), sa clôture ne ferme pas la réparation.
--
-- Donnée opérationnelle (comme missions / mission_reports / airbnbs) → pas de RLS :
-- l'accès est filtré applicativement par airbnb_id / partner_id.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS repairs (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  airbnb_id     UUID NOT NULL REFERENCES airbnbs(id) ON DELETE CASCADE,  -- le site concerné
  partner_id    UUID REFERENCES users(id) ON DELETE SET NULL,            -- compte propriétaire (snapshot du site)
  mission_id    UUID REFERENCES missions(id) ON DELETE SET NULL,         -- mission d'origine (trace)
  description   TEXT NOT NULL,                                           -- ce qui est à réparer
  status        TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  created_by    TEXT,                                                    -- nom de l'auteur (snapshot)
  created_role  TEXT CHECK (created_role IN ('cleaner', 'admin', 'airbnb')),
  resolved_by   TEXT,                                                    -- qui a confirmé la réparation
  resolved_note TEXT,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repairs_airbnb  ON repairs(airbnb_id);
CREATE INDEX IF NOT EXISTS idx_repairs_partner ON repairs(partner_id);
CREATE INDEX IF NOT EXISTS idx_repairs_status  ON repairs(status, created_at DESC);

ALTER TABLE repairs DISABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :  select count(*) from repairs;  -- attendu : 0 (table vide, créée)
-- ══════════════════════════════════════════════════════════════════════════════
