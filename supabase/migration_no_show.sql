-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — No show : le logement n'a pas été utilisé
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Le cleaner arrive pour le ménage et constate que le voyageur n'est jamais
-- venu : le logement est propre, il n'y a rien à faire. La mission est CLÔTURÉE
-- (status 'done' — aucun statut n'est ajouté ni renommé) et marquée no_show.
-- Le client paie un forfait déplacement, le cleaner touche un forfait : les deux
-- montants remplacent prix et gain sur la mission, les anciens sont gardés pour
-- pouvoir annuler le no show sans rien perdre.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE missions ADD COLUMN IF NOT EXISTS no_show BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS no_show_at TIMESTAMPTZ;
-- 'cleaner' (constaté sur place) ou 'admin'.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS no_show_by TEXT;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS no_show_note TEXT;
-- Prix client et gains AVANT le no show : restaurés si l'admin l'annule.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS no_show_prev_price NUMERIC;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS no_show_prev_gain NUMERIC;
ALTER TABLE missions ADD COLUMN IF NOT EXISTS no_show_prev_prestataire_gain NUMERIC;

COMMENT ON COLUMN missions.no_show IS
  'Logement non utilisé par le voyageur : mission clôturée sans ménage, facturée au forfait déplacement.';

-- Les forfaits par défaut, réglables dans Statistiques > Rentabilité > Paramètres.
ALTER TABLE profit_config ADD COLUMN IF NOT EXISTS no_show_client_fee NUMERIC DEFAULT 0;  -- facturé au client
ALTER TABLE profit_config ADD COLUMN IF NOT EXISTS no_show_cleaner_fee NUMERIC DEFAULT 0; -- payé au cleaner
