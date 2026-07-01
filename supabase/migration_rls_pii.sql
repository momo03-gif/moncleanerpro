-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — RLS : verrouillage PII partenaires/clients
-- (hotels, airbnb_partners, hotel_requests)
-- À exécuter dans Supabase > SQL Editor, APRÈS le déploiement du code qui route
-- ces tables via /api/partners (sinon les pages Admin comptes / Hôtel cassent
-- entre l'activation RLS et le déploiement).
--
-- Après refonte : ces 3 tables ne sont plus lues/écrites qu'en service_role via
--   • /api/partners        (listes, taux, refus, demandes, validation)
--   • /api/admin/users      (approbation compte)
--   • /api/auth/login|register (statut compte, création)
-- RLS deny-all → la clé anon (qui pouvait lire TOUTES les coordonnées clients/
-- partenaires + les demandes) est coupée. Cf. migration_rh_security.sql.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE hotels          ENABLE ROW LEVEL SECURITY;
ALTER TABLE airbnb_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE hotel_requests  ENABLE ROW LEVEL SECURITY;

-- Pas de FORCE (service_role bypasse) ; aucune policy anon = refus total public.

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION (client clé ANON) — attendu : 0 chacune :
--   select count(*) from hotels;
--   select count(*) from airbnb_partners;
--   select count(*) from hotel_requests;
-- Via /api/partners (service_role) : les données réelles s'affichent.
-- ══════════════════════════════════════════════════════════════════════════════
