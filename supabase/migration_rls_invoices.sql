-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — RLS : verrouillage de la table `invoices` (facturation)
-- À exécuter dans Supabase > SQL Editor, APRÈS le déploiement du code qui route
-- getInvoicesDB/saveInvoiceDB via /api/admin/finance (sinon la page Facturation
-- casse entre l'activation RLS et le déploiement).
--
-- Après refonte : `invoices` n'est plus lue/écrite qu'en service_role via
-- /api/admin/finance (admin only, session). RLS deny-all → la clé anon (qui pouvait
-- lire TOUTES les factures + en insérer) est coupée. Cf. migration_rls_financial.sql.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Pas de FORCE (service_role bypasse) ; aucune policy anon = refus total public.

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION (client clé ANON) :  select count(*) from invoices;  -- attendu : 0
-- Via /api/admin/finance?type=invoices (service_role) : les factures s'affichent.
-- ══════════════════════════════════════════════════════════════════════════════
