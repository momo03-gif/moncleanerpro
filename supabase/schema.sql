-- ══════════════════════════════════════════════
-- MonCleanerPro — Schéma Supabase
-- Exécuter dans Supabase > SQL Editor
-- ══════════════════════════════════════════════

-- Extension pour hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── TABLES ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK (role IN ('admin', 'cleaner', 'hotel', 'airbnb')) NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  status TEXT CHECK (status IN ('active', 'inactive', 'pending')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hotels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  hotel_name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  status_account TEXT CHECK (status_account IN ('pending', 'approved', 'refused')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partenaires Airbnb / conciergerie (avec compte)
CREATE TABLE IF NOT EXISTS airbnb_partners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  partner_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  status_account TEXT CHECK (status_account IN ('pending', 'approved', 'refused')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cleaners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  hourly_rate_hotel NUMERIC DEFAULT 0,
  rate_airbnb NUMERIC DEFAULT 0,
  status TEXT CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS airbnbs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  code_portail TEXT,
  code_boite TEXT,
  entry_instructions TEXT,
  cleaner_id UUID REFERENCES cleaners(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- propriétaire (compte airbnb), NULL si géré admin
  partner_name TEXT,                                        -- nom de la conciergerie / partenaire (libre, pour filtres)
  bedrooms INTEGER,
  beds INTEGER,
  sofa_beds INTEGER,                                        -- nombre de canapés-lits
  client_price NUMERIC,                                     -- prix facturé par ménage (repris sur les missions, comptabilité)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS missions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  client_name TEXT,
  client_id UUID REFERENCES users(id) ON DELETE SET NULL,
  partner_id UUID REFERENCES users(id) ON DELETE SET NULL,   -- partenaire airbnb (compte) ayant créé la mission
  airbnb_id UUID REFERENCES airbnbs(id) ON DELETE SET NULL,  -- appartement lié (source de vérité adresse + accès)
  cleaner_id UUID REFERENCES cleaners(id) ON DELETE SET NULL,
  cleaner_name TEXT,
  property_name TEXT,
  address TEXT,
  source TEXT CHECK (source IN ('hotel', 'airbnb')) DEFAULT 'hotel',
  date_from DATE,
  date_to DATE,
  time_from TIME,
  time_to TIME,
  persons INTEGER DEFAULT 1,
  instructions TEXT,
  status TEXT CHECK (status IN ('pending', 'assigned', 'inprogress', 'done', 'cancelled')) DEFAULT 'pending',
  price NUMERIC DEFAULT 0,
  cleaner_gain NUMERIC DEFAULT 0,
  hours_worked NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hotel_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
  hotel_name TEXT,
  type_prestation TEXT NOT NULL,
  date_from DATE,
  date_to DATE,
  time_from TIME,
  time_to TIME,
  persons INTEGER DEFAULT 1,
  instructions TEXT,
  cleaner_id UUID REFERENCES cleaners(id) ON DELETE SET NULL,
  cleaner_name TEXT,
  status TEXT CHECK (status IN ('pending', 'validated', 'refused')) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cleaner_id UUID REFERENCES cleaners(id) ON DELETE CASCADE,
  cleaner_name TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  period TEXT,
  status TEXT CHECK (status IN ('pending', 'paid')) DEFAULT 'paid',
  missions_ids TEXT[] DEFAULT '{}',
  paid_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Infos légales de l'entreprise (ligne unique) — affichées sur les factures
CREATE TABLE IF NOT EXISTS company_info (
  id INT PRIMARY KEY DEFAULT 1,
  name TEXT, address TEXT, siret TEXT, vat TEXT, email TEXT, phone TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT company_info_single CHECK (id = 1)
);

-- Historique des factures générées
CREATE TABLE IF NOT EXISTS invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  number TEXT,
  partner_label TEXT,
  partner_type TEXT,
  period_from DATE,
  period_to DATE,
  total NUMERIC DEFAULT 0,
  lines JSONB DEFAULT '[]',
  status TEXT DEFAULT 'issued',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── DÉSACTIVER RLS (prototype) ───────────────────
-- ⚠️  En production, configurer des policies RLS appropriées

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE hotels DISABLE ROW LEVEL SECURITY;
ALTER TABLE airbnb_partners DISABLE ROW LEVEL SECURITY;
ALTER TABLE cleaners DISABLE ROW LEVEL SECURITY;
ALTER TABLE airbnbs DISABLE ROW LEVEL SECURITY;
ALTER TABLE missions DISABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_info DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;

-- ── ACTIVER REALTIME ─────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE missions;
ALTER PUBLICATION supabase_realtime ADD TABLE hotel_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE airbnb_partners;

-- ── SEED DATA ────────────────────────────────────
-- Aucune donnée fictive : l'application utilise uniquement les comptes
-- et données réellement créés. Seul le compte admin est initialisé.
-- Mot de passe = SHA-256 du mot de passe en clair
-- admin123 → encode(digest('admin123','sha256'),'hex')

-- Admin
INSERT INTO users (email, password_hash, role, name, status) VALUES
  ('admin@moncleanerpro.com', encode(digest('admin123','sha256'),'hex'), 'admin', 'Admin MonCleaner', 'active')
ON CONFLICT (email) DO NOTHING;
