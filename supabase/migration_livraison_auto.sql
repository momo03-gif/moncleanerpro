-- ══════════════════════════════════════════════════════════════════════════════
-- MonCleanerPro — Livraison créée avec son ménage.
-- À exécuter dans Supabase > SQL Editor. Idempotent. Purement additif.
-- ⚠️ À EXÉCUTER AVANT LE DÉPLOIEMENT : la liste des logements lit la colonne.
--
-- Un logement peut avoir besoin d'une livraison (linge) à chaque ménage : elle
-- est alors créée avec le ménage, SANS livreur — l'admin les assigne en lot.
-- La livraison garde le lien vers son ménage : elle le suit quand il change de
-- date, et disparaît avec lui s'il est annulé. Cf. src/lib/livraisonAuto.ts.
-- ══════════════════════════════════════════════════════════════════════════════

ALTER TABLE airbnbs ADD COLUMN IF NOT EXISTS needs_delivery BOOLEAN NOT NULL DEFAULT false;

-- SET NULL, pas CASCADE : une livraison déjà faite garde sa paie même si son
-- ménage disparaît. Le retrait des livraisons à venir est fait par le code.
ALTER TABLE missions ADD COLUMN IF NOT EXISTS linked_mission_id UUID REFERENCES missions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS missions_linked_mission_id_idx ON missions(linked_mission_id) WHERE linked_mission_id IS NOT NULL;

REVOKE ALL (needs_delivery) ON airbnbs FROM anon, authenticated;
REVOKE ALL (linked_mission_id) ON missions FROM anon, authenticated;

-- Pré-remplissage : les logements livrés ces 60 derniers jours.
UPDATE airbnbs SET needs_delivery = true
WHERE needs_delivery = false AND id IN (
  SELECT DISTINCT airbnb_id FROM missions
  WHERE service = 'delivery' AND airbnb_id IS NOT NULL AND date_from >= current_date - 60
);

-- Les livraisons À VENIR déjà créées à la main sont rattachées au ménage du même
-- logement le même jour : elles suivront désormais ses changements.
UPDATE missions d SET linked_mission_id = (
  SELECT c.id FROM missions c
  WHERE c.airbnb_id = d.airbnb_id AND c.date_from = d.date_from
    AND coalesce(c.service, 'cleaning') = 'cleaning'
  ORDER BY c.created_at LIMIT 1
)
WHERE d.service = 'delivery' AND d.linked_mission_id IS NULL
  AND d.airbnb_id IS NOT NULL AND d.date_from >= current_date;

-- Les ménages DÉJÀ prévus (synchro, récurrents…) à partir de demain reçoivent
-- leur livraison, sans livreur — une seule par logement et par jour, jamais en
-- double d'une livraison existante. Même règle que src/lib/livraisonRegles.ts.
INSERT INTO missions (type, source, service, airbnb_id, partner_id, date_from, time_from,
  mission_duration_minutes, hours_worked, price, cleaner_gain, created_by, created_by_role,
  linked_mission_id, status)
SELECT DISTINCT ON (c.airbnb_id, c.date_from)
  'regular', 'airbnb', 'delivery', c.airbnb_id, c.partner_id, c.date_from, c.time_from,
  30, 0.5, 0, 0, NULL, 'system', c.id, 'pending'
FROM missions c
JOIN airbnbs a ON a.id = c.airbnb_id AND a.needs_delivery
WHERE coalesce(c.service, 'cleaning') = 'cleaning'
  AND c.status IN ('pending', 'assigned')
  AND c.date_from > current_date
  AND NOT EXISTS (
    SELECT 1 FROM missions d
    WHERE d.service = 'delivery' AND d.airbnb_id = c.airbnb_id AND d.date_from = c.date_from
  )
ORDER BY c.airbnb_id, c.date_from, c.created_at;
