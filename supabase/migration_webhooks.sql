-- ════════════════════════════════════════════════════════════════════════════
--  MonCleanerPro — Réception des webhooks de réservation
--
--  POURQUOI
--  Un lien iCal se relit deux fois par jour et ne dit jamais si une période est
--  un séjour vendu ou une date fermée. Un webhook, lui, arrive à la seconde où
--  le voyageur réserve, et il ANNONCE ce qu'il est. C'est la seule voie qui
--  supprime l'ambiguïté au lieu de la contourner — et elle ne demande aucune
--  clé d'API : c'est le logiciel du client qui nous appelle.
--
--  CE QUE CETTE TABLE GARDE
--  Tout ce qu'on reçoit, y compris ce qu'on n'a pas su lire. Un webhook dont on
--  ignore la forme ne doit pas être jeté : sans l'évènement sous les yeux, on
--  en est réduit à deviner le nom des champs — ce qui a coûté deux jours sur
--  Lodgify et SuperHote. On le conserve, on le montre, on complète le lecteur.
--
--  ⚠️ Le corps peut contenir le nom et le contact du voyageur de notre client.
--  Cette table est donc fermée au navigateur (deny-all), lue uniquement par les
--  routes serveur en service_role, et purgée passé 30 jours.
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS webhook_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- À quel partenaire appartient le logiciel qui nous a appelés.
  partner_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  -- Le logiciel (superhote, lodgify…), déduit de l'abonnement utilisé.
  source        TEXT NOT NULL,
  -- Corps reçu tel quel : c'est LUI qui nous apprend la forme de l'éditeur.
  payload       JSONB NOT NULL,
  -- Ce qu'on en a fait. 'ignore' = lu mais sans intérêt (ping, test).
  resultat      TEXT NOT NULL DEFAULT 'recu'
                CHECK (resultat IN ('recu', 'rattache', 'illisible', 'logement_inconnu', 'ignore')),
  -- La réservation créée ou mise à jour, quand le rattachement a réussi.
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  -- Pourquoi ça n'a pas marché, en clair, pour l'écran d'administration.
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_partner
  ON webhook_events(partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_resultat
  ON webhook_events(resultat, created_at DESC);

-- ── Abonnement : une URL par partenaire, porteuse d'un secret ────────────────
-- Le secret EST l'authentification : l'éditeur ne signe pas toujours ses appels,
-- et une URL impossible à deviner reste la garantie la plus simple à tenir. Il
-- se régénère sans toucher aux logements connectés.
CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,
  -- Partie secrète de l'URL de réception. Unique, et jamais réaffichée ailleurs.
  secret      TEXT NOT NULL UNIQUE,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_seen_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (partner_id, source)
);

-- ── Verrouillage ────────────────────────────────────────────────────────────
-- Mêmes règles que le reste des données de nos clients : le navigateur n'y
-- touche jamais, tout passe par les routes serveur.
ALTER TABLE webhook_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON webhook_events        FROM anon, authenticated;
REVOKE ALL ON webhook_subscriptions FROM anon, authenticated;

-- Purge : un évènement de plus de 30 jours n'a plus de valeur de diagnostic, et
-- il porte des données de voyageurs. À appeler depuis le cron existant.
-- ⚠️ Délimiteur NOMMÉ (`$func$`) et non `$$` : l'éditeur SQL de Supabase coupe
-- le script sur `$$` et le corps de la fonction repart alors comme une requête
-- de premier niveau — « syntax error at or near DELETE ».
CREATE OR REPLACE FUNCTION purge_webhook_events() RETURNS void
LANGUAGE sql AS $func$
  DELETE FROM webhook_events WHERE created_at < NOW() - INTERVAL '30 days';
$func$;
