-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Module Devis + Grille tarifaire (LOT 8 / 8A / 8B)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent (IF NOT EXISTS).
-- Purement additif : ne touche pas à la facturation existante (table invoices).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1) GRILLE TARIFAIRE (LOT 8A) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tarifs (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nom_prestation TEXT NOT NULL,
  unite          TEXT NOT NULL DEFAULT 'forfait' CHECK (unite IN ('forfait', 'm2', 'heure', 'piece')),
  prix_unitaire  NUMERIC NOT NULL DEFAULT 0,
  actif          BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE tarifs DISABLE ROW LEVEL SECURITY;

-- Exemples par défaut (modifiables par l'admin). Anti-doublon par nom.
INSERT INTO tarifs (nom_prestation, unite, prix_unitaire)
SELECT v.nom, v.unite, v.prix
FROM (VALUES
  ('Ménage standard',                 'forfait', 80),
  ('Grand ménage / fin de bail',      'forfait', 180),
  ('Nettoyage vitres',                'forfait', 40),
  ('Nettoyage four',                  'forfait', 35),
  ('Supplément étage sans ascenseur', 'forfait', 15)
) AS v(nom, unite, prix)
WHERE NOT EXISTS (SELECT 1 FROM tarifs WHERE nom_prestation = v.nom);

-- ── 2) DEVIS (LOT 8) ──────────────────────────────────────────────────────────
-- lines : JSONB [{nom, quantite, prix_unitaire, total}] — même esprit que invoices.lines.
-- public_token : lien unique de consultation/acceptation côté client.
-- source : 'admin' (créé en interne) | 'public' (demande de devis en ligne, à valider).
CREATE TABLE IF NOT EXISTS devis (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  number         TEXT,
  partner_label  TEXT,
  partner_type   TEXT,
  client_name    TEXT,
  client_email   TEXT,
  client_address TEXT,
  description    TEXT,                          -- description en langage naturel (IA)
  lines          JSONB DEFAULT '[]',
  total          NUMERIC DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'brouillon'
                 CHECK (status IN ('brouillon', 'envoye', 'accepte', 'refuse')),
  valid_until    DATE,
  public_token   TEXT UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  source         TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin', 'public')),
  invoice_id     UUID REFERENCES invoices(id) ON DELETE SET NULL,  -- si converti en facture
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE devis DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_devis_token  ON devis(public_token);
CREATE INDEX IF NOT EXISTS idx_devis_status ON devis(status);
