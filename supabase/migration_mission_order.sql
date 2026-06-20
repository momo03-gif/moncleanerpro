-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Ordre manuel des missions par cleaner
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent (IF NOT EXISTS).
--
-- L'admin classe l'ordre des missions de chaque cleaner (ex : appartement 1,2,3,4).
-- Ce rang est stocké dans `manual_order` et prime sur le tri automatique, à date
-- égale. Le cleaner voit EXACTEMENT le même ordre (logique de tri partagée).
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE missions ADD COLUMN IF NOT EXISTS manual_order INTEGER;
CREATE INDEX IF NOT EXISTS idx_missions_manual_order ON missions(cleaner_id, date_from, manual_order);

-- Vue « missions non sensibles » (LOT 4) mise à jour pour inclure manual_order,
-- afin que l'ordre admin reste visible côté cleaner même après activation RLS.
CREATE OR REPLACE VIEW cleaner_missions_public AS
SELECT id, cleaner_id, cleaner_name, type, source, status, airbnb_id, partner_id,
       property_name, address, date_from, time_from, time_to,
       mission_duration_minutes, manual_order, next_arrival, next_arrival_time,
       started_at, ended_at, instructions, created_at
FROM missions;
