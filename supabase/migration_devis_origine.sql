-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — D'où vient une demande de devis
-- À exécuter UNE FOIS dans Supabase > SQL Editor. Idempotent.
--
-- Pourquoi : les demandes reçues jusqu'ici portent toutes la même étiquette
-- (`partner_type = 'devis'`). Impossible de dire si un client vient d'une page
-- SEO, de l'accueil ou d'un lien direct — donc impossible de savoir quel contenu
-- rapporte, et la prochaine décision de référencement se prendrait au jugé.
--
-- La colonne stocke une chaîne courte et lisible :
--   '/femme-de-menage-lyon'  page interne d'où le visiteur est arrivé
--   'google.com'             domaine externe qui l'a envoyé
--   'direct'                 aucun référent
--   'flyer-villeurbanne'     campagne déclarée via ?src= (hors-ligne)
--
-- VIE PRIVÉE : la requête est retirée de l'URL avant enregistrement (un référent
-- peut transporter des paramètres personnels). Voir src/lib/origin.ts.
--
-- Le code TOLÈRE l'absence de la colonne : tant que cette migration n'est pas
-- passée, les demandes s'enregistrent normalement, sans l'origine.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE devis ADD COLUMN IF NOT EXISTS origine TEXT;
COMMENT ON COLUMN devis.origine IS
  'Page ou canal d''où provient la demande. Sert à mesurer ce que rapporte chaque contenu.';

-- Index léger : l'admin regroupera les demandes par origine pour comparer.
CREATE INDEX IF NOT EXISTS devis_origine_idx ON devis (origine);

-- ── Reprise de l'existant ─────────────────────────────────────────────────────
-- Les demandes antérieures restent sans origine : l'information n'a jamais été
-- collectée, et l'inventer fausserait les comparaisons à venir. L'écran
-- d'administration les affiche « Non renseignée ».

-- ══════════════════════════════════════════════════════════════════════════════
-- VÉRIFICATION :
--   select origine, count(*) from devis group by origine order by count(*) desc;
--   -- attendu : 'Non renseignée' (NULL) pour l'historique, puis les pages réelles
-- ══════════════════════════════════════════════════════════════════════════════
