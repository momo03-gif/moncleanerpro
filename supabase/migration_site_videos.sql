-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Vidéo d'accès par site (logement)
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent. Purement additif.
--
-- Chaque site (appartement) peut porter UNE vidéo courte expliquant l'accès :
-- comment s'y rendre, où trouver la clé / la boîte à clé, comment entrer. Le
-- cleaner la voit sur sa mission. Elle peut être ajoutée, remplacée ou supprimée
-- à tout moment. Le fichier vit dans Supabase Storage ; la table ne garde que
-- l'URL publique + le chemin (pour pouvoir supprimer le fichier).
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS access_video_url  TEXT;  -- URL publique de la vidéo
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS access_video_path TEXT;  -- chemin Storage (pour suppression)

-- ══════════════════════════════════════════════════════════════════════════════
-- ⚠️ ÉTAPE MANUELLE (Storage) — À FAIRE UNE FOIS dans Supabase > Storage :
--   1. Créer un bucket nommé exactement :  site_videos
--   2. Le marquer « Public » (les vidéos doivent être lisibles par les cleaners).
--   3. Ajouter une policy autorisant l'upload/suppression (comme le bucket
--      mission_photos existant). Le plus simple : copier les policies de
--      mission_photos sur site_videos (INSERT / DELETE / SELECT).
--
-- VÉRIFICATION :
--   select access_video_url from airbnbs limit 1;   -- la colonne existe (NULL au départ)
-- ══════════════════════════════════════════════════════════════════════════════
