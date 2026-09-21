-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Fourniture de linge et consommables
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- POURQUOI UNE LIGNE SÉPARÉE, ET JAMAIS DANS LE PRIX DU MÉNAGE
--
-- Le linge et les consommables sont des BIENS. Ils n'ouvrent aucun droit au
-- crédit d'impôt « services à la personne » : seul le service y ouvre droit.
-- Noyés dans le prix du ménage chez un particulier, ils gonfleraient la base
-- éligible — et c'est sur cette base que passe l'avance immédiate URSSAF. On
-- déclarerait une avance sur une dépense qui n'y donne pas droit.
--
-- Et même chez un client Airbnb, qui n'a de toute façon aucun crédit d'impôt :
-- séparer permet de relever le prix du linge sans rouvrir la négociation sur le
-- ménage, et garde la marge du ménage lisible.
--
-- DEUX FAÇONS DE FACTURER, au choix PAR LOGEMENT :
--   · au KIT      — prix du kit (réglage global) × nombre de kits du logement ;
--   · au FORFAIT  — un montant négocié pour ce logement, qui remplace le calcul.
--   · AUCUNE      — le client fournit son propre linge.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Le réglage par logement ─────────────────────────────────────────────────
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS linge_mode TEXT NOT NULL DEFAULT 'aucun'
  CHECK (linge_mode IN ('aucun', 'kit', 'forfait'));
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS linge_kits    INTEGER;   -- nombre de kits par passage
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS linge_forfait NUMERIC;   -- montant négocié par ménage
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS linge_libelle TEXT;      -- libellé sur la facture

COMMENT ON COLUMN airbnbs.linge_mode IS
  'Fourniture facturee au client : aucun | kit (kits x prix du kit) | forfait.';

-- 2) Ce que le ménage porte ──────────────────────────────────────────────────
-- Figé à la création, comme le prix : une facture émise ne doit pas changer
-- parce qu'on a relevé le prix du kit six mois plus tard.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS supplies_amount NUMERIC DEFAULT 0;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS supplies_label  TEXT;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS supplies_kits   INTEGER DEFAULT 0;

-- 3) Les réglages globaux ────────────────────────────────────────────────────
-- Le prix du kit vit avec les autres paramètres de rentabilité : on le change à
-- UN endroit le jour où le fournisseur augmente, pas sur quarante fiches.
ALTER TABLE profit_config ADD COLUMN IF NOT EXISTS linen_kit_price NUMERIC DEFAULT 0;  -- facturé au client
ALTER TABLE profit_config ADD COLUMN IF NOT EXISTS linen_kit_cost  NUMERIC DEFAULT 0;  -- ce qu'il nous coûte

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select linge_mode, count(*) from airbnbs group by 1;
--   -- attendu : tous en 'aucun' tant que rien n'est renseigné
--
-- ⚠️ `missions` a ses droits d'ecriture restreints par colonne : ces trois
-- nouvelles colonnes ne sont PAS dans le GRANT existant, donc elles ne sont
-- ecrivables que par le serveur. C'est voulu — c'est de l'argent.
-- ══════════════════════════════════════════════════════════════════════════════
