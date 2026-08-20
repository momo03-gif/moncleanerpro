-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Suivi des prospects et des relances
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Le problème résolu : une demande de devis arrive, elle reste en brouillon, et
-- rien ne rappelle de relancer. Les devis en base le montrent — plusieurs
-- demandes de plus de deux semaines, jamais reprises.
--
-- Une fiche prospect existe PAR ELLE-MÊME, avec un lien FACULTATIF vers un
-- devis : sinon on ne pourrait pas saisir à la main la conciergerie croisée à un
-- salon. Deux origines donc :
--   · 'devis'  → créée automatiquement depuis une demande du site
--   · 'manuel' → saisie par l'équipe
--
-- ⚠️ DONNÉES PERSONNELLES (noms, emails, téléphones de gens qui ne sont pas
-- encore clients). RLS activée SANS aucune policy : la clé publique ne peut ni
-- lire ni écrire. Tout passe par /api/admin/prospects, qui vérifie la session.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prospects (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom         TEXT NOT NULL,
  entreprise  TEXT,
  email       TEXT,
  telephone   TEXT,
  -- Nature de la demande : sert à filtrer et à savoir qui rappeler en priorité.
  nature      TEXT NOT NULL DEFAULT 'autre'
              CHECK (nature IN ('hotellerie','ehpad','conciergerie','particulier','chantier','bureaux','autre')),
  -- Mêmes états que les devis, pour ne pas entretenir deux vocabulaires.
  statut      TEXT NOT NULL DEFAULT 'attente'
              CHECK (statut IN ('attente','envoye','accepte','refuse')),
  montant     NUMERIC,                       -- devis estimé, facultatif
  relance     DATE,                          -- prochaine relance : le cœur de l'outil
  notes       TEXT,
  -- Devis d'origine. UNIQUE : un devis ne crée qu'une fiche, même si la
  -- synchronisation repasse. ON DELETE SET NULL : supprimer un devis ne doit pas
  -- effacer le suivi commercial qui va avec.
  devis_id    UUID UNIQUE REFERENCES devis(id) ON DELETE SET NULL,
  source      TEXT NOT NULL DEFAULT 'manuel' CHECK (source IN ('devis','manuel')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Le tri par défaut de l'écran : les relances en retard d'abord.
CREATE INDEX IF NOT EXISTS idx_prospects_relance ON prospects(relance)
  WHERE statut IN ('attente','envoye');
CREATE INDEX IF NOT EXISTS idx_prospects_statut ON prospects(statut, created_at DESC);

-- Aucune policy = personne n'y accède avec la clé publique. Voulu : ce sont des
-- données personnelles de gens qui ne sont pas encore clients.
ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select count(*) from prospects;  -- attendu : 0 (les fiches se créeront
--                                    -- automatiquement depuis les devis
--                                    -- existants à la première ouverture)
-- ══════════════════════════════════════════════════════════════════════════════
