-- ════════════════════════════════════════════════════════════════════════════
--  Lien mission → demande hôtel (suivi de statut fiable)
--  À lancer une fois dans Supabase (SQL Editor).
--
--  Objectif : permettre à une demande hôtel d'afficher « En cours » puis
--  « Terminée » à mesure que ses ménages avancent. Chaque mission créée à la
--  validation d'une demande est rattachée à celle-ci via request_id ; le statut
--  effectif de la demande est ensuite dérivé de ses missions (côté serveur).
--
--  Sans risque : colonne nullable, idempotent (IF NOT EXISTS). Le code tolère
--  l'absence de la colonne (déploiement avant/après indifférent).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE missions
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES hotel_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_missions_request_id ON missions(request_id);
