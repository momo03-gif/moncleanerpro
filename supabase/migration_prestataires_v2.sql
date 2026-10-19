-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Prestataires, v2 : crédit d'impôt, paiements, vigilance.
-- À exécuter dans Supabase > SQL Editor. Idempotent.
-- ⚠️ À EXÉCUTER AVANT LE DÉPLOIEMENT DU CODE QUI L'ACCOMPAGNE (la liste des
-- logements lit la nouvelle colonne airbnbs.credit_impot).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Crédit d'impôt : on ne confie pas le domicile d'un particulier à
--       n'importe qui ─────────────────────────────────────────────────────────
-- Un logement coché « domicile d'un particulier (crédit d'impôt) » ne peut être
-- confié qu'à un prestataire lui-même déclaré services à la personne : sinon le
-- client risque de perdre son crédit d'impôt.
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS credit_impot BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE prestataires ADD COLUMN IF NOT EXISTS sap_declare BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Paiements : le relevé d'un mois marqué « payé » ──────────────────────
CREATE TABLE IF NOT EXISTS prestataire_paiements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestataire_id  UUID NOT NULL REFERENCES prestataires(id) ON DELETE CASCADE,
  periode         TEXT NOT NULL CHECK (periode ~ '^\d{4}-\d{2}$'),   -- 'YYYY-MM'
  montant         NUMERIC NOT NULL,                                 -- ce qui a été versé
  paid_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  note            TEXT,
  UNIQUE (prestataire_id, periode)
);
ALTER TABLE prestataire_paiements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON prestataire_paiements FROM anon, authenticated;

-- ── 3. Vigilance : Kbis, attestation URSSAF, assurance ──────────────────────
-- Au-delà de 5 000 € par an avec un même prestataire, le donneur d'ordre doit
-- obtenir son attestation de vigilance URSSAF tous les 6 mois (et son Kbis).
CREATE TABLE IF NOT EXISTS prestataire_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prestataire_id  UUID NOT NULL REFERENCES prestataires(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL CHECK (kind IN ('urssaf', 'kbis', 'assurance', 'autre')),
  storage_path    TEXT NOT NULL,
  file_name       TEXT,
  delivered_on    DATE,            -- date de délivrance inscrite sur le document
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS prestataire_documents_idx ON prestataire_documents(prestataire_id);
ALTER TABLE prestataire_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON prestataire_documents FROM anon, authenticated;

-- Réserve de fichiers PRIVÉE : on ne lit un document que par un lien signé
-- délivré par le serveur (admin, ou le prestataire pour les siens).
INSERT INTO storage.buckets (id, name, public)
VALUES ('prestataire_docs', 'prestataire_docs', false)
ON CONFLICT (id) DO NOTHING;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION
--   select credit_impot from airbnbs limit 1;            -- false
--   select sap_declare from prestataires limit 1;        -- false (ou aucune ligne)
--   select * from prestataire_paiements;                 -- vide
--   select * from prestataire_documents;                 -- vide
--   select id, public from storage.buckets where id = 'prestataire_docs';  -- 1 ligne, public = false
-- ══════════════════════════════════════════════════════════════════════════════
