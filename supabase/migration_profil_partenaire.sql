-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Identité légale des clients (SIRET / TVA intracommunautaire)
-- À exécuter dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- POURQUOI : une facture entre professionnels porte l'identité des DEUX parties.
-- Nous collections le nom, l'email, le téléphone et l'adresse du client, mais
-- jamais son SIRET — alors que c'est ce numéro qui identifie la société sans
-- ambiguïté, et qu'il est attendu sur une facture B2B comme sur un contrat
-- (cf. Article 1 des conditions particulières, src/lib/contrat.ts).
--
-- La TVA intracommunautaire sert dans un seul cas mais il arrive : un client
-- établi hors de France. Sans elle, impossible de facturer en autoliquidation.
--
-- DROITS : `airbnb_partners` et `hotels` sont déjà fermées à la clé publique par
-- RLS activée sans politique (migration_rls_pii.sql). Ces tables n'ont AUCUN
-- droit colonne par colonne : une colonne ajoutée hérite donc du verrou, il n'y
-- a rien à accorder ici. Tout passe par /api/partners, en service_role, avec
-- l'identité tirée de la session.
--
-- Le code TOLÈRE l'absence de ces colonnes : tant que la migration n'est pas
-- passée, le reste de la fiche s'enregistre et l'écran le dit au client.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE airbnb_partners ADD COLUMN IF NOT EXISTS siret         TEXT;
ALTER TABLE airbnb_partners ADD COLUMN IF NOT EXISTS tva_intracom  TEXT;
ALTER TABLE hotels          ADD COLUMN IF NOT EXISTS siret         TEXT;
ALTER TABLE hotels          ADD COLUMN IF NOT EXISTS tva_intracom  TEXT;

COMMENT ON COLUMN airbnb_partners.siret IS
  'SIRET du client (14 chiffres). Imprimé sur la facture et le contrat.';
COMMENT ON COLUMN airbnb_partners.tva_intracom IS
  'Numéro de TVA intracommunautaire — renseigné surtout pour un client hors de France.';
COMMENT ON COLUMN hotels.siret IS
  'SIRET du client (14 chiffres). Imprimé sur la facture et le contrat.';
COMMENT ON COLUMN hotels.tva_intracom IS
  'Numéro de TVA intracommunautaire — renseigné surtout pour un client hors de France.';

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select partner_name, siret, tva_intracom from airbnb_partners order by partner_name;
--   select hotel_name,   siret, tva_intracom from hotels          order by hotel_name;
--   -- attendu : les colonnes existent, vides tant que les clients ne les ont pas saisies.
-- Avec la CLÉ PUBLIQUE : select sur ces deux tables doit rester REFUSÉ.
-- ══════════════════════════════════════════════════════════════════════════════
