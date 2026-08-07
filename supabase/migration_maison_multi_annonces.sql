-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Maison louée EN ENTIER ou À LA CHAMBRE (annonces multiples)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent (IF NOT EXISTS).
-- Purement additif : sans lien renseigné, la synchronisation se comporte
-- exactement comme avant pour tous les logements existants.
--
-- Contexte : une même maison physique peut être commercialisée sous plusieurs
-- annonces — ex. 30 B Ancienne Grande Rue à Anse : « MAISON ANSE LES VIGNES »
-- (maison entière) + « Fleurie », « Juliana », « Saint-Amour » (les 3 chambres).
-- Le PMS bloque automatiquement les annonces sœurs quand l'une est réservée, ce
-- qui faisait créer jusqu'à 4 ménages pour UN SEUL déplacement.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1) Rattachement chambre → annonce « maison entière » ──────────────────────
-- NULL = logement indépendant (cas de la très grande majorité du parc).
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS parent_airbnb_id UUID
  REFERENCES airbnbs(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_airbnbs_parent ON airbnbs(parent_airbnb_id);

COMMENT ON COLUMN airbnbs.parent_airbnb_id IS
  'Annonce « maison entière » dont ce logement est une chambre. NULL = logement indépendant.';

-- ── 2) Détail du ménage groupé ────────────────────────────────────────────────
-- covered_units : ce qu'il y a à faire ce jour-là, en clair pour le cleaner
--                 (ex. « Fleurie + Saint-Amour + communs »).
-- whole_property : TRUE quand la maison entière est à faire — soit parce que
--                 l'annonce maison était louée, soit parce que TOUTES les
--                 chambres se libèrent le même jour.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS covered_units TEXT;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS whole_property BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN missions.covered_units IS
  'Chambres couvertes par ce ménage quand la maison est louée à la chambre.';
COMMENT ON COLUMN missions.whole_property IS
  'TRUE = maison entière à faire (annonce entière louée, ou toutes les chambres libérées le même jour).';

-- ── 3) Rattachement de la maison d''Anse (30 B Ancienne Grande Rue) ───────────
-- Les 3 chambres pointent vers l'annonce « maison entière ». Rejouable sans
-- risque : ne fait rien si les noms ne correspondent pas.
UPDATE airbnbs SET parent_airbnb_id = (
  SELECT id FROM airbnbs WHERE name ILIKE 'MAISON ANSE LES VIGNES%' LIMIT 1
)
WHERE name IN ('Fleurie-ANSE', 'Juliana-ANSE', 'Saint-Amour ANSE')
  AND parent_airbnb_id IS NULL;

-- Contrôle : doit renvoyer les 3 chambres rattachées à la maison entière.
-- SELECT c.name AS chambre, p.name AS maison
-- FROM airbnbs c JOIN airbnbs p ON p.id = c.parent_airbnb_id;
