-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Formations et dépôt de fichiers fermés au public (étape 4)
-- À exécuter dans Supabase > SQL Editor. Idempotent.
--
-- 1) Formations : lisibles ET modifiables avec la clé publique — on pouvait
--    effacer une vidéo, ou marquer « terminée » la formation obligatoire d'un
--    cleaner. Tout passe par /api/formation (cf. src/app/api/formation/route.ts).
--
-- 2) Fichiers : les réserves `mission_photos` (photos de ménage, réparations,
--    checklists) et `receipts` (justificatifs de dépenses) acceptaient dépôt,
--    LISTE et SUPPRESSION avec la clé publique. Le navigateur dépose désormais
--    avec une autorisation à usage unique délivrée par le serveur (cf.
--    src/lib/depot.ts). Les fichiers restent lisibles par leur adresse (les
--    réserves sont « publiques » en lecture), mais plus personne ne peut en
--    déposer, en lister ou en effacer sans passer par le serveur.
--
-- ⚠️ AVANT D'EXÉCUTER : le code correspondant est en ligne (commit
-- « Formations et dépôt de fichiers… »).
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Formations ───────────────────────────────────────────────────────────────
REVOKE ALL ON formation_categories  FROM anon, authenticated;
REVOKE ALL ON formations            FROM anon, authenticated;
REVOKE ALL ON formation_assignments FROM anon, authenticated;

-- 2) Fichiers ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS mission_photos_insert ON storage.objects;
DROP POLICY IF EXISTS mission_photos_delete ON storage.objects;
DROP POLICY IF EXISTS mission_photos_read   ON storage.objects;  -- permettait de LISTER
DROP POLICY IF EXISTS receipts_insert       ON storage.objects;
DROP POLICY IF EXISTS receipts_delete       ON storage.objects;
DROP POLICY IF EXISTS receipts_read         ON storage.objects;

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   · clé publique : select sur formations → REFUSÉ ; dépôt direct dans
--     mission_photos → REFUSÉ ; une photo existante reste lisible par son URL.
--   · application : photo avant/après d'un ménage, photo de réparation, photo
--     modèle d'un point de checklist, reçu d'une dépense, onglet Formation du
--     cleaner (voir et valider), gestion des formations côté admin.
-- RETOUR ARRIÈRE (en cas de souci) :
--   grant select, insert, update, delete on formations, formation_categories,
--     formation_assignments to anon, authenticated;
--   create policy mission_photos_insert on storage.objects for insert to public
--     with check (bucket_id = 'mission_photos');   -- (idem receipts)
-- ══════════════════════════════════════════════════════════════════════════════
