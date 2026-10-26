-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Prestataires : véhicules (vélo, trottinette, scooter, voiture,
-- camionnette). À exécuter dans Supabase > SQL Editor. Idempotent.
-- NULL = non renseigné (inscrits avant la question) ; '{}' = pas véhiculé.
-- Clés possibles : voir VEHICULES dans src/lib/prestataireRegles.ts.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE prestataires ADD COLUMN IF NOT EXISTS vehicules TEXT[];
