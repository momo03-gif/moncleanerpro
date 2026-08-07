-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Tarif par PALIER pour une maison louée à la chambre
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Le prix d'un ménage ne s'additionne PAS chambre par chambre : c'est un forfait
-- selon le nombre de chambres à faire ce jour-là. Pour la maison d'Anse :
--   1 chambre = 55 €   ·   2 chambres = 60 €   ·   maison entière = 75 €
-- (« maison entière » = l'annonce entière est louée, OU toutes les chambres se
-- libèrent le même jour.)
--
-- Renseigné sur l'annonce MAISON ENTIÈRE uniquement. NULL = pas de palier, on
-- retombe sur l'ancien calcul (somme des tarifs de chaque chambre).
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS group_tiers JSONB;

COMMENT ON COLUMN airbnbs.group_tiers IS
  'Paliers de tarif/durée par nombre de chambres à faire, sur l''annonce maison entière. Ex : {"1":{"price":55,"minutes":90}}. NULL = somme des tarifs par chambre.';

-- Paliers de la maison d'Anse (30 B Ancienne Grande Rue).
-- ⚠️ Les PRIX viennent du client. Les DURÉES sont une première estimation à
--    ajuster : elles pilotent la rémunération du cleaner (taux horaire × durée).
UPDATE airbnbs SET group_tiers = '{
  "1": {"price": 55, "minutes": 90},
  "2": {"price": 60, "minutes": 120},
  "3": {"price": 75, "minutes": 150}
}'::jsonb
WHERE name ILIKE 'MAISON ANSE LES VIGNES%';

-- Contrôle :
-- SELECT name, client_price, group_tiers FROM airbnbs WHERE group_tiers IS NOT NULL;
