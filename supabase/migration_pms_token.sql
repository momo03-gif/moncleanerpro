-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Jeton OAuth2 des connexions PMS
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Les gros logiciels (Guesty en tête) ne donnent pas une clé permanente : ils
-- donnent un identifiant et un secret, qu'on échange contre un JETON de courte
-- durée. Et ils en limitent sévèrement la délivrance — Guesty n'en accorde que
-- quelques-uns par tranche de 24 h et par application.
--
-- Sur Vercel, chaque exécution peut démarrer à froid, avec une mémoire vide. Un
-- jeton conservé seulement en mémoire serait donc redemandé à chaque synchro,
-- à chaque ouverture de l'espace partenaire… et le quota du client serait épuisé
-- en une journée. Pire : c'est SON accès à SON compte qu'on couperait.
--
-- D'où ces deux colonnes : le jeton vit avec le flux qui s'en sert, et n'est
-- renouvelé qu'à l'approche de son expiration.
--
-- ⚠️ Un jeton est un IDENTIFIANT, au même titre que `api_key`. Il ne doit jamais
-- partir vers le navigateur : les lectures client sélectionnent des colonnes
-- explicites (cf. FEED_SELECT dans src/lib/db/reservations.ts). Ne pas y ajouter
-- ces colonnes, et ne jamais remettre d'étoile.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE reservation_feeds ADD COLUMN IF NOT EXISTS api_token            TEXT;
ALTER TABLE reservation_feeds ADD COLUMN IF NOT EXISTS api_token_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN reservation_feeds.api_token IS
  'Jeton OAuth2 en cours de validité. Identifiant : ne jamais exposer au client.';

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select column_name from information_schema.columns
--    where table_name = 'reservation_feeds' and column_name like 'api_token%';
--   -- attendu : api_token, api_token_expires_at
--
-- NB : tant que cette migration n'est pas jouée, tout fonctionne — le jeton est
-- simplement gardé en mémoire le temps de l'exécution, ce qui consomme plus de
-- jetons chez l'éditeur.
-- ══════════════════════════════════════════════════════════════════════════════
