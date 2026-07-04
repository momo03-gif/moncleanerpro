-- ════════════════════════════════════════════════════════════════════════════
--  Type de client hôtelier : Hôtel vs EHPAD
--  À lancer une fois dans Supabase (SQL Editor).
--
--  Objectif : distinguer les EHPAD des hôtels (aujourd'hui confondus) pour
--  séparer les données partout (stats, facturation, rentabilité). Le type est
--  choisi à l'inscription et corrigeable par l'admin.
--
--  Sans risque : valeur par défaut 'hotel' (les comptes existants deviennent
--  « hôtel »), idempotent. Le code tolère l'absence de la colonne.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE hotels
  ADD COLUMN IF NOT EXISTS client_type text NOT NULL DEFAULT 'hotel';

-- Sécurité : on n'accepte que 'hotel' ou 'ehpad'.
ALTER TABLE hotels
  DROP CONSTRAINT IF EXISTS hotels_client_type_check;
ALTER TABLE hotels
  ADD CONSTRAINT hotels_client_type_check CHECK (client_type IN ('hotel', 'ehpad'));
