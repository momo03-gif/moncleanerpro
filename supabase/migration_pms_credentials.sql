-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Connexion par API à un logiciel de gestion (PMS)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Pourquoi : l'iCal ne transporte que des DATES. Départ tardif, arrivée
-- anticipée, nombre de voyageurs, modification en temps réel : rien de tout ça
-- n'y figure. Le PMS de la conciergerie (Smoobu, Beds24…) expose ces champs via
-- son API, et il donne une clé à SES PROPRES clients — aucun programme
-- partenaire, aucune validation Airbnb à obtenir.
--
-- Un flux (`reservation_feeds`) devient donc soit un lien iCal, soit une
-- connexion API, d'où `connection_kind`. Le reste de la chaîne (réservations,
-- création des ménages, anti-doublon) ne change pas.
--
-- ⚠️ SÉCURITÉ : `api_key` et `api_secret` sont des IDENTIFIANTS. Ils ne doivent
-- JAMAIS partir vers le navigateur. Les requêtes client sélectionnent désormais
-- des colonnes explicites (plus de `select *` sur cette table) et l'écriture
-- passe par une route serveur. Ne pas réintroduire d'étoile ici.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE reservation_feeds ADD COLUMN IF NOT EXISTS connection_kind TEXT NOT NULL DEFAULT 'ical'
  CHECK (connection_kind IN ('ical', 'api'));
ALTER TABLE reservation_feeds ADD COLUMN IF NOT EXISTS api_key              TEXT;
ALTER TABLE reservation_feeds ADD COLUMN IF NOT EXISTS api_secret           TEXT;
-- Identifiant du logement CHEZ le PMS (Smoobu : apartments[].id).
ALTER TABLE reservation_feeds ADD COLUMN IF NOT EXISTS external_property_id TEXT;

-- Le lien iCal devient facultatif : une connexion API n'en a pas.
ALTER TABLE reservation_feeds ALTER COLUMN ical_url DROP NOT NULL;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select connection_kind, count(*) from reservation_feeds group by 1;
--   -- attendu : tous les flux existants en 'ical'
-- ══════════════════════════════════════════════════════════════════════════════
