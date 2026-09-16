-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — « La clé n'est pas dans la boîte » : qui appeler
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Le cleaner est devant la porte, la boîte à clé est vide. Aujourd'hui il n'a
-- personne à joindre : la mission porte l'adresse, les codes et les directives,
-- aucun humain. Deux niveaux, du plus fiable au plus limité :
--
--   1) LE CONTACT DE SECOURS DU LOGEMENT (`airbnbs`) — propriétaire, conciergerie
--      ou gardien. Marche toujours, quelle que soit la source des réservations,
--      et c'est presque toujours la bonne personne : le voyageur est déjà parti,
--      celui qui peut ouvrir est le gestionnaire.
--
--   2) LE VOYAGEUR (`reservations`) — quand la source le donne :
--        · connexion API d'un PMS → nom ET téléphone, donc un appel possible ;
--        · iCal Airbnb → pas de nom, mais les 4 derniers chiffres du téléphone
--          et le lien de la réservation (écrire au voyageur depuis Airbnb) ;
--        · iCal des autres plateformes → parfois un nom, jamais un numéro.
--
-- ⚠️ DONNÉES PERSONNELLES : un téléphone de voyageur ne sert qu'à exécuter le
-- ménage en cours. Il n'est affiché qu'au cleaner assigné, sur sa mission, et
-- n'est repris dans aucun e-mail, aucune facture, aucun export.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Contact de secours du logement ───────────────────────────────────────────
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS on_site_contact_name  TEXT;
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS on_site_contact_phone TEXT;

COMMENT ON COLUMN airbnbs.on_site_contact_name IS
  'Qui appeler si l''accès échoue (propriétaire, conciergerie, gardien).';

-- 2) Contact du voyageur, tel que la source le fournit ────────────────────────
-- `guest_name` existe déjà (SUMMARY iCal / nom renvoyé par l'API).
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_phone       TEXT;  -- API PMS uniquement
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS guest_phone_last4 TEXT;  -- iCal Airbnb
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS reservation_url   TEXT;  -- lien vers la conversation

-- Le cleaner lit le contact par MISSION : c'est le chemin d'accès, il doit être
-- indexé (l'index sur mission_id existe déjà, cf. migration_reservations.sql).

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select column_name from information_schema.columns
--    where table_name = 'reservations' and column_name like 'guest%';
--   -- attendu : guest_name, guest_phone, guest_phone_last4
--
-- NB : tant que cette migration n'est pas jouée, tout continue de fonctionner —
-- la synchro détecte l'absence des colonnes et importe sans elles, les écrans
-- n'affichent simplement aucun contact.
-- ══════════════════════════════════════════════════════════════════════════════
