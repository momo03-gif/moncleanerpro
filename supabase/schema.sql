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
  role TEXT CHECK (role IN ('admin', 'cleaner', 'hotel')) NOT NULL,
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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS missions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,
  client_name TEXT,
  client_id UUID REFERENCES users(id) ON DELETE SET NULL,
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

-- ── DÉSACTIVER RLS (prototype) ───────────────────
-- ⚠️  En production, configurer des policies RLS appropriées

ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE hotels DISABLE ROW LEVEL SECURITY;
ALTER TABLE cleaners DISABLE ROW LEVEL SECURITY;
ALTER TABLE airbnbs DISABLE ROW LEVEL SECURITY;
ALTER TABLE missions DISABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;

-- ── ACTIVER REALTIME ─────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE missions;
ALTER PUBLICATION supabase_realtime ADD TABLE hotel_requests;

-- ── SEED DATA ────────────────────────────────────
-- Mot de passe = SHA-256 du mot de passe en clair
-- admin123   → encode(digest('admin123','sha256'),'hex')
-- cleaner123 → encode(digest('cleaner123','sha256'),'hex')
-- hotel123   → encode(digest('hotel123','sha256'),'hex')

-- Admin
INSERT INTO users (email, password_hash, role, name, status) VALUES
  ('admin@moncleanerpro.com', encode(digest('admin123','sha256'),'hex'), 'admin', 'Admin MonCleaner', 'active')
ON CONFLICT (email) DO NOTHING;

-- Cleaners (users)
INSERT INTO users (email, password_hash, role, name, phone, status) VALUES
  ('sophie@cleaner.com', encode(digest('cleaner123','sha256'),'hex'), 'cleaner', 'Sophie Martin', '06 12 34 56 78', 'active'),
  ('lucas@cleaner.com',  encode(digest('cleaner123','sha256'),'hex'), 'cleaner', 'Lucas Bernard',  '06 98 76 54 32', 'active')
ON CONFLICT (email) DO NOTHING;

-- Hotels (users)
INSERT INTO users (email, password_hash, role, name, phone, status) VALUES
  ('contact@lumiere.com', encode(digest('hotel123','sha256'),'hex'), 'hotel', 'Hôtel Lumière',    '01 23 45 67 89', 'active'),
  ('contact@etoile.com',  encode(digest('hotel123','sha256'),'hex'), 'hotel', 'Résidence Étoile', '01 98 76 54 32', 'active')
ON CONFLICT (email) DO NOTHING;

-- Cleaners (profils)
INSERT INTO cleaners (user_id, name, email, phone, hourly_rate_hotel, rate_airbnb, status)
SELECT u.id, u.name, u.email, u.phone, 12, 18, 'active'
FROM users u WHERE u.email = 'sophie@cleaner.com'
ON CONFLICT DO NOTHING;

INSERT INTO cleaners (user_id, name, email, phone, hourly_rate_hotel, rate_airbnb, status)
SELECT u.id, u.name, u.email, u.phone, 10, 15, 'active'
FROM users u WHERE u.email = 'lucas@cleaner.com'
ON CONFLICT DO NOTHING;

-- Hotels (profils)
INSERT INTO hotels (user_id, hotel_name, address, phone, email, status_account)
SELECT u.id, u.name, '12 Avenue de la Lumière, Paris 75008', u.phone, u.email, 'approved'
FROM users u WHERE u.email = 'contact@lumiere.com'
ON CONFLICT DO NOTHING;

INSERT INTO hotels (user_id, hotel_name, address, phone, email, status_account)
SELECT u.id, u.name, '5 Rue des Étoiles, Paris 75016', u.phone, u.email, 'approved'
FROM users u WHERE u.email = 'contact@etoile.com'
ON CONFLICT DO NOTHING;

-- Airbnbs
INSERT INTO airbnbs (name, address, code_portail, code_boite, entry_instructions, cleaner_id)
SELECT 'Appartement Opéra', '12 Rue de la Paix, Paris 75001', '4512B', 'B#4512',
       'Clé boîte n°3 dans le couloir.', c.id
FROM cleaners c WHERE c.email = 'sophie@cleaner.com';

INSERT INTO airbnbs (name, address, code_portail, entry_instructions)
VALUES ('Suite Marais', '8 Place des Vosges, Paris 75003', 'A7834', 'Badge magnétique au gardien. Étage 3.');

INSERT INTO airbnbs (name, address, code_boite, entry_instructions)
VALUES ('Studio Montmartre', '3 Rue Lepic, Paris 75018', '2291', 'Boîte à clés sur la façade.');

INSERT INTO airbnbs (name, address, code_portail, entry_instructions, cleaner_id)
SELECT 'Penthouse République', '45 Place de la République, Paris 75010', 'R0099',
       'Interphone "Dupuis". Ascenseur dernier étage.', c.id
FROM cleaners c WHERE c.email = 'lucas@cleaner.com';

-- Missions (exemples)
INSERT INTO missions (type, client_name, cleaner_id, cleaner_name, property_name, address, source,
                      date_from, time_from, hours_worked, status, price, cleaner_gain)
SELECT 'checkout', 'Hôtel Lumière', c.id, c.name,
       'Appartement Opéra', '12 Rue de la Paix, Paris 75001', 'hotel',
       CURRENT_DATE, '10:00', 3, 'assigned', 120, 36
FROM cleaners c WHERE c.email = 'sophie@cleaner.com';

INSERT INTO missions (type, client_name, cleaner_id, cleaner_name, property_name, address, source,
                      date_from, time_from, hours_worked, status, price, cleaner_gain)
SELECT 'checkin', 'Hôtel Lumière', c.id, c.name,
       'Suite Marais', '8 Place des Vosges, Paris 75003', 'hotel',
       CURRENT_DATE, '14:00', 2, 'done', 80, 24
FROM cleaners c WHERE c.email = 'sophie@cleaner.com';

INSERT INTO missions (type, client_name, cleaner_id, cleaner_name, property_name, address, source,
                      date_from, time_from, hours_worked, status, price, cleaner_gain)
SELECT 'checkout', 'Résidence Étoile', c.id, c.name,
       'Suite Marais', '8 Place des Vosges, Paris 75003', 'airbnb',
       (CURRENT_DATE - INTERVAL '3 days')::DATE, '10:00', 3, 'done', 15, 15
FROM cleaners c WHERE c.email = 'lucas@cleaner.com';

-- Hotel requests (exemples)
INSERT INTO hotel_requests (hotel_id, hotel_name, type_prestation, date_from, date_to, time_from, time_to, persons, status)
SELECT h.id, h.hotel_name, 'menage', CURRENT_DATE + 1, CURRENT_DATE + 2, '09:00', '12:00', 3, 'pending'
FROM hotels h WHERE h.email = 'contact@lumiere.com';

INSERT INTO hotel_requests (hotel_id, hotel_name, type_prestation, date_from, date_to, time_from, time_to, persons, instructions, status)
SELECT h.id, h.hotel_name, 'grand_menage', CURRENT_DATE + 3, CURRENT_DATE + 3, '08:00', '13:00', 5,
       'Nettoyage fond après séjour longue durée.', 'pending'
FROM hotels h WHERE h.email = 'contact@etoile.com';
