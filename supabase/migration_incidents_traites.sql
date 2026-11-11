-- ── Incidents traités ────────────────────────────────────────────────────────
--
-- Un incident signalé sur un rapport de fin de mission (dégât, problème)
-- restait « à traiter » pour toujours : rien ne permettait de le clore, et la
-- tuile rouge du tableau de bord ne retombait jamais.
--
-- On note QUAND et PAR QUI il a été traité. Le constat lui-même (`issues`) ne
-- bouge pas : l'historique du logement reste intact.
--
-- Sans risque : deux colonnes facultatives, aucune donnée modifiée.
-- À exécuter dans Supabase → SQL Editor, AVANT la mise en ligne du code.

alter table public.mission_reports
  add column if not exists issues_resolved_at timestamptz,
  add column if not exists issues_resolved_by text;

-- Le tableau de bord ne lit que les incidents ouverts.
create index if not exists mission_reports_incidents_ouverts
  on public.mission_reports (updated_at desc)
  where issues is not null and issues_resolved_at is null;
