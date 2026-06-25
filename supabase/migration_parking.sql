-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Module Livraison : paiements de stationnement (parking)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent.
--
-- Principe : un livreur (cleaner avec can_deliver) paie le stationnement pendant
-- une mission de livraison. Aujourd'hui la saisie est MANUELLE (provider 'manual') ;
-- l'architecture est prête pour brancher une API (ex. PayByPhone) plus tard, sans
-- changer ce schéma (colonnes provider / provider_ref / metadata déjà prévues).
--
-- Donnée financière → table VERROUILLÉE comme depenses/rh : RLS active, aucune
-- policy pour le rôle anon → lecture/écriture exclusivement via routes serveur en
-- service_role (qui contourne la RLS). Cf. migration_rh_security.sql.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS parking_payments (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id       UUID REFERENCES missions(id)  ON DELETE SET NULL,
  cleaner_id       UUID REFERENCES cleaners(id)  ON DELETE SET NULL,
  cleaner_name     TEXT,                                   -- snapshot (livreur)
  address          TEXT NOT NULL,                          -- snapshot adresse mission
  latitude         DOUBLE PRECISION,                       -- snapshot (si géolocalisé)
  longitude        DOUBLE PRECISION,
  amount           NUMERIC(10,2),                          -- montant payé (€)
  currency         TEXT NOT NULL DEFAULT 'EUR',
  duration_minutes INT,                                    -- durée de stationnement payée (facultatif)
  status           TEXT NOT NULL DEFAULT 'paid'
                     CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  provider         TEXT NOT NULL DEFAULT 'manual',         -- futur : 'paybyphone'
  provider_ref     TEXT,                                   -- id de transaction externe (futur)
  metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,     -- payload fournisseur (future-proof)
  paid_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_parking_payments_mission ON parking_payments(mission_id);
CREATE INDEX IF NOT EXISTS idx_parking_payments_paid_at ON parking_payments(paid_at DESC);

-- Verrouillage : RLS active, AUCUNE policy anon → la clé publique lit/écrit 0 ligne.
-- service_role (routes serveur /api/parking) contourne la RLS.
ALTER TABLE parking_payments ENABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION (client clé ANON) :  select count(*) from parking_payments;  -- attendu : 0
-- Via route serveur service_role : les lignes réelles s'affichent.
-- ══════════════════════════════════════════════════════════════════════════════
