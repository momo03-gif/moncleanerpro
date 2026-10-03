-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Réserve de fichiers `logos` (logo des conciergeries)
-- À exécuter dans Supabase > SQL Editor. Idempotent.
--
-- Le logo affiché sur la fiche d'accueil n'avait jamais pu être enregistré :
-- la réserve `logos` n'existait pas. Elle est publique en LECTURE (le logo
-- s'affiche sur une fiche imprimée) ; les dépôts passent par une autorisation
-- à usage unique délivrée par le serveur (cf. src/lib/depot.ts) — aucune
-- politique d'écriture publique n'est créée.
-- ══════════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('logos', 'logos', true, 2097152, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE
   SET public = EXCLUDED.public,
       file_size_limit = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;
