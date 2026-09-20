-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Verrouillage de `reservations`
-- À exécuter dans Supabase > SQL Editor. Idempotent.
-- ⚠️ L'éditeur découpe les blocs `do $$ … $$` sur les points-virgules : lancer
--    la partie 3 dans une exécution séparée.
--
-- CE QUE CETTE TABLE CONTIENT : le nom et le téléphone des VOYAGEURS de nos
-- clients, et `raw`, l'évènement de calendrier brut, qui porte lui-même des
-- coordonnées (lien de réservation, derniers chiffres du numéro). Ce ne sont ni
-- nos données ni celles de nos clients : ce sont celles de leurs voyageurs, que
-- nous ne détenons que pour ouvrir une porte le jour du ménage.
--
-- LE PROBLÈME : lue avec la clé publique, la table livrait les coordonnées de
-- TOUS les voyageurs de TOUS les partenaires à quiconque les demandait.
--
-- CE QUE LES ÉCRANS AFFICHENT VRAIMENT : des dates, un statut, un logement. Ni
-- le nom du voyageur, ni son téléphone n'apparaissent nulle part — vérifié dans
-- les écrans partenaire et admin. Les colonnes sensibles peuvent donc être
-- retirées à la clé publique sans rien casser.
--
-- LE CONTACT DU TERRAIN, LUI, RESTE ACCESSIBLE : le cleaner devant une porte
-- fermée l'obtient par /api/reservations/contacts, qui vérifie que le ménage lui
-- est bien attribué et ne répond rien pour un ménage terminé.
--
-- ⚠️ AVANT D'EXÉCUTER : déployer le code qui restreint RESERVATION_SELECT et
-- fait passer le contact par la route. Sinon les tableaux de réservations
-- cessent de s'afficher.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Aucune écriture depuis le navigateur ─────────────────────────────────────
-- Les réservations ne sont écrites que par la synchronisation, côté serveur.
REVOKE INSERT, UPDATE, DELETE ON reservations FROM anon, authenticated;

-- 2) Lecture : les dates, pas les personnes ───────────────────────────────────
REVOKE SELECT ON reservations FROM anon, authenticated;
GRANT SELECT (
  id, feed_id, airbnb_id, partner_id, platform, status,
  check_in, check_out, check_in_time, check_out_time,
  mission_id, mission_created_at, created_at
) ON reservations TO anon, authenticated;
-- Restent hors d'atteinte : guest_name, guest_phone, guest_phone_last4,
-- reservation_url, external_uid, raw, updated_at.

-- 3) Ne plus diffuser cette table en temps réel ───────────────────────────────
-- À lancer SÉPARÉMENT. Sans RLS, Realtime diffusait chaque réservation ENTIÈRE
-- à tout abonné — téléphone du voyageur compris. Les écrans se rafraîchissent
-- après chaque synchronisation, ils n'ont pas besoin de ce flux.
-- ALTER PUBLICATION supabase_realtime DROP TABLE reservations;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION, avec la CLÉ PUBLIQUE (pas depuis l'éditeur SQL) :
--   · select id,check_out         → doit fonctionner
--   · select guest_phone          → doit être REFUSÉ (42501)
--   · select raw                  → doit être REFUSÉ
--   · insert                      → doit être REFUSÉ
-- ══════════════════════════════════════════════════════════════════════════════
