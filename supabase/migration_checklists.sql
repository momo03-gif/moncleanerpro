-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Checklists de ménage par logement
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Principe : la conciergerie définit SON standard pour CHAQUE logement (« rideau
-- de douche détartré », « 4 capsules de café », « thermostat à 18° »). Le cleaner
-- coche pendant le ménage ; la conciergerie voit la conformité (X/Y) et l'heure
-- de chaque point coché. C'est la fonction que Hostaway/Hostify mettent en avant
-- et qui nous manquait : sans elle, « ce qui a été fait » reste déclaratif.
--
-- Deux tables :
--   checklist_items          → le MODÈLE, attaché au logement (réutilisé à chaque ménage)
--   mission_checklist_checks → l'EXÉCUTION, attachée à la mission (ce qui a été coché)
--
-- Le libellé est recopié (`label_snapshot`) au moment du ménage : si le modèle
-- change plus tard, l'historique reste fidèle à ce qui était demandé ce jour-là.
--
-- Donnée opérationnelle (comme missions / repairs / mission_reports) → pas de RLS :
-- l'accès est filtré applicativement par airbnb_id / partner_id.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── Le modèle : les points à faire dans un logement ───────────────────────────
CREATE TABLE IF NOT EXISTS checklist_items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  airbnb_id   UUID NOT NULL REFERENCES airbnbs(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,                       -- « Détartrer le rideau de douche »
  room        TEXT,                                -- pièce/zone : « Cuisine », « Salle de bain »… (libre)
  position    INTEGER NOT NULL DEFAULT 0,          -- ordre d'affichage
  required    BOOLEAN NOT NULL DEFAULT TRUE,       -- point essentiel : compte dans la conformité
  -- Photo « voilà à quoi ça doit ressembler », montrée à l'intervenant au moment
  -- de cocher. Une photo évite trois lignes de consignes mal interprétées.
  reference_photo_url TEXT,
  created_by  TEXT,                                -- nom de l'auteur (snapshot)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- On n'efface pas un point retiré du standard : on l'archive, sinon les ménages
  -- passés perdraient leurs coches (ON DELETE CASCADE ci-dessous).
  archived_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_airbnb
  ON checklist_items(airbnb_id, position) WHERE archived_at IS NULL;

ALTER TABLE checklist_items DISABLE ROW LEVEL SECURITY;

-- ── L'exécution : ce que le cleaner a coché sur une mission ───────────────────
CREATE TABLE IF NOT EXISTS mission_checklist_checks (
  mission_id     UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  item_id        UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  label_snapshot TEXT NOT NULL,                    -- libellé au moment du ménage
  checked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_by     TEXT,                             -- nom du cleaner (snapshot)
  PRIMARY KEY (mission_id, item_id)
);

-- Une ligne = un point coché. Décocher supprime la ligne : pas d'état « faux » à
-- maintenir, et la conformité se lit toujours comme « lignes / points requis ».
CREATE INDEX IF NOT EXISTS idx_mission_checks_mission ON mission_checklist_checks(mission_id);

ALTER TABLE mission_checklist_checks DISABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select count(*) from checklist_items;           -- attendu : 0
--   select count(*) from mission_checklist_checks;  -- attendu : 0
-- ══════════════════════════════════════════════════════════════════════════════
