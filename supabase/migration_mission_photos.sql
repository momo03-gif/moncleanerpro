-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Photos avant/après des missions + demande de temps supplémentaire
-- À exécuter dans Supabase > SQL Editor (une seule fois).
--
-- Principes (stockage optimal, Supabase gratuit) :
--   • Les IMAGES vivent dans Supabase Storage (bucket « mission_photos »).
--   • La base ne stocke QUE des références légères (URL, chemin, mission, type, date).
--   • Suppression automatique des photos > 14 jours (cron) → bucket + références.
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1) TABLE DE RÉFÉRENCES (aucune image stockée ici) ─────────────────────────
CREATE TABLE IF NOT EXISTS mission_photos (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mission_id   UUID NOT NULL REFERENCES missions(id) ON DELETE CASCADE, -- mission associée
  kind         TEXT NOT NULL CHECK (kind IN ('before', 'after')),       -- type : avant / après
  url          TEXT NOT NULL,                                           -- URL publique du fichier
  storage_path TEXT NOT NULL,                                           -- chemin dans le bucket (pour suppression)
  uploaded_by  UUID REFERENCES users(id) ON DELETE SET NULL,           -- cleaner ayant envoyé la photo
  created_at   TIMESTAMPTZ DEFAULT NOW()                                -- date d'upload (base de la purge)
);

-- Index : lecture par mission (galerie) + purge par ancienneté (cron).
CREATE INDEX IF NOT EXISTS idx_mission_photos_mission ON mission_photos(mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_photos_created ON mission_photos(created_at);

-- Prototype : RLS désactivée (cohérent avec le reste du schéma).
ALTER TABLE mission_photos DISABLE ROW LEVEL SECURITY;

-- Realtime : la galerie se met à jour en direct quand le cleaner ajoute une photo.
ALTER PUBLICATION supabase_realtime ADD TABLE mission_photos;

-- ── 2) DEMANDE DE TEMPS SUPPLÉMENTAIRE (colonnes sur missions) ────────────────
-- Le cleaner peut demander plus de temps (appartement très sale, justifié par les
-- photos « avant »). L'admin approuve (→ la durée de la mission est augmentée et le
-- gain recalculé) ou refuse.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS extra_time_minutes      INTEGER;     -- minutes demandées
ALTER TABLE missions ADD COLUMN IF NOT EXISTS extra_time_reason       TEXT;        -- motif du cleaner
ALTER TABLE missions ADD COLUMN IF NOT EXISTS extra_time_status       TEXT
  CHECK (extra_time_status IN ('pending', 'approved', 'refused'));                 -- état de la demande
ALTER TABLE missions ADD COLUMN IF NOT EXISTS extra_time_requested_at TIMESTAMPTZ; -- horodatage demande

-- ── 3) BUCKET STORAGE DÉDIÉ ───────────────────────────────────────────────────
-- public = true → lecture par URL publique (admin consulte / télécharge).
-- Limites : 5 Mo/fichier, types image uniquement (sécurité + économie d'espace).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'mission_photos', 'mission_photos', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 4) POLICIES STORAGE (prototype : clé anon, cohérent RLS-off) ──────────────
-- Le client (cleaner) téléverse et lit ; le cron purge. Restreint au seul bucket.
DROP POLICY IF EXISTS "mission_photos_read"   ON storage.objects;
DROP POLICY IF EXISTS "mission_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "mission_photos_delete" ON storage.objects;

CREATE POLICY "mission_photos_read"   ON storage.objects
  FOR SELECT USING (bucket_id = 'mission_photos');
CREATE POLICY "mission_photos_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'mission_photos');
CREATE POLICY "mission_photos_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'mission_photos');
