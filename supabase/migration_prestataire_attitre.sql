-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Prestataire attitré d'un logement.
-- À exécuter dans Supabase > SQL Editor. Idempotent. Purement additif.
-- ⚠️ À EXÉCUTER AVANT LE DÉPLOIEMENT : la liste des logements lit la colonne.
--
-- Un logement peut avoir un prestataire attitré : chaque ménage prévu sur ce
-- logement (synchro des réservations, création manuelle, récurrent…) lui est
-- confié d'office, s'il n'est encore attribué à personne. Règle crédit d'impôt
-- respectée : un domicile de particulier ne va qu'à un prestataire SAP.
-- Cf. src/lib/prestataireConfier.ts.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS prestataire_id UUID REFERENCES prestataires(id) ON DELETE SET NULL;

-- Jamais lisible depuis le navigateur : une conciergerie ne doit pas savoir
-- qu'un logement est confié à un prestataire (lecture via /api/airbnbs, admin).
REVOKE ALL (prestataire_id) ON airbnbs FROM anon, authenticated;
