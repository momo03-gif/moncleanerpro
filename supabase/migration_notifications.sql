-- ══════════════════════════════════════════════
-- MonCleanerPro — Système de notifications
-- Notifications in-app + abonnements push (Web Push)
-- ══════════════════════════════════════════════

-- Notifications affichées dans l'application (cloche + liste)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,   -- destinataire
  role TEXT,                                              -- admin | cleaner | partner
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT,                                              -- mission_created | mission_new | mission_modified | mission_cancelled | mission_completed | reminder_today | reminder_tomorrow
  mission_id UUID,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read, created_at DESC);

-- Abonnements push (un appareil = un endpoint)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role TEXT,
  endpoint TEXT UNIQUE NOT NULL,
  subscription JSONB NOT NULL,
  device_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

ALTER TABLE notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions DISABLE ROW LEVEL SECURITY;

-- Temps réel pour la cloche (badge + liste live)
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
