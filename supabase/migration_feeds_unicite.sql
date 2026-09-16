-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Un logement, plusieurs calendriers, mais jamais deux fois le même
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- CE QUI RESTE AUTORISÉ (et qui est le cas normal) : plusieurs flux sur un même
-- logement. Un propriétaire sans logiciel de gestion loue sur Airbnb, Booking et
-- Abritel : trois calendriers, un seul logement. Les départs sont ensuite
-- fusionnés en un seul ménage par date (garde-fou anti-doublon de
-- materializeMissions, src/lib/reservationSync.ts).
--
-- CE QU'ON INTERDIT : le MÊME lien deux fois sur le même logement. La
-- déduplication des réservations se fait par (feed_id, external_uid) : deux flux
-- identiques importeraient les mêmes séjours deux fois, et le tableau du
-- partenaire afficherait des doublons. Le code le refuse déjà à la saisie
-- (createReservationFeed) ; cet index le garantit même en cas de double clic.
--
-- ⚠️ AVANT D'EXÉCUTER — vérifier qu'aucun doublon n'existe déjà, sinon la
-- création de l'index échoue (et c'est tant mieux : il faut choisir lequel
-- garder). Les deux requêtes doivent ne rien renvoyer :
--
--   select airbnb_id, ical_url, count(*) from reservation_feeds
--    where ical_url is not null group by 1,2 having count(*) > 1;
--
--   select airbnb_id, platform, external_property_id, count(*) from reservation_feeds
--    where external_property_id is not null group by 1,2,3 having count(*) > 1;
--
-- S'il y a des doublons : supprimer le flux le plus récent de chaque paire
-- (ses réservations partent avec lui, elles seront réimportées par l'autre).
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Deux fois le même lien iCal sur un même logement.
CREATE UNIQUE INDEX IF NOT EXISTS reservation_feeds_unique_ical
  ON reservation_feeds (airbnb_id, ical_url)
  WHERE ical_url IS NOT NULL;

-- 2) Deux fois le même logement chez le même éditeur (connexion par clé API).
CREATE UNIQUE INDEX IF NOT EXISTS reservation_feeds_unique_api
  ON reservation_feeds (airbnb_id, platform, external_property_id)
  WHERE external_property_id IS NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select indexname from pg_indexes where tablename = 'reservation_feeds';
--   -- attendu : reservation_feeds_unique_ical et reservation_feeds_unique_api
-- ══════════════════════════════════════════════════════════════════════════════
