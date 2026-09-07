-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Informations de facturation des partenaires
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent.
--
-- Pourquoi : créer un compte HÔTEL demandait une adresse postale, créer un compte
-- CONCIERGERIE non — la colonne n'existait pas sur `airbnb_partners`. Résultat,
-- une facture émise à une conciergerie ne pouvait pas porter l'adresse du client,
-- alors que c'est une mention obligatoire sur une facture (art. L.441-9 du code
-- de commerce). L'écran d'administration affichait d'ailleurs une adresse vide
-- codée en dur, en attendant cette colonne.
--
-- Le code TOLÈRE l'absence de la colonne : tant que cette migration n'est pas
-- passée, l'application continue de fonctionner, l'adresse reste simplement vide.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE airbnb_partners ADD COLUMN IF NOT EXISTS address TEXT;
COMMENT ON COLUMN airbnb_partners.address IS
  'Adresse postale de facturation de la conciergerie. Imprimée sur les factures et devis.';

-- ── Reprise de l'existant ─────────────────────────────────────────────────────
-- Rien à reprendre : l'information n'a jamais été collectée pour ces comptes.
-- Les partenaires la renseignent eux-mêmes depuis /airbnb/profil, et l'admin
-- peut la corriger depuis /admin/comptes.

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select partner_name, email, phone, address from airbnb_partners
--   order by partner_name;
--   -- attendu : la colonne existe, vide tant que les partenaires ne l'ont pas saisie
-- ══════════════════════════════════════════════════════════════════════════════
