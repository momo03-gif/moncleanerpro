-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Verrouillage de `reservation_feeds`
-- À exécuter dans Supabase > SQL Editor. Idempotent.
--
-- CE QUE CETTE TABLE CONTIENT : les clés API des conciergeries. Une clé Hostify
-- ouvre l'INTÉGRALITÉ du compte de gestion du client — ses réservations, ses
-- voyageurs, ses tarifs, sur tous ses logements. Ce n'est pas notre secret,
-- c'est celui d'un client qui nous l'a confié.
--
-- LE PROBLÈME : la table était lisible ET écrivable par le rôle `anon`, c'est-à-
-- dire par la clé publique que n'importe qui lit dans le code de la page. Le
-- code applicatif évitait soigneusement de sélectionner les colonnes secrètes,
-- mais rien n'empêchait de les demander directement.
--
-- POURQUOI DES DROITS PAR COLONNE PLUTÔT QUE LA RLS : l'application n'utilise
-- pas Supabase Auth. Tout navigateur est `anon`, quel que soit l'utilisateur
-- connecté — une politique RLS ne saurait donc pas distinguer un partenaire d'un
-- autre. Ce qui protège vraiment ici, c'est de retirer le droit d'écrire et le
-- droit de lire les colonnes sensibles. L'identité, elle, est vérifiée par les
-- routes serveur, qui écrivent en service_role (lequel ignore ces restrictions).
--
-- ⚠️ AVANT D'EXÉCUTER : déployer le code qui fait passer les écritures par
-- /api/reservations/feeds. Sinon connecter, mettre en pause ou déconnecter un
-- calendrier échoue — c'est exactement ce qui est arrivé à la checklist.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Plus aucune écriture depuis le navigateur ────────────────────────────────
REVOKE INSERT, UPDATE, DELETE ON reservation_feeds FROM anon, authenticated;

-- 2) Lecture : tout sauf les identifiants ─────────────────────────────────────
-- On retire la lecture globale, puis on la rend colonne par colonne. `api_key`,
-- `api_secret`, `api_token` et `api_token_expires_at` restent hors d'atteinte.
REVOKE SELECT ON reservation_feeds FROM anon, authenticated;
GRANT SELECT (
  id, airbnb_id, partner_id, platform, ical_url, label, active,
  last_sync_at, last_sync_status, last_error, created_at,
  connection_kind, external_property_id
) ON reservation_feeds TO anon, authenticated;

-- 3) Ne plus diffuser cette table en temps réel ───────────────────────────────
-- Realtime s'appuie sur la RLS pour filtrer ; sans RLS, chaque modification
-- était diffusée ENTIÈRE à tout abonné — clé API comprise. L'écran partenaire
-- se rafraîchit de toute façon après chaque action, il n'a pas besoin du flux
-- temps réel sur cette table.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime DROP TABLE reservation_feeds;
EXCEPTION WHEN OTHERS THEN NULL;   -- déjà retirée, ou publication absente
END $$;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — avec la CLÉ PUBLIQUE (anon), pas depuis l'éditeur SQL :
--
--   · lire les colonnes normales  → doit fonctionner
--   · lire api_key                → doit être REFUSÉ (42501)
--   · insérer une ligne           → doit être REFUSÉ (42501)
--
-- En SQL, pour contrôler les droits accordés :
--   select grantee, privilege_type, column_name
--     from information_schema.column_privileges
--    where table_name = 'reservation_feeds' and grantee = 'anon'
--    order by column_name;
--   -- attendu : aucune ligne pour api_key, api_secret, api_token
-- ══════════════════════════════════════════════════════════════════════════════
