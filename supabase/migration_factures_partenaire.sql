-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Les factures dans l'espace du partenaire
-- À exécuter dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- CE QUI MANQUAIT : la table `invoices` ne relie une facture à un client QUE par
-- un libellé texte (`partner_label`). Impossible, donc, de montrer à un
-- partenaire connecté « vos factures » — on ne saurait pas lesquelles sont les
-- siennes autrement qu'en comparant des chaînes de caractères, ce qui casse au
-- premier changement de raison sociale.
--
-- Et rien ne dit QUAND une facture est due : le statut sait dire « payée », pas
-- « en retard ». Or c'est la différence entre une facture émise ce matin et une
-- facture oubliée depuis trois semaines — la seule qui justifie une relance.
-- ══════════════════════════════════════════════════════════════════════════════

-- Le compte auquel la facture appartient. Nul pour les factures anciennes : on
-- ne devine pas, on rattachera à la main ou au prochain envoi.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- L'échéance (30 jours date de facture, cf. contrat) et la date de règlement.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_at  TIMESTAMPTZ;

-- Le document lui-même. L'entreprise dépose le PDF — qu'il vienne de l'app ou
-- du logiciel du comptable — et le client le télécharge depuis son espace.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS file_url  TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS file_path TEXT;   -- chemin Storage, pour pouvoir remplacer

CREATE INDEX IF NOT EXISTS idx_invoices_partner ON invoices(partner_id, created_at DESC);

COMMENT ON COLUMN invoices.due_date IS
  'Echeance de paiement. Passee, la facture s''affiche « en retard » chez le client.';

-- Le dossier des factures : PRIVE.
-- Une facture porte une raison sociale, des montants, une adresse. Un dossier
-- public la rendrait lisible par quiconque devine l'adresse du fichier — c'est
-- exactement ce qu'on a passe la semaine a fermer ailleurs. Le serveur depose le
-- fichier et delivre au client un lien SIGNE, valable quelques minutes, apres
-- avoir verifie que la facture est bien la sienne.
INSERT INTO storage.buckets (id, name, public)
VALUES ('factures', 'factures', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Aucune policy pour anon ni authenticated : seul service_role y accede, donc
-- seules nos routes serveur.

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select count(*) filter (where partner_id is null) as sans_compte,
--          count(*) as total
--     from invoices;
--
-- Pas de GRANT à ajouter : `invoices` n'a pas de droits par colonne, et la
-- lecture par le partenaire passera par une route serveur — la table reste
-- fermée en écriture au navigateur, comme on l'a verrouillée.
-- ══════════════════════════════════════════════════════════════════════════════
