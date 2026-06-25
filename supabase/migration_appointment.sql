-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Type de mission « Rendez-vous » (service = 'appointment')
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Un rendez-vous est une mission planifiée (date/heure + descriptif), assignable à
-- un cleaner (via cleaner_id, comme aujourd'hui) OU à un administrateur. Les admins
-- n'étant pas dans la table cleaners, on stocke l'assigné non-cleaner ici.
-- Le rendez-vous est interne : ni facturé (price=0) ni payé (cleaner_gain=0) — géré
-- côté code par serviceParts('appointment') = {cleaning:false, delivery:false}.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE missions ADD COLUMN IF NOT EXISTS assignee_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS assignee_name TEXT;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS assignee_role TEXT;

-- La colonne service portait une contrainte CHECK (cleaning/delivery/cleaning_delivery)
-- posée par migration_delivery.sql. On l'élargit pour autoriser 'appointment'.
ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_service_check;
ALTER TABLE missions ADD CONSTRAINT missions_service_check
  CHECK (service IN ('cleaning', 'delivery', 'cleaning_delivery', 'appointment'));

-- Note : la colonne missions.group_id (intervention ponctuelle multi-cleaners) existe
-- déjà via migration_delivery_group.sql — réutilisée par les missions « one-shot ».
