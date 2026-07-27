-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Prise de rendez-vous en ligne (après validation d'un devis)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent.
-- Accès uniquement via routes serveur (service_role) ; la page publique lit les
-- créneaux occupés (date + heure, sans PII) via /api/appointment.
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS appointments (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ref_code      TEXT,                       -- RDV-AAAAMMJJ-HHMM
  devis_number  TEXT,                       -- devis lié (facultatif)
  client_name   TEXT,
  client_email  TEXT,
  client_phone  TEXT,
  message       TEXT,
  date          DATE NOT NULL,
  time          TEXT NOT NULL,              -- « 09:00 »
  status        TEXT NOT NULL DEFAULT 'confirmed'
                CHECK (status IN ('confirmed', 'cancelled', 'done')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_appt_date ON appointments(date);
-- Un seul rendez-vous par créneau (capacité 1 équipe). Retirer si multi-équipes.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_appt_slot
  ON appointments(date, time) WHERE status = 'confirmed';
