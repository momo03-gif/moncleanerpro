-- ══════════════════════════════════════════════════════════════════
-- MonCleanerPro — Migration « Facturation : infos société + historique »
-- À exécuter UNE FOIS dans Supabase > SQL Editor (idempotent)
-- ══════════════════════════════════════════════════════════════════

-- Informations légales de l'entreprise (ligne unique, affichées sur les factures)
CREATE TABLE IF NOT EXISTS company_info (
  id INT PRIMARY KEY DEFAULT 1,
  name TEXT,
  address TEXT,
  siret TEXT,
  vat TEXT,
  email TEXT,
  phone TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT company_info_single CHECK (id = 1)
);
INSERT INTO company_info (id, name) VALUES (1, 'MonCleanerPro') ON CONFLICT (id) DO NOTHING;
ALTER TABLE company_info DISABLE ROW LEVEL SECURITY;
GRANT ALL ON company_info TO anon, authenticated, service_role;

-- Historique des factures générées (snapshot des lignes au moment de l'émission)
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT,
  partner_label TEXT,
  partner_type TEXT,            -- 'hotel' | 'airbnb'
  period_from DATE,
  period_to DATE,
  total NUMERIC DEFAULT 0,
  lines JSONB DEFAULT '[]',     -- [{ date, label, type, amount }]
  status TEXT DEFAULT 'issued', -- 'issued' | 'sent' | 'paid'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
GRANT ALL ON invoices TO anon, authenticated, service_role;
