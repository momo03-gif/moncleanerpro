-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — La grille tarifaire n'est plus lisible depuis le navigateur.
-- À exécuter dans Supabase > SQL Editor. Idempotent.
-- ⚠️ À exécuter APRÈS le déploiement du commit ba8d017 (les pages de devis
-- passent désormais par /api/devis/estimation, qui lit avec la clé de service).
--
-- Avant : `tarifs` et `devis_*` étaient lisibles en SELECT avec la clé publique
-- (celle qui part dans le navigateur) — un concurrent copiait toute la grille en
-- une requête. Le serveur garde l'accès (service_role contourne la RLS).
-- ══════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS tarifs_read ON tarifs;
DROP POLICY IF EXISTS devis_options_read ON devis_options;
DROP POLICY IF EXISTS devis_settings_read ON devis_settings;
DROP POLICY IF EXISTS devis_surface_tiers_read ON devis_surface_tiers;
DROP POLICY IF EXISTS devis_zones_read ON devis_zones;

REVOKE ALL ON tarifs, devis_options, devis_settings, devis_surface_tiers, devis_zones FROM anon, authenticated;

-- RLS active partout : sans politique, rien n'est lisible côté public.
ALTER TABLE tarifs ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis_surface_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE devis_zones ENABLE ROW LEVEL SECURITY;
