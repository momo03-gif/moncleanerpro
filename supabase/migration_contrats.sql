-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Contrats de prestation et acceptation en ligne
-- À exécuter dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- CE QUE C'EST : les conditions PARTICULIÈRES d'un client — qui il est, quels
-- logements, à quels prix, depuis quand. Le socle juridique commun reste dans
-- les CGV, auxquelles le contrat renvoie (cf. src/lib/contrat.ts).
--
-- POURQUOI ON FIGE LE TEXTE : un contrat accepté doit rester lisible tel qu'il
-- a été accepté. Si on le regénérait depuis les données actuelles, une hausse de
-- prix réécrirait rétroactivement ce que le client a signé. On stocke donc le
-- document rendu, et une nouvelle version = une nouvelle ligne.
--
-- L'ACCEPTATION : pas de signature manuscrite, pas de prestataire tiers. Un clic
-- authentifié, horodaté, avec la trace de qui et d'où — c'est ce qu'admet la
-- jurisprudence pour un contrat entre professionnels, et c'est vérifiable.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS contrats (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version      INTEGER NOT NULL DEFAULT 1,       -- 1, 2, 3… ; un avenant incrémente
  reference    TEXT NOT NULL,                    -- CTR-2026-0001
  date_effet   DATE NOT NULL,

  -- Le document tel qu'il est proposé, figé. `articles` porte le texte rendu,
  -- `donnees` les valeurs qui ont servi à le produire (utile pour un avenant).
  articles     JSONB NOT NULL DEFAULT '[]',
  donnees      JSONB NOT NULL DEFAULT '{}',

  statut       TEXT NOT NULL DEFAULT 'propose'
               CHECK (statut IN ('brouillon', 'propose', 'accepte', 'remplace', 'resilie')),

  -- La trace de l'acceptation.
  accepte_le   TIMESTAMPTZ,
  accepte_par  TEXT,          -- nom de la personne qui a cliqué (snapshot)
  accepte_ip   TEXT,          -- adresse IP, pour la valeur probante
  accepte_ua   TEXT,          -- navigateur

  resilie_le   TIMESTAMPTZ,
  resilie_note TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   TEXT
);

CREATE INDEX IF NOT EXISTS idx_contrats_client ON contrats(client_id, version DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contrats_reference ON contrats(reference, version);

-- ── Droits : rien depuis le navigateur ───────────────────────────────────────
-- Un contrat s'écrit côté serveur, et se lit par la route qui vérifie que le
-- demandeur en est bien le destinataire. Même schéma que les devis.
REVOKE ALL ON contrats FROM anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select count(*) from contrats;   -- attendu : 0
-- Avec la CLÉ PUBLIQUE : select sur `contrats` doit être REFUSÉ (42501).
-- ══════════════════════════════════════════════════════════════════════════════
