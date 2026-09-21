-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Fin du verrouillage : tarifs, profit_config, recurring_missions,
-- invoices.
-- À exécuter dans Supabase > SQL Editor. Idempotent.
--
-- ⚠️ À N'EXÉCUTER QU'APRÈS LE DÉPLOIEMENT DU CODE QUI L'ACCOMPAGNE.
-- Les écrans qui écrivaient ces tables depuis le navigateur ont été repointés
-- sur des routes serveur (session admin vérifiée, service_role) :
--   · tarifs             → /api/admin/tarifs          (la route existait, lib/devis.ts
--                                                      écrivait encore en direct)
--   · profit_config      → /api/admin/profit-config   (nouvelle)
--   · recurring_missions → /api/admin/recurring       (nouvelle)
-- Lancer ce SQL avant le déploiement casserait la grille tarifaire, l'onglet
-- Rentabilité et les ménages récurrents.
--
-- LA RÈGLE QU'ON S'EST DONNÉE APRÈS L'INCIDENT DES MISSIONS : un `revoke` ne
-- part JAMAIS seul. On révoque tout, puis on re-donne explicitement ce dont
-- l'application a encore besoin — ici, la seule lecture publique de `tarifs`.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. tarifs — lecture publique, écriture fermée ───────────────────────────
-- La page /devis-en-ligne est publique : un visiteur sans compte doit pouvoir
-- lire la grille pour obtenir une estimation. C'est la seule raison pour
-- laquelle le SELECT reste ouvert. L'écriture, elle, changeait les prix du site
-- avec la clé publique.
REVOKE ALL ON tarifs FROM anon, authenticated;
GRANT SELECT ON tarifs TO anon, authenticated;

-- ── 2. profit_config — rien à voir depuis un navigateur ─────────────────────
-- Coût des produits, marge visée, taux de charges d'un CDI, prix ET coût d'un
-- kit de linge : de quoi reconstituer ce que l'entreprise gagne sur un ménage.
REVOKE ALL ON profit_config FROM anon, authenticated;

-- ── 3. recurring_missions — un planning fabrique des missions ───────────────
-- Créer un planning matérialise des missions, et une mission porte un prix
-- client et un gain cleaner. Écrire cette table revenait à écrire la paie.
REVOKE ALL ON recurring_missions FROM anon, authenticated;

-- ── 4. invoices — plus rien ne la lit depuis le navigateur ──────────────────
-- Les factures passent toutes par /api/factures (le partenaire ne voit que les
-- siennes, le chemin du fichier ne sort jamais) et /api/admin/finance.
REVOKE ALL ON invoices FROM anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION — avec la CLÉ PUBLIQUE (anon), dans l'application ou en REST :
--   select * from tarifs;              -- ✅ doit RÉPONDRE (page de devis publique)
--   insert into tarifs ...;            -- ❌ doit être REFUSÉ (42501)
--   select * from profit_config;       -- ❌ REFUSÉ
--   select * from recurring_missions;  -- ❌ REFUSÉ
--   select * from invoices;            -- ❌ REFUSÉ
--
-- Puis, CONNECTÉ EN ADMIN dans l'application, vérifier que ces trois écrans
-- fonctionnent toujours — c'est le vrai test :
--   · /admin/devis       → onglet grille tarifaire : créer, modifier, importer
--   · /admin/stats       → onglet Rentabilité : lire et enregistrer les réglages
--   · /admin/missions    → créer / modifier / désactiver un ménage récurrent
--
-- CE QUI RESTE OUVERT, EN CONNAISSANCE DE CAUSE : la lecture de `missions` et
-- d'`airbnbs` par la clé publique. Les écrans cleaner et partenaire les lisent
-- encore en direct ; les fermer demande de repointer une dizaine d'écrans, et
-- les colonnes sensibles (paie, codes d'accès, téléphones) sont DÉJÀ fermées
-- colonne par colonne. À traiter comme un chantier à part.
-- ══════════════════════════════════════════════════════════════════════════════
