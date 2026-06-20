-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Sécurité RH (LOT 4). À exécuter EN DERNIER.
--
-- ✅ PRÊT À EXÉCUTER EN ENTIER (PARTIE A + PARTIE B).
-- L'app admin ET l'app cleaner partagent la même clé ANON (auth maison, pas de
-- Supabase Auth → auth.uid() est toujours NULL). La stratégie retenue
-- (confidentialité côté serveur) est désormais EN PLACE des deux côtés :
--   • CLEANER : aucune lecture RH directe ; badges via /api/rh/cleaner-badges
--     (service_role), qui ne renvoie que des données non sensibles.
--   • ADMIN  : toutes les lectures/écritures RH passent par des routes serveur
--     en service_role — /api/admin/rh, /api/admin/payroll, /api/admin/depenses
--     (+ /api/rh/cleaner-badges). service_role contourne la RLS.
-- → Activer la RLS « deny-all anon » ci-dessous ne casse donc plus aucun écran :
--   un cleaner (clé anon) lit 0 ligne ; l'admin lit via le serveur.
--
-- PRÉREQUIS : variable d'env serveur SUPABASE_SERVICE_ROLE_KEY définie sur Vercel
-- (sans préfixe NEXT_PUBLIC). Sans elle, les routes serveur retombent sur anon et
-- renverraient 0 ligne une fois la RLS active.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── PARTIE A — Vue « missions non sensibles » pour les cleaners ────────────────
-- N'expose PAS price, cleaner_gain ni les snapshots de paie. Un cleaner ne lit que
-- ces colonnes (via cette vue), jamais la table missions complète.
CREATE OR REPLACE VIEW cleaner_missions_public AS
SELECT
  id, cleaner_id, cleaner_name, type, source, status,
  airbnb_id, partner_id, property_name, address,
  date_from, time_from, time_to,
  mission_duration_minutes,           -- durée (info terrain, pas un montant)
  next_arrival, next_arrival_time,
  started_at, ended_at,
  instructions, created_at
FROM missions;
-- (Aucune colonne de prix/gain ici : price, cleaner_gain, *_snapshot sont exclues.)

-- ── PARTIE B — Activation RLS « deny-all anon » (lecture admin = service_role) ──
-- À exécuter UNIQUEMENT après avoir migré les lectures admin RH côté serveur.
-- service_role contourne la RLS automatiquement ; le rôle anon n'a aucune policy
-- → 0 ligne renvoyée à un cleaner qui interrogerait ces tables directement.

ALTER TABLE rh_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cleaner_rh      ENABLE ROW LEVEL SECURITY;
ALTER TABLE rh_incidents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE prime_types     ENABLE ROW LEVEL SECURITY;
ALTER TABLE prime_requests  ENABLE ROW LEVEL SECURITY;
ALTER TABLE depenses        ENABLE ROW LEVEL SECURITY;

-- Pas de FORCE : on laisse service_role bypasser. Aucune policy pour anon =
-- refus total pour la clé publique (cleaner inclus).
-- (Si plus tard l'app migre vers Supabase Auth, ajouter ici des policies
--  « auth.jwt() ->> 'role' = 'admin' » au lieu du modèle service_role.)

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION (à lancer après PARTIE B), depuis un client en clé ANON :
--   select count(*) from rh_config;       -- attendu : 0
--   select count(*) from cleaner_rh;      -- attendu : 0
--   select count(*) from rh_incidents;    -- attendu : 0
--   select count(*) from prime_requests;  -- attendu : 0
--   select count(*) from depenses;        -- attendu : 0
-- Et depuis une route serveur en service_role : les comptes réels s'affichent.
-- ══════════════════════════════════════════════════════════════════════════════
