-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Simulateur de devis Airbnb, piloté depuis l'admin
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Le visiteur configure son logement (surface, voyageurs, salles de bain, zone,
-- options, délai) et voit son estimation se construire ligne par ligne. TOUT ce
-- qui pilote ce calcul vit en base et s'édite depuis l'admin : aucun tarif en
-- dur dans le code, sinon la grille du site diverge de la vraie à la première
-- hausse de prix.
--
-- ⚠️ NE PAS CONFONDRE avec les « zones » existantes (airbnbs.zone_id/zone_color) :
-- celles-là sont des regroupements GÉOGRAPHIQUES calculés automatiquement au GPS
-- pour organiser les tournées des cleaners. Ici il s'agit de zones TARIFAIRES,
-- définies à la main par commune, qui n'ont pas le même découpage ni le même but.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Zones tarifaires : quelles communes, quel supplément ──────────────────────
CREATE TABLE IF NOT EXISTS devis_zones (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,                      -- « Lyon intramuros »
  fee        NUMERIC NOT NULL DEFAULT 0,         -- supplément par intervention (€)
  communes   TEXT[] NOT NULL DEFAULT '{}',       -- communes couvertes, éditables une à une
  color      TEXT,                               -- pastille de la zone (charte du site)
  position   INTEGER NOT NULL DEFAULT 0,         -- ordre d'affichage
  active     BOOLEAN NOT NULL DEFAULT TRUE,      -- retirer une zone sans perdre son contenu
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_devis_zones_pos ON devis_zones(position) WHERE active;
-- Lecture publique (le simulateur est une page publique), écriture RÉSERVÉE au
-- serveur : ces tables fixent les prix, la clé publique ne doit pas pouvoir les
-- modifier. L'admin passe par /api/admin/devis-config (service_role).
ALTER TABLE devis_zones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS devis_zones_read ON devis_zones;
CREATE POLICY devis_zones_read ON devis_zones FOR SELECT USING (true);

-- ── Paliers de surface : le prix de base du ménage ────────────────────────────
CREATE TABLE IF NOT EXISTS devis_surface_tiers (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  max_m2     INTEGER NOT NULL,                   -- palier appliqué jusqu'à cette surface
  label      TEXT NOT NULL,                      -- « T2 », « Studio XL / T1 »
  cap_text   TEXT,                               -- capacité indicative affichée
  base_price NUMERIC,                            -- NULL = au-delà de la grille → sur devis
  active     BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_devis_tiers_max ON devis_surface_tiers(max_m2) WHERE active;
ALTER TABLE devis_surface_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS devis_surface_tiers_read ON devis_surface_tiers;
CREATE POLICY devis_surface_tiers_read ON devis_surface_tiers FOR SELECT USING (true);

-- ── Options : linge, consommables, vitres, terrasse… ──────────────────────────
-- `per_capacity` = le prix dépend du nombre de voyageurs (paliers dans `tiers`),
-- sinon `fee` est un forfait.
CREATE TABLE IF NOT EXISTS devis_options (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key          TEXT NOT NULL UNIQUE,             -- identifiant stable (linen, windows…)
  label        TEXT NOT NULL,
  fee          NUMERIC NOT NULL DEFAULT 0,       -- forfait, si non indexé sur la capacité
  per_capacity BOOLEAN NOT NULL DEFAULT FALSE,
  tiers        JSONB,                            -- [{max:2,fee:12},…] si per_capacity
  default_on   BOOLEAN NOT NULL DEFAULT FALSE,   -- coché d'avance dans le simulateur
  position     INTEGER NOT NULL DEFAULT 0,
  active       BOOLEAN NOT NULL DEFAULT TRUE
);
ALTER TABLE devis_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS devis_options_read ON devis_options;
CREATE POLICY devis_options_read ON devis_options FOR SELECT USING (true);

-- ── Le reste du barème, en une ligne unique ───────────────────────────────────
-- Capacité, salles de bain et délais : peu de valeurs, modifiées rarement, mais
-- éditables quand même. Une seule ligne (id = 1), comme profit_config.
CREATE TABLE IF NOT EXISTS devis_settings (
  id                 INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  capacity_surcharge JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{max:2,fee:0},{max:4,fee:5},…]
  bathroom_surcharge JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{from:2,fee:10},…]
  urgency            JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{id,label,meta,fee},…]
  min_m2             INTEGER NOT NULL DEFAULT 12,
  max_m2             INTEGER NOT NULL DEFAULT 230,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE devis_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS devis_settings_read ON devis_settings;
CREATE POLICY devis_settings_read ON devis_settings FOR SELECT USING (true);

