-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Coordonnées de l'adresse SUR la mission (proximité fiable)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Problème corrigé : la vérification de proximité (démarrer/terminer une mission,
-- payer le parking) ne lisait les coordonnées QUE depuis le site lié (airbnbs).
-- Une mission sans site géolocalisé (hôtel, adresse libre, one-shot) n'était donc
-- PAS contrôlée → un cleaner pouvait démarrer une mission depuis n'importe où.
-- On stocke désormais les coordonnées de l'adresse cible directement sur la mission.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE missions ADD COLUMN IF NOT EXISTS address_lat DOUBLE PRECISION;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS address_lng DOUBLE PRECISION;

-- Plannings récurrents : on porte aussi les coordonnées, copiées sur chaque mission générée.
ALTER TABLE recurring_missions ADD COLUMN IF NOT EXISTS address_lat DOUBLE PRECISION;
ALTER TABLE recurring_missions ADD COLUMN IF NOT EXISTS address_lng DOUBLE PRECISION;

-- Backfill : missions liées à un site géolocalisé → on copie les coordonnées du site.
UPDATE missions m
   SET address_lat = a.latitude, address_lng = a.longitude
  FROM airbnbs a
 WHERE m.airbnb_id = a.id
   AND m.address_lat IS NULL
   AND a.latitude IS NOT NULL AND a.longitude IS NOT NULL;
