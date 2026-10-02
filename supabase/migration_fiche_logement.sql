-- ════════════════════════════════════════════════════════════════════════════
--  MonCleanerPro — Fiche d'accueil d'un logement
--
--  POURQUOI
--  Une conciergerie passe son temps à répondre aux mêmes questions : le code
--  du wifi, où sont les poubelles, à quelle heure il faut partir. Une fiche
--  posée dans le logement y répond une fois pour toutes — et un QR wifi évite
--  au voyageur de recopier une clé de vingt caractères sur un téléphone.
--
--  CE QU'ON AJOUTE : uniquement ce qui se met sur une fiche. Le reste de la
--  table décrit déjà le bien (accès, contact, linge, tarif).
--
--  ⚠️ CES CHAMPS SONT DESTINÉS AU VOYAGEUR. Les codes d'accès existants
--  (`code_portail`, `code_boite`) n'ont RIEN à faire sur une fiche laissée dans
--  le logement : le voyageur est déjà entré, et les y écrire revient à donner
--  l'accès à tous les suivants. Ils restent réservés à la fiche interne.
-- ════════════════════════════════════════════════════════════════════════════

-- ── Wifi ────────────────────────────────────────────────────────────────────
-- Le nom du réseau et sa clé servent à produire un QR « WIFI:… » que le
-- téléphone comprend : un scan, et le voyageur est connecté sans rien taper.
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS wifi_ssid     TEXT;
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS wifi_password TEXT;
-- Type de sécurité, pour que le QR soit valide. WPA couvre WPA/WPA2/WPA3.
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS wifi_security TEXT
  CHECK (wifi_security IS NULL OR wifi_security IN ('WPA', 'WEP', 'nopass'));

-- ── Ce qu'on nous demande tout le temps ─────────────────────────────────────
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS checkin_time   TEXT;   -- « à partir de 16h »
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS checkout_time  TEXT;   -- « avant 11h »
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS poubelles      TEXT;   -- où, et quel jour
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS parking        TEXT;
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS equipements    TEXT;   -- lave-linge, chauffage…
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS consignes_depart TEXT; -- ce qu'on attend au départ
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS a_proximite    TEXT;   -- boulangerie, métro, pharmacie

-- ── Le jeton de la fiche publique ───────────────────────────────────────────
-- La fiche est consultable sans compte : elle est affichée dans le logement, et
-- un voyageur n'ouvrira jamais une session pour lire un code wifi. Le jeton est
-- donc la seule protection — il doit être impossible à deviner, et se
-- régénérer si une fiche part dans la nature.
ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS fiche_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_airbnbs_fiche_token
  ON airbnbs(fiche_token) WHERE fiche_token IS NOT NULL;

-- ── Le logo de la conciergerie ──────────────────────────────────────────────
-- Une fiche posée chez un voyageur porte le nom de la conciergerie, pas le
-- nôtre : c'est son accueil, pas notre prestation. Le logo vit dans le Storage,
-- on ne garde ici que son adresse publique et son chemin (pour le remplacer).
ALTER TABLE users ADD COLUMN IF NOT EXISTS logo_url  TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS logo_path TEXT;
