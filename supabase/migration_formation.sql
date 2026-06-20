-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Module Formation (LOT 7 + 7bis)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent (IF NOT EXISTS).
-- Module indépendant, purement additif : ne touche à aucune table existante
-- (sauf l'ajout d'une colonne facultative sur cleaners).
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1) CATÉGORIES (thèmes de formation) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS formation_categories (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titre       TEXT NOT NULL,
  description TEXT,
  icone       TEXT,                          -- nom d'icône ligne (jeu Icon de l'app)
  ordre       INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE formation_categories DISABLE ROW LEVEL SECURITY;

-- ── 2) VIDÉOS (une catégorie → plusieurs vidéos) ──────────────────────────────
CREATE TABLE IF NOT EXISTS formations (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  categorie_id UUID NOT NULL REFERENCES formation_categories(id) ON DELETE CASCADE,
  titre        TEXT NOT NULL,
  description  TEXT,
  video_url    TEXT,                          -- URL YouTube non listé / Vimeo
  ordre        INTEGER NOT NULL DEFAULT 0,
  obligatoire  BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE formations DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_formations_categorie ON formations(categorie_id);

-- ── 3) ASSIGNATIONS (admin → cleaners, LOT 7bis) ──────────────────────────────
-- Une formation (vidéo OU catégorie entière) imposée/recommandée à un cleaner.
--   obligatoire = true  → bloquante (le cleaner ne peut accepter de mission)
--   obligatoire = false → recommandée (n'empêche pas de travailler)
CREATE TABLE IF NOT EXISTS formation_assignments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cleaner_id      UUID NOT NULL REFERENCES cleaners(id) ON DELETE CASCADE,
  formation_id    UUID REFERENCES formations(id) ON DELETE CASCADE,
  categorie_id    UUID REFERENCES formation_categories(id) ON DELETE CASCADE,
  obligatoire     BOOLEAN NOT NULL DEFAULT true,
  statut          TEXT NOT NULL DEFAULT 'a_faire' CHECK (statut IN ('a_faire', 'terminee')),
  date_assignation TIMESTAMPTZ DEFAULT NOW(),
  date_completion  TIMESTAMPTZ,
  CHECK (formation_id IS NOT NULL OR categorie_id IS NOT NULL)  -- cible une vidéo ou une catégorie
);
ALTER TABLE formation_assignments DISABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_formation_assignments_cleaner ON formation_assignments(cleaner_id);

-- ── 4) COMPAT : ancien champ unique (LOT 7.D) — conservé, non bloquant ────────
-- Le blocage avant mission s'appuie désormais sur les assignations obligatoires
-- (LOT 7bis). Cette colonne reste pour compatibilité ascendante.
ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS formation_completee BOOLEAN NOT NULL DEFAULT false;

-- ── 5) CATÉGORIES PAR DÉFAUT (modifiables par l'admin) ────────────────────────
INSERT INTO formation_categories (titre, description, icone, ordre)
SELECT v.titre, v.description, 'book', v.ordre
FROM (VALUES
  ('Nettoyage des toilettes', 'Méthode et produits pour des sanitaires impeccables.', 1),
  ('Faire un lit correctement', 'Pliage, angles et finitions hôtelières.', 2),
  ('Nettoyage de la cuisine',  'Plans de travail, électroménager, dégraissage.', 3),
  ('Salle de bain',            'Douche, miroirs, robinetterie sans traces.', 4),
  ('Sols et poussières',       'Aspiration, lavage et dépoussiérage méthodiques.', 5)
) AS v(titre, description, ordre)
WHERE NOT EXISTS (SELECT 1 FROM formation_categories WHERE titre = v.titre);
