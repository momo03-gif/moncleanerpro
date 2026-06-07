-- ══════════════════════════════════════════════
-- MonCleanerPro — Traçabilité du créateur des missions
-- Permet de contrôler qui peut modifier / supprimer une mission.
-- Exécuter dans Supabase > SQL Editor
-- ══════════════════════════════════════════════

-- Qui a créé la mission (users.id) et avec quel rôle.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS created_by_role TEXT;

-- Backfill des missions existantes :
--  • créées par un partenaire Airbnb (partner_id renseigné) → créateur = ce partenaire
UPDATE missions
   SET created_by = partner_id, created_by_role = 'airbnb'
 WHERE partner_id IS NOT NULL AND created_by IS NULL;

--  • le reste (créées/validées côté admin, ou issues d'une annonce hôtel) → admin
UPDATE missions
   SET created_by_role = 'admin'
 WHERE created_by_role IS NULL;
