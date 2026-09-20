-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Verrouillage de `devis`
-- À exécuter dans Supabase > SQL Editor. Idempotent.
--
-- CE QUE CETTE TABLE CONTIENT : le fichier prospects. Nom, e-mail, téléphone et
-- ADRESSE de chaque personne qui a demandé un devis, plus le détail chiffré de
-- ce qu'on lui a proposé et le statut de la négociation.
--
-- LE PROBLÈME : lue avec la clé publique, elle livrait ce fichier en entier à
-- qui le demandait. Écrite avec la même clé, elle laissait modifier un montant,
-- un statut, ou créer des devis de toutes pièces.
--
-- APRÈS CETTE MIGRATION, plus rien n'est accessible au navigateur :
--   · l'administration lit et écrit par /api/devis (session admin exigée) ;
--   · le client ouvre SON devis par /api/devis/public, où le jeton du lien fait
--     foi — un seul devis, jamais la liste ;
--   · les demandes du formulaire public arrivent par /api/devis-request, qui
--     écrit en service_role après le filtre anti-robot.
--
-- ⚠️ AVANT D'EXÉCUTER : déployer le code qui fait passer lecture ET écriture par
-- ces routes. Sinon l'écran des devis se vide et le lien client ne s'ouvre plus.
-- ══════════════════════════════════════════════════════════════════════════════

REVOKE ALL ON devis FROM anon, authenticated;

-- Aucun GRANT en retour : contrairement à `reservations`, aucun écran ne lit
-- cette table depuis le navigateur. Tout passe par le serveur.

-- Ne plus diffuser la table en temps réel — à lancer SÉPARÉMENT, l'éditeur
-- Supabase découpe les blocs sur les points-virgules :
-- ALTER PUBLICATION supabase_realtime DROP TABLE devis;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION, avec la CLÉ PUBLIQUE :
--   · select * from devis        → doit être REFUSÉ (42501)
--   · insert                     → doit être REFUSÉ
-- Et dans l'application, connecté en admin :
--   · /admin/devis affiche bien la liste
--   · le lien public d'un devis s'ouvre et permet d'accepter ou de refuser
-- ══════════════════════════════════════════════════════════════════════════════
