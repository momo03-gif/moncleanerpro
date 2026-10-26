-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Missions d'intervention (artisans : serrure, peinture, matelas…).
-- À exécuter dans Supabase > SQL Editor. Idempotent.
-- ⚠️ À EXÉCUTER AVANT LE DÉPLOIEMENT : sans elle, créer une intervention échoue
-- (contrainte CHECK sur missions.service).
-- ══════════════════════════════════════════════════════════════════════════════

-- 'repair' = intervention / petits travaux : facturée au client, payée au taux
-- horaire × durée, jamais proposée d'office à l'équipe ni touchée par la synchro.
ALTER TABLE missions DROP CONSTRAINT IF EXISTS missions_service_check;
ALTER TABLE missions ADD CONSTRAINT missions_service_check
  CHECK (service IN ('cleaning', 'delivery', 'cleaning_delivery', 'appointment', 'repair'));

-- Spécialité artisan visée (clé de SPECIALITES, lib/prestataireRegles.ts) et
-- description du travail à faire.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS repair_specialite TEXT;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS repair_details TEXT;
