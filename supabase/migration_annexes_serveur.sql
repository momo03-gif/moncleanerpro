-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Fermeture des tables autour des missions (étape 3 du chantier)
-- À exécuter dans Supabase > SQL Editor. Idempotent.
--
-- Avec la clé publique (visible dans le site), on pouvait lire — et souvent
-- modifier — les photos des logements, les rapports de fin de ménage (dégâts,
-- objets oubliés), les réparations, les notifications de tout le monde, les
-- abonnements push, et toutes les données RH des cleaners (scores, incidents,
-- primes, dépenses). Tout passe désormais par le serveur, qui vérifie la
-- session : /api/annexes (cf. src/lib/annexes.ts) et les routes RH existantes.
--
-- ⚠️ AVANT D'EXÉCUTER : le code correspondant est en ligne (commit « Photos,
-- rapports, réparations, cloche… »). Idéalement depuis quelques heures, pour
-- que les téléphones aient rechargé l'application.
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Arrivée en direct des notifications SANS lecture publique ────────────────
-- La cloche écoutait la table elle-même. La base émet à la place un signal sur
-- le canal `notif-<userId>`, qui ne contient que le TYPE de notification.
CREATE OR REPLACE FUNCTION public.signaler_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    PERFORM realtime.send(jsonb_build_object('type', NEW.type), 'new', 'notif-' || NEW.user_id::text, false);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;  -- un signal raté ne doit jamais empêcher la notification
END;
$$;

DROP TRIGGER IF EXISTS trg_signaler_notification ON notifications;
CREATE TRIGGER trg_signaler_notification
AFTER INSERT ON notifications
FOR EACH ROW EXECUTE FUNCTION public.signaler_notification();

-- 2) Ménages récurrents rattachés au client du site ────────────────────────────
-- La génération automatique oubliait le client (partner_id) : ses ménages
-- n'apparaissaient pas dans son espace et il ne recevait pas « ménage
-- terminé ». Le code est corrigé ; on rattrape les lignes existantes.
UPDATE missions m
   SET partner_id = a.partner_id
  FROM airbnbs a
 WHERE a.id = m.airbnb_id
   AND m.partner_id IS NULL
   AND a.partner_id IS NOT NULL;

-- 3) Fermeture au public ───────────────────────────────────────────────────────
REVOKE ALL ON mission_photos     FROM anon, authenticated;
REVOKE ALL ON mission_reports    FROM anon, authenticated;
REVOKE ALL ON repairs            FROM anon, authenticated;
REVOKE ALL ON notifications      FROM anon, authenticated;
REVOKE ALL ON push_subscriptions FROM anon, authenticated;
-- RH : déjà lues et écrites uniquement par le serveur.
REVOKE ALL ON cleaner_rh         FROM anon, authenticated;
REVOKE ALL ON depenses           FROM anon, authenticated;
REVOKE ALL ON rh_config          FROM anon, authenticated;
REVOKE ALL ON rh_incidents       FROM anon, authenticated;
REVOKE ALL ON prime_requests     FROM anon, authenticated;
REVOKE ALL ON prime_types        FROM anon, authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION, avec la CLÉ PUBLIQUE : select sur chacune de ces tables → REFUSÉ.
-- Dans l'application : photos avant/après (cleaner, admin, conciergerie),
-- rapport de fin de ménage, réparations (signaler, confirmer), cloche (arrivée
-- en direct, « tout marquer lu »), activation des notifications push, fiche de
-- paie et écrans RH.
-- RETOUR ARRIÈRE (en cas de souci), table par table :
--   grant select, insert, update, delete on <table> to anon, authenticated;
-- ══════════════════════════════════════════════════════════════════════════════
