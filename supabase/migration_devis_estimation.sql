-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Estimation en fourchette + mots-clés (LOT 8C)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent (IF NOT EXISTS).
-- Purement additif : n'impacte ni les devis ni les factures existants.
--
-- Objectif : rendre l'agent d'estimation LOCAL plus précis (mots-clés = synonymes
-- de ce que tape le client) et permettre une estimation en FOURCHETTE (prix_min /
-- prix_max). prix_unitaire reste le prix de référence du DEVIS OFFICIEL (milieu de
-- la fourchette si une fourchette est fournie).
-- ══════════════════════════════════════════════════════════════════════════════

-- Mots-clés = synonymes/variantes séparés par des virgules, ex :
--   « vitres, fenêtres, baies, carreaux »  → reconnus dans la description du client.
ALTER TABLE tarifs ADD COLUMN IF NOT EXISTS mots_cles TEXT;

-- Fourchette d'estimation (facultative). NULL = pas de fourchette → on utilise
-- prix_unitaire des deux côtés (estimation à prix fixe pour cette ligne).
ALTER TABLE tarifs ADD COLUMN IF NOT EXISTS prix_min NUMERIC;
ALTER TABLE tarifs ADD COLUMN IF NOT EXISTS prix_max NUMERIC;
