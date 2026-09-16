-- ══════════════════════════════════════════════════════════════════════════════
--  MonCleanerPro — Applications mobiles (App Store / Google Play)
--
--  1) native_push_tokens : notifications sur l'app iOS.
--     Le Web Push (VAPID, table push_subscriptions) NE FONCTIONNE PAS dans la
--     coquille native iOS (WKWebView). iOS impose son propre canal, APNs, qui
--     s'adresse à un « device token » fourni par le système à chaque appareil.
--     On garde donc DEUX canaux en parallèle : web (Android/desktop/PWA) et
--     natif (iOS). Un même utilisateur peut avoir les deux.
--
--  2) users.deleted_at : suppression de compte demandée depuis l'app.
--     Apple (règle 5.1.1(v)) et Google exigent que tout compte créé dans l'app
--     puisse être supprimé DEPUIS l'app. On anonymise plutôt que de supprimer
--     la ligne : les missions, factures et bulletins de paie déjà émis doivent
--     rester cohérents et sont soumis à des durées de conservation légales.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1) Jetons de notification natifs ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS native_push_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT,
  platform TEXT CHECK (platform IN ('ios', 'android')) NOT NULL,
  token TEXT UNIQUE NOT NULL,          -- device token APNs (hex) ou FCM
  bundle_id TEXT,                      -- topic APNs (= identifiant du bundle)
  environment TEXT CHECK (environment IN ('production', 'sandbox')) DEFAULT 'production',
  app_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_native_push_user ON native_push_tokens(user_id);

-- Jamais lue ni écrite avec la clé publique : tout passe par des routes
-- serveur (service_role). On refuse donc explicitement le rôle anon.
ALTER TABLE native_push_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS native_push_tokens_deny_anon ON native_push_tokens;
CREATE POLICY native_push_tokens_deny_anon ON native_push_tokens
  FOR ALL TO anon USING (false) WITH CHECK (false);

-- ── 2) Suppression de compte ────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Journal des suppressions : sert de preuve en cas de réclamation RGPD et de
-- contrôle Apple/Google. Ne contient AUCUNE donnée personnelle réutilisable.
CREATE TABLE IF NOT EXISTS account_deletions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,                        -- pas de FK : la ligne survit à l'user
  role TEXT,
  reason TEXT,
  requested_from TEXT,                 -- 'ios' | 'android' | 'web'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE account_deletions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_deletions_deny_anon ON account_deletions;
CREATE POLICY account_deletions_deny_anon ON account_deletions
  FOR ALL TO anon USING (false) WITH CHECK (false);
