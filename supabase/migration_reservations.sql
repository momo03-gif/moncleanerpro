-- ══════════════════════════════════════════════════════════════════
-- MonCleanerPro — Migration « Synchronisation des réservations »
-- À exécuter UNE FOIS dans Supabase > SQL Editor (idempotent).
--
-- Périmètre : conciergeries / partenaires Airbnb UNIQUEMENT.
-- Les hôtels ne sont pas concernés (ils créent leurs missions à la main).
--
-- Principe : chaque appartement (table `airbnbs`) peut être connecté à un ou
-- plusieurs flux de calendrier (iCal) provenant des plateformes de réservation.
-- Les réservations importées sont stockées puis transformées automatiquement
-- en missions de ménage le jour du départ (check-out).
-- ══════════════════════════════════════════════════════════════════

-- 1) Flux de synchronisation (un par couple appartement × plateforme) ─────────
CREATE TABLE IF NOT EXISTS reservation_feeds (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  airbnb_id       UUID REFERENCES airbnbs(id) ON DELETE CASCADE,           -- appartement connecté
  partner_id      UUID REFERENCES users(id)   ON DELETE SET NULL,          -- partenaire (compte), NULL si géré admin
  platform        TEXT NOT NULL DEFAULT 'ical',                            -- airbnb / booking / guesty / hostaway / lodgify / smoobu / beds24 / amenitiz / ical / other
  ical_url        TEXT NOT NULL,                                           -- URL d'export iCal de la plateforme
  label           TEXT,                                                    -- libellé libre (ex. « Annonce Airbnb T2 »)
  active          BOOLEAN DEFAULT TRUE,
  last_sync_at    TIMESTAMPTZ,
  last_sync_status TEXT,                                                   -- 'ok' / 'error'
  last_error      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservation_feeds_airbnb  ON reservation_feeds(airbnb_id);
CREATE INDEX IF NOT EXISTS idx_reservation_feeds_partner ON reservation_feeds(partner_id);

-- 2) Réservations importées ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reservations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feed_id         UUID REFERENCES reservation_feeds(id) ON DELETE CASCADE,
  airbnb_id       UUID REFERENCES airbnbs(id) ON DELETE CASCADE,
  partner_id      UUID REFERENCES users(id)   ON DELETE SET NULL,
  platform        TEXT NOT NULL DEFAULT 'ical',
  external_uid    TEXT NOT NULL,                                           -- UID iCal (clé de déduplication)
  guest_name      TEXT,                                                    -- souvent anonymisé par Airbnb / Booking
  status          TEXT CHECK (status IN ('confirmed', 'cancelled', 'tentative', 'blocked')) DEFAULT 'confirmed',
  check_in        DATE,                                                    -- arrivée
  check_out       DATE,                                                    -- départ (= jour du ménage)
  check_in_time   TIME,                                                    -- si disponible (souvent absent en iCal)
  check_out_time  TIME,                                                    -- si disponible
  raw             JSONB DEFAULT '{}',                                      -- évènement iCal brut (traçabilité)
  mission_id      UUID REFERENCES missions(id) ON DELETE SET NULL,         -- mission ménage créée pour ce départ
  mission_created_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  -- Déduplication : un même évènement (UID) n'existe qu'une fois par flux.
  CONSTRAINT reservations_feed_uid_unique UNIQUE (feed_id, external_uid)
);

CREATE INDEX IF NOT EXISTS idx_reservations_airbnb   ON reservations(airbnb_id);
CREATE INDEX IF NOT EXISTS idx_reservations_partner  ON reservations(partner_id);
CREATE INDEX IF NOT EXISTS idx_reservations_checkout ON reservations(check_out);
CREATE INDEX IF NOT EXISTS idx_reservations_mission  ON reservations(mission_id);

-- 3) Marquage des missions issues d'une synchro (lecture seule, info admin) ────
ALTER TABLE missions ADD COLUMN IF NOT EXISTS auto_synced BOOLEAN DEFAULT FALSE;

-- 4) RLS désactivée (cohérent avec le reste du prototype) ─────────────────────
ALTER TABLE reservation_feeds DISABLE ROW LEVEL SECURITY;
ALTER TABLE reservations      DISABLE ROW LEVEL SECURITY;
GRANT ALL ON reservation_feeds TO anon, authenticated, service_role;
GRANT ALL ON reservations      TO anon, authenticated, service_role;

-- 5) Realtime (optionnel) ─────────────────────────────────────────────────────
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE reservation_feeds;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
