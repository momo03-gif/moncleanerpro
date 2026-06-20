-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Module Dépenses & TVA (assistant comptable)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent (IF NOT EXISTS).
-- Purement additif. ADMIN UNIQUEMENT.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1) DÉPENSES (avec TVA déductible + justificatif) ──────────────────────────
CREATE TABLE IF NOT EXISTS depenses (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  categorie       TEXT NOT NULL DEFAULT 'autre',
  fournisseur     TEXT,
  montant_ht      NUMERIC NOT NULL DEFAULT 0,
  tva_montant     NUMERIC NOT NULL DEFAULT 0,   -- TVA déductible de cette dépense
  montant_ttc     NUMERIC NOT NULL DEFAULT 0,
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  note            TEXT,
  justificatif_url TEXT,                         -- reçu (Supabase Storage)
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE depenses DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_depenses_date ON depenses(date);

-- ── 2) COFFRE À REÇUS (bucket Storage) ────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('receipts', 'receipts', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "receipts_read"   ON storage.objects;
DROP POLICY IF EXISTS "receipts_insert" ON storage.objects;
DROP POLICY IF EXISTS "receipts_delete" ON storage.objects;
CREATE POLICY "receipts_read"   ON storage.objects FOR SELECT USING (bucket_id = 'receipts');
CREATE POLICY "receipts_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "receipts_delete" ON storage.objects FOR DELETE USING (bucket_id = 'receipts');
