-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Nombre de voyageurs d'une réservation.
-- À exécuter dans Supabase > SQL Editor. Idempotent. Purement additif.
-- ⚠️ À EXÉCUTER AVANT LE DÉPLOIEMENT : la liste des réservations lit la colonne.
--
-- Donné par les API de logiciels (Hostify, SuperHote, Lodgify…) ; jamais par un
-- lien iCal (Airbnb, Booking) — la colonne reste alors vide. Cf. pms/normalize.ts.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guests_count SMALLINT
  CHECK (guests_count IS NULL OR guests_count BETWEEN 1 AND 99);

REVOKE ALL (guests_count) ON reservations FROM anon, authenticated;

-- Hostify le portait déjà dans l'intitulé importé (« … · 3 pers. ») : on le
-- reprend tout de suite ; les autres logiciels le donneront à la prochaine synchro.
UPDATE reservations
SET guests_count = substring(raw->>'summary' from '(\d+) pers\.')::smallint
WHERE guests_count IS NULL
  AND raw->>'summary' ~ '(^|\D)([1-9]|[1-9]\d) pers\.';
