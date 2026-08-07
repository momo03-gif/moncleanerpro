-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Localiser un constat dans une maison louée à la chambre
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Sur un ménage couvrant plusieurs chambres, « robinet qui fuit » ne suffit pas :
-- l'hôte doit savoir DANS QUELLE chambre. On ajoute donc une localisation aux
-- deux constats qui en ont besoin (dégât, objet oublié).
-- ══════════════════════════════════════════════════════════════════════════════

-- Liste des chambres réellement couvertes par le ménage. Renseignée par la
-- synchro, y compris quand la maison entière est à faire (les 3 chambres y sont).
-- Sert à proposer au cleaner les bons boutons « où ? ».
ALTER TABLE missions ADD COLUMN IF NOT EXISTS covered_unit_names JSONB;

COMMENT ON COLUMN missions.covered_unit_names IS
  'Chambres couvertes par le ménage, ex. ["Fleurie-ANSE","Juliana-ANSE"]. NULL = logement classique.';

-- Localisation du constat. NULL = non précisé (logement classique, ou cleaner
-- qui n'a rien indiqué) → l'affichage reste identique à aujourd'hui.
ALTER TABLE mission_reports ADD COLUMN IF NOT EXISTS issues_unit TEXT;
ALTER TABLE mission_reports ADD COLUMN IF NOT EXISTS lost_found_unit TEXT;

COMMENT ON COLUMN mission_reports.issues_unit IS
  'Chambre ou espace où le problème a été constaté (ex. « Fleurie-ANSE », « Communs »).';
COMMENT ON COLUMN mission_reports.lost_found_unit IS
  'Chambre ou espace où l''objet oublié a été trouvé.';
