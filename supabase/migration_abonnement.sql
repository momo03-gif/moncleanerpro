-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Abonnement ménage régulier, sans engagement
-- À exécuter dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Le moteur de récurrence existe déjà (recurring_missions) : jours de la semaine,
-- heure, durée, prix, début/fin, génération sur 180 jours. Il lui manque deux
-- choses pour porter une OFFRE plutôt qu'un planning interne.
--
-- 1) LA FRÉQUENCE. On savait dire « tous les mardis ». Une offre grand public se
--    vend en « chaque semaine / une semaine sur deux / une fois par mois ».
--    `interval_weeks` porte cela : 1, 2 ou 4. La parité se compte depuis la
--    première intervention (cf. occurrenceDates dans recurringDates.ts).
--
-- 2) LE CLIENT. La récurrence est rattachée à un site ou à une adresse libre,
--    jamais à un compte. Sans `client_id`, le client ne peut ni voir son
--    abonnement, ni le suspendre, ni l'arrêter — et « sans engagement » ne veut
--    plus rien dire s'il faut téléphoner pour s'arrêter.
--
-- La règle d'annulation (libre jusqu'à 24 h avant, due ensuite) est une règle
-- métier, pas une donnée : elle vit dans src/lib/abonnement.ts.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE recurring_missions
  ADD COLUMN IF NOT EXISTS interval_weeks INTEGER NOT NULL DEFAULT 1
  CHECK (interval_weeks IN (1, 2, 4));

ALTER TABLE recurring_missions
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Le client met son abonnement en pause sans l'arrêter (vacances, travaux).
-- Distinct de `active`, qui sert à l'admin pour désactiver un planning interne.
ALTER TABLE recurring_missions
  ADD COLUMN IF NOT EXISTS paused_until DATE;

CREATE INDEX IF NOT EXISTS idx_recurring_client ON recurring_missions(client_id, active);

COMMENT ON COLUMN recurring_missions.interval_weeks IS
  'Frequence : 1 = chaque semaine, 2 = une semaine sur deux, 4 = une fois par mois.';

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select interval_weeks, count(*) from recurring_missions group by 1;
--   -- attendu : tous en 1, les plannings existants ne changent pas de rythme
--
-- Pas de GRANT à ajouter : `recurring_missions` n'a pas de droits par colonne.
-- ⚠️ Cette table reste d'ailleurs ouverte en lecture ET en écriture à la clé
-- publique — n'importe qui peut créer ou arrêter une récurrence. À verrouiller
-- comme les autres, une fois ses écritures passées par une route serveur.
-- ══════════════════════════════════════════════════════════════════════════════
