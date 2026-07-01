-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — RLS : verrouillage des tables FINANCE/PAIE server-only
-- À exécuter dans Supabase > SQL Editor (une fois). Idempotent.
--
-- Contexte : auth maison (clé anon en navigateur, pas de Supabase Auth →
-- auth.uid() toujours NULL). Modèle de sécurité = « deny-all anon + service_role
-- via routes serveur » (comme rh/depenses/parking). Cf. migration_rh_security.sql.
--
-- Ces 3 tables ne sont accédées QUE par des routes serveur en service_role :
--   • payments, company_info      → /api/admin/finance   (getServerDb = service_role)
--   • payroll_adjustments         → src/lib/rhEngine.ts   (service_role)
-- → Activer la RLS deny-all ne casse RIEN : service_role contourne la RLS ;
--   la clé anon (aujourd'hui capable de tout lire/écrire ici) est coupée.
--
-- PRÉREQUIS : SUPABASE_SERVICE_ROLE_KEY défini côté serveur (déjà en place).
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE payments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_info        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_adjustments ENABLE ROW LEVEL SECURITY;

-- Pas de FORCE (service_role doit continuer à bypasser). Aucune policy pour anon
-- = refus total pour la clé publique.

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION (depuis un client en clé ANON) — attendu : 0 / erreur permission :
--   select count(*) from payments;
--   select count(*) from company_info;
--   select count(*) from payroll_adjustments;
-- Via les routes serveur (service_role) : les données réelles s'affichent toujours.
-- ══════════════════════════════════════════════════════════════════════════════
