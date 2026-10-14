-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Synchronisation des réservations toutes les heures
-- À exécuter dans Supabase > SQL Editor. Idempotent.
--
-- L'offre Vercel gratuite n'autorise que 2 tâches planifiées, déjà prises par
-- les rappels (6 h et 18 h UTC), qui lancent aussi la synchro au passage. Une
-- réservation prise le matin ne devenait donc un ménage que le soir — ou quand
-- quelqu'un ouvrait l'écran des réservations.
--
-- La base appelle elle-même la route de synchronisation, à HH:05, toutes les
-- heures. Le mot de passe (CRON_SECRET) est lu dans le coffre à secrets de
-- Supabase (Vault, secret « cron_secret ») : il n'est écrit dans aucun fichier.
-- Pour le (re)définir :
--   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
--
-- Une synchro complète prend environ 1 min 30 : délai d'attente de 5 min.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remplace la tâche si elle existe déjà (idempotent).
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'synchro-reservations-horaire';

SELECT cron.schedule(
  'synchro-reservations-horaire',
  '5 * * * *',
  $$
  SELECT net.http_get(
    url := 'https://app.moncleanerpro.fr/api/cron/reservations',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    timeout_milliseconds := 300000
  );
  $$
);

-- ══════════════════════════════════════════════════════════════════════════════
-- SUIVI :
--   · exécutions : select status, start_time, return_message from cron.job_run_details
--       where jobid = (select jobid from cron.job where jobname = 'synchro-reservations-horaire')
--       order by start_time desc limit 10;
--   · réponses   : select status_code, created, left(content, 200) from net._http_response
--       order by created desc limit 10;
--   · fraîcheur  : select max(last_sync_at) from reservation_feeds where active;
-- ARRÊT :
--   select cron.unschedule('synchro-reservations-horaire');
-- ══════════════════════════════════════════════════════════════════════════════
