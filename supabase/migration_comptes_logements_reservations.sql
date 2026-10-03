-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Comptes, logements et réservations fermés au public (étape 5)
-- À exécuter dans Supabase > SQL Editor. Idempotent.
--
-- Avec la clé publique (visible dans le site), on pouvait encore lire :
--   · les 23 comptes, avec e-mail et téléphone ;
--   · les 63 logements (adresses, coordonnées GPS, prix clients) ;
--   · les 30 flux de synchronisation, avec leur LIEN iCal (qui ouvre le
--     calendrier d'un client à qui le détient) ;
--   · les 257 séjours.
-- Les écrans lisent désormais par le serveur : /api/airbnbs (action 'list'),
-- /api/reservations/lire, /api/annexes ('admins', 'user-fiche').
--
-- ⚠️ AVANT D'EXÉCUTER : le code correspondant est en ligne (commit « Comptes,
-- logements et réservations : lecture par le serveur »).
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Temps réel des écrans de réservations SANS lecture publique ────────────────
-- Une synchronisation réécrit des dizaines de lignes d'un coup : un signal par
-- REQUÊTE (et non par ligne), sans aucune donnée, sur le canal `reservations`.
CREATE OR REPLACE FUNCTION public.signaler_changement_reservations()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM realtime.send('{}'::jsonb, 'change', 'reservations', false);
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;  -- un signal raté ne doit jamais faire échouer une synchronisation
END;
$$;

DROP TRIGGER IF EXISTS trg_signaler_reservations ON reservations;
CREATE TRIGGER trg_signaler_reservations
AFTER INSERT OR UPDATE OR DELETE ON reservations
FOR EACH STATEMENT EXECUTE FUNCTION public.signaler_changement_reservations();

DROP TRIGGER IF EXISTS trg_signaler_flux ON reservation_feeds;
CREATE TRIGGER trg_signaler_flux
AFTER INSERT OR UPDATE OR DELETE ON reservation_feeds
FOR EACH STATEMENT EXECUTE FUNCTION public.signaler_changement_reservations();

-- 2) Fermeture de la lecture publique ─────────────────────────────────────────
-- (Les droits d'écriture publics avaient déjà été retirés.)
-- `cleaners` reste lisible sur id/nom/statut : listes de sélection, voulu.
REVOKE SELECT ON users             FROM anon, authenticated;
REVOKE SELECT ON airbnbs           FROM anon, authenticated;
REVOKE SELECT ON reservations      FROM anon, authenticated;
REVOKE SELECT ON reservation_feeds FROM anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION, avec la CLÉ PUBLIQUE : select sur ces 4 tables → REFUSÉ.
-- Dans l'application : écran Sites (admin) et carte des zones, espace
-- conciergerie (logements, fiche, réservations, connexions), écran
-- Réservations (admin), création d'un rendez-vous (liste des admins),
-- tableau de bord admin (flux en erreur).
-- RETOUR ARRIÈRE (en cas de souci) : les droits de lecture exacts d'avant
-- (par colonne), relevés le 04/10/2026 :
--   GRANT SELECT (access_video_path, access_video_url, address, bedrooms, beds, cleaner_id, client_price, created_at, estimated_cleaning_minutes, group_tiers, id, latitude, linge_forfait, linge_kits, linge_libelle, linge_mode, longitude, name, parent_airbnb_id, partner_id, partner_name, product_cost_cents, sofa_beds, structure_label, structure_type, zone_color, zone_id, zone_name) ON airbnbs TO anon, authenticated;
--   GRANT SELECT (active, airbnb_id, connection_kind, created_at, external_property_id, ical_url, id, label, last_error, last_sync_at, last_sync_status, partner_id, platform) ON reservation_feeds TO anon, authenticated;
--   GRANT SELECT (airbnb_id, check_in, check_in_time, check_out, check_out_time, created_at, feed_id, id, mission_created_at, mission_id, partner_id, platform, status) ON reservations TO anon, authenticated;
--   GRANT SELECT (created_at, email, id, name, phone, role, status) ON users TO anon, authenticated;
-- ══════════════════════════════════════════════════════════════════════════════