-- ══════════════════════════════════════════════════════════════════════════════
--  VALEURS DE DÉPART — le simulateur fonctionne dès l'exécution de ce script.
--  Tout est modifiable ensuite depuis l'admin ; rien n'est réécrit si les
--  tables contiennent déjà des données (ON CONFLICT / WHERE NOT EXISTS).
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO devis_settings (id, capacity_surcharge, bathroom_surcharge, urgency)
VALUES (1,
  '[{"max":2,"fee":0},{"max":4,"fee":5},{"max":6,"fee":10},{"max":8,"fee":15},{"max":10,"fee":20},{"max":12,"fee":25}]',
  '[{"from":2,"fee":10},{"from":3,"fee":20},{"from":4,"fee":30},{"from":5,"fee":40},{"from":6,"fee":50}]',
  '[{"id":"standard","label":"Standard","meta":"48 h et +","fee":0},{"id":"h24","label":"Sous 24 h","meta":"","fee":15},{"id":"h12","label":"Sous 12 h","meta":"","fee":25},{"id":"h6","label":"Sous 6 h","meta":"","fee":35}]'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO devis_surface_tiers (max_m2, label, cap_text, base_price)
SELECT * FROM (VALUES
  (20,  'Studio XS',            '1–2 pers.',   45),
  (30,  'Studio',               '1–2 pers.',   50),
  (35,  'Studio XL / T1',       '1–2 pers.',   55),
  (45,  'T2',                   '2–4 pers.',   62),
  (55,  'T2 XL',                '2–4 pers.',   68),
  (60,  'Grand T2 / petit T3',  '4 pers.',     75),
  (70,  'T3',                   '4–6 pers.',   82),
  (80,  'T3 XL',                '4–6 pers.',   92),
  (90,  'Grand T3 / petit T4',  '6 pers.',    100),
  (100, 'T4',                   '6–8 pers.',  112),
  (110, 'T4 XL',                '6–8 pers.',  122),
  (120, 'Grand T4 / T5',        '8 pers.',    132),
  (140, 'T5',                   '8–10 pers.', 148),
  (160, 'T5 XL',                '8–12 pers.', 168),
  (180, 'Grand appartement',   '10–12 pers.', 192),
  (220, 'Appartement XXL',     '12–14 pers.', 225)
) AS v(max_m2, label, cap_text, base_price)
WHERE NOT EXISTS (SELECT 1 FROM devis_surface_tiers);

INSERT INTO devis_options (key, label, fee, per_capacity, tiers, default_on, position)
SELECT * FROM (VALUES
  ('linen',       'Linge fourni & lavé', 0::numeric,  TRUE,
   '[{"max":2,"fee":12},{"max":4,"fee":20},{"max":6,"fee":28},{"max":8,"fee":36},{"max":10,"fee":45},{"max":12,"fee":55}]'::jsonb, TRUE,  0),
  ('consumables', 'Kit consommables',    0::numeric,  TRUE,
   '[{"max":2,"fee":5},{"max":4,"fee":7},{"max":6,"fee":9},{"max":8,"fee":12},{"max":10,"fee":15},{"max":12,"fee":20}]'::jsonb,    TRUE,  1),
  ('windows',     'Vitres accessibles',  25::numeric, FALSE, NULL::jsonb, FALSE, 2),
  ('terrace',     'Terrasse / balcon',   12::numeric, FALSE, NULL::jsonb, FALSE, 3)
) AS v(key, label, fee, per_capacity, tiers, default_on, position)
WHERE NOT EXISTS (SELECT 1 FROM devis_options);

INSERT INTO devis_zones (name, fee, communes, color, position)
SELECT * FROM (VALUES
  ('Lyon intramuros',   0::numeric,  ARRAY['Lyon 1er','Lyon 2e','Lyon 3e','Lyon 4e','Lyon 5e','Lyon 6e','Lyon 7e','Lyon 8e','Lyon 9e'], '#8A6A1E', 0),
  ('Proche périphérie', 5::numeric,  ARRAY['Villeurbanne','Caluire-et-Cuire','Oullins-Pierre-Bénite','Sainte-Foy-lès-Lyon','Tassin-la-Demi-Lune','Écully','Champagne-au-Mont-d''Or','Saint-Fons','Bron','Vénissieux'], '#C9A84C', 1),
  ('Métropole éloignée', 10::numeric, ARRAY['Décines-Charpieu','Meyzieu','Jonage','Chassieu','Dardilly','Francheville','Corbas','Genas','Rillieux-la-Pape','Saint-Priest'], '#4A7A5A', 2),
  ('Rhône (25–40 km)',  15::numeric, ARRAY['Reste du Rhône, 25 à 40 km de Lyon'], '#7A7068', 3),
  ('40 à 60 km',        25::numeric, ARRAY['40 à 60 km de Lyon — au-delà : sur devis'], '#A84A40', 4)
) AS v(name, fee, communes, color, position)
WHERE NOT EXISTS (SELECT 1 FROM devis_zones);

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select count(*) from devis_zones;           -- attendu : 5
--   select count(*) from devis_surface_tiers;   -- attendu : 16
--   select count(*) from devis_options;         -- attendu : 4
-- ══════════════════════════════════════════════════════════════════════════════
