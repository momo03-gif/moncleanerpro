-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Module RH : configuration + primes (LOT 1.B + 1bis)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. 100 % idempotent (IF NOT EXISTS
-- + ON CONFLICT DO NOTHING) : re-jouable sans écraser les réglages déjà modifiés.
--
-- Ce lot est PUREMENT ADDITIF : aucune table existante n'est modifiée, aucune
-- colonne renommée. Les statuts missions restent inchangés (anglais en base).
--
-- Confidentialité : RLS désactivée ici (cohérent avec tout le schéma actuel, qui
-- utilise la clé anon). Le durcissement RH (lecture admin uniquement, via routes
-- serveur en service_role) est traité dans le LOT 4 « Sécurité RH ».
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1) RH_CONFIG : réglages clé/valeur, chacun activable/désactivable ─────────
-- value = montant ou seuil ; enabled = interrupteur Activé/Désactivé de l'avantage.
CREATE TABLE IF NOT EXISTS rh_config (
  key        TEXT PRIMARY KEY,                 -- identifiant stable (jamais affiché brut)
  value      NUMERIC NOT NULL DEFAULT 0,       -- montant (€) ou seuil
  enabled    BOOLEAN NOT NULL DEFAULT true,    -- prime / avantage actif ?
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE rh_config DISABLE ROW LEVEL SECURITY;

-- Valeurs par défaut (LOT 1). ON CONFLICT DO NOTHING : ne réécrit JAMAIS une
-- valeur déjà présente → les modifications admin sont préservées au re-run.
INSERT INTO rh_config (key, value, enabled) VALUES
  ('prime_qualite',            30, true),   -- prime qualité (€)
  ('prime_performance',        60, true),   -- prime performance (€)
  ('seuil_perf_missions',      80, true),   -- missions/mois pour la prime performance
  ('anciennete_min_mois',       2, true),   -- ancienneté min. (mois) pour les avantages
  ('tcl_pourcentage',          50, true),   -- avantage TCL (% de réduction)
  ('internet_bonus',           10, true),   -- avantage Internet (€)
  ('minutes_trajet_paye',      15, true),   -- minutes de trajet payées entre 2 adresses
  ('seuil_incidents_priorite',  3, true)    -- incidents/mois avant priorité réduite
ON CONFLICT (key) DO NOTHING;

-- ── 2) PRIME_TYPES : primes extensibles (ajout sans coder) ────────────────────
-- Le moteur de paie (LOT 3) lira CETTE table dynamiquement : aucune prime en dur.
--   condition_type : missions_mois | zero_incident | anciennete | manuel
--   mode           : automatique (ajout direct) | validation_admin (passe par
--                    prime_requests : Accepter/Refuser avant ajout à la paie)
CREATE TABLE IF NOT EXISTS prime_types (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom             TEXT NOT NULL,
  montant         NUMERIC NOT NULL DEFAULT 0,
  condition_type  TEXT NOT NULL DEFAULT 'manuel',
  condition_valeur NUMERIC,                      -- ex : 80 (missions), 2 (mois)…
  mode            TEXT NOT NULL DEFAULT 'validation_admin'
                  CHECK (mode IN ('automatique', 'validation_admin')),
  actif           BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE prime_types DISABLE ROW LEVEL SECURITY;

-- Deux primes automatiques de base, alignées sur rh_config (qualité / performance).
-- Re-jouable sans doublon grâce au garde NOT EXISTS sur le nom.
INSERT INTO prime_types (nom, montant, condition_type, condition_valeur, mode, actif)
SELECT 'Prime qualité', 30, 'zero_incident', NULL, 'automatique', true
WHERE NOT EXISTS (SELECT 1 FROM prime_types WHERE nom = 'Prime qualité');

INSERT INTO prime_types (nom, montant, condition_type, condition_valeur, mode, actif)
SELECT 'Prime performance', 60, 'missions_mois', 80, 'automatique', true
WHERE NOT EXISTS (SELECT 1 FROM prime_types WHERE nom = 'Prime performance');

-- ── 3) PRIME_REQUESTS : primes à valider par l'admin (LOT 1bis B / LOT 3bis C) ─
-- Créée par le moteur quand une prime mode='validation_admin' devient éligible.
-- L'admin Accepte (→ ajoutée à la fiche de paie) ou Refuse (→ archivée).
CREATE TABLE IF NOT EXISTS prime_requests (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cleaner_id    UUID REFERENCES cleaners(id) ON DELETE CASCADE,
  prime_type_id UUID REFERENCES prime_types(id) ON DELETE SET NULL,
  type          TEXT,                            -- libellé figé (snapshot du nom)
  montant       NUMERIC NOT NULL DEFAULT 0,      -- montant figé au moment de la demande
  period        TEXT,                            -- mois concerné « YYYY-MM »
  statut        TEXT NOT NULL DEFAULT 'en_attente'
                CHECK (statut IN ('en_attente', 'acceptee', 'refusee')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);

ALTER TABLE prime_requests DISABLE ROW LEVEL SECURITY;

-- Une seule demande en attente par (cleaner, type de prime, mois) — anti-doublon
-- pour le moteur de calcul (LOT 3bis), qui peut tourner plusieurs fois.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prime_requests_unique_pending
  ON prime_requests (cleaner_id, prime_type_id, period)
  WHERE statut = 'en_attente';
