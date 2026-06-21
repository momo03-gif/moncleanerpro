-- ══════════════════════════════════════════════════════════════════
-- MonCleanerPro — Migration « Taux de livraison du cleaner »
-- À exécuter UNE FOIS dans Supabase > SQL Editor (idempotent).
--
-- Un cleaner habilité à la livraison gagne un MONTANT FIXE par livraison
-- (indépendant de la durée), modifiable par l'admin. Le gain d'une mission
-- de livraison = delivery_rate ; le ménage reste taux horaire × durée / 60.
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE cleaners ADD COLUMN IF NOT EXISTS delivery_rate NUMERIC DEFAULT 0;
UPDATE cleaners SET delivery_rate = 0 WHERE delivery_rate IS NULL;
