-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Le simulateur chiffre en FOURCHETTE, pas en prix unique
-- À exécuter dans Supabase > SQL Editor, APRÈS migration_devis_simulateur.sql.
-- Idempotent.
--
-- La vraie grille s'exprime en fourchettes (« T2 36–50 m² : 30–35 € ») : l'état
-- réel du logement fait varier le temps passé. Annoncer un prix unique obligeait
-- soit à prendre le haut de la fourchette — et paraître cher —, soit le bas, et
-- devoir se dédire sur place.
--
-- `base_price` devient le BAS de la fourchette ; `price_max` le haut.
-- Un `price_max` vide = prix ferme (les deux bornes sont égales).
-- Un `base_price` vide = sur devis, quelle que soit la borne haute.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE devis_surface_tiers ADD COLUMN IF NOT EXISTS price_max NUMERIC;

COMMENT ON COLUMN devis_surface_tiers.base_price IS 'Bas de la fourchette (NULL = sur devis)';
COMMENT ON COLUMN devis_surface_tiers.price_max  IS 'Haut de la fourchette (NULL = prix ferme)';

-- ══════════════════════════════════════════════════════════════════════════════
--  LA GRILLE RÉELLE — remplace les valeurs d'exemple issues de la maquette.
--  Surfaces contiguës : chaque palier s'applique jusqu'à `max_m2`, le suivant
--  prend la suite. Le dernier n'a pas de prix : au-delà de 200 m², sur devis.
-- ══════════════════════════════════════════════════════════════════════════════

DELETE FROM devis_surface_tiers;

INSERT INTO devis_surface_tiers (max_m2, label, cap_text, base_price, price_max) VALUES
  ( 35, 'Studio',  '2 pers.',      25,  30),
  ( 50, 'T2',      '2 à 4 pers.',  30,  35),
  ( 60, 'T2',      '2 à 4 pers.',  35,  40),
  ( 70, 'T3',      '4 à 6 pers.',  40,  50),
  ( 80, 'T3',      '4 à 6 pers.',  50,  65),
  ( 90, 'T4',      '6 à 8 pers.',  65,  75),
  (110, 'T4',      '6 à 8 pers.',  75,  90),
  (130, 'T5',      '8 à 10 pers.', 90, 110),
  (160, 'T5',      '8 à 10 pers.', 110, 130),
  (200, 'Maison',  '10 à 12 pers.', 130, 180),
  (9999, 'Maison', 'plus de 200 m²', NULL, NULL);

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select max_m2, label, base_price, price_max from devis_surface_tiers
--   order by max_m2;   -- attendu : 11 lignes, la dernière sans prix
-- ══════════════════════════════════════════════════════════════════════════════
