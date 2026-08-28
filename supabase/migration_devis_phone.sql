-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Le téléphone du client sort de la colonne adresse
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent.
--
-- Avant : la demande de devis en ligne collait le numéro DANS l'adresse
--   « 12 rue de la Paix, Lyon — Tél : 06 12 34 56 78 »
-- Deux informations dans une seule colonne : impossible d'en faire un lien
-- d'appel, impossible de chercher un client par son numéro.
--
-- Maintenant : `client_phone` a sa propre colonne, et l'adresse redevient une
-- adresse. La reprise ci-dessous récupère les numéros déjà enregistrés.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE devis ADD COLUMN IF NOT EXISTS client_phone TEXT;
COMMENT ON COLUMN devis.client_phone IS
  'Téléphone du client, affiché en lien d''appel direct. Séparé de client_address.';

-- ── Reprise de l'existant ─────────────────────────────────────────────────────
-- 1) On extrait le numéro des adresses de la forme « … — Tél : 06 … ».
UPDATE devis
SET client_phone = btrim(substring(client_address from 'T[ée]l\s*:\s*(.+)$'))
WHERE client_phone IS NULL
  AND client_address ~ 'T[ée]l\s*:';

-- 2) On retire la partie « — Tél : … » de l'adresse, désormais en double.
--    Une adresse qui ne contenait QUE le téléphone se retrouve vide → NULL.
UPDATE devis
SET client_address = NULLIF(btrim(regexp_replace(client_address, '\s*[—-]?\s*T[ée]l\s*:.*$', '')), '')
WHERE client_address ~ 'T[ée]l\s*:';

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select number, client_name, client_phone, client_address
--   from devis order by created_at desc limit 10;
--   -- attendu : le numéro dans client_phone, l'adresse seule dans client_address
-- ══════════════════════════════════════════════════════════════════════════════
