-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Temps réel des missions SANS lecture publique (étape 2a)
-- À exécuter dans Supabase > SQL Editor, DÈS que le code est en ligne. Idempotent.
--
-- Les écrans (planning admin, cleaner, conciergerie) se mettaient à jour en
-- écoutant la table elle-même — ce qui exige qu'elle soit lisible avec la clé
-- publique. À la place, la base diffuse un simple signal « une mission a
-- changé » sur le canal public `missions`, avec l'identifiant pour seule
-- donnée. L'écran recharge alors par le serveur (cf. src/lib/missionsLive.ts).
--
-- Sans danger à exécuter tout de suite : l'ancienne écoute continue de marcher
-- jusqu'à l'étape 2b, les deux coexistent.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.signaler_changement_mission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Aucune donnée de la mission : seulement son identifiant.
  PERFORM realtime.send(
    jsonb_build_object('id', COALESCE(NEW.id, OLD.id)),
    'change',      -- événement écouté par missionsLive.ts
    'missions',    -- canal
    false          -- canal public : pas d'authentification Supabase dans l'app
  );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  -- Un signal raté ne doit JAMAIS faire échouer l'écriture d'une mission.
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_signaler_changement_mission ON missions;
CREATE TRIGGER trg_signaler_changement_mission
AFTER INSERT OR UPDATE OR DELETE ON missions
FOR EACH ROW EXECUTE FUNCTION public.signaler_changement_mission();

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION : ouvrir le planning admin dans un onglet, modifier une mission
-- dans un autre (ou depuis le téléphone d'un cleaner) → le planning se met à
-- jour seul en une seconde environ.
-- ══════════════════════════════════════════════════════════════════════════════
