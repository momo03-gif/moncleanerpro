# Espace conciergerie — le meilleur de chacun

*Étude du 14/08/2026. Six concurrents passés en revue : **Hostaway**, **Hostify**, **Superhote**, **Yaago**, **Breezeway**, **Turno** (et **Properly** en appoint). Objectif : que la conciergerie soit mieux servie chez nous que chez eux.*

**Limite de méthode, à assumer :** aucun de ces produits n'a de démo accessible sans compte commercial. Ce qui suit est leur périmètre **annoncé** (pages produit, blogs, fiches d'app), comparé à notre code réel (`/airbnb/*`, `lib/reservationSync.ts`, `lib/db.ts`). Les points incertains sont signalés.

---

## 1. Ce que chacun fait de mieux — et ce qu'on en a pris

| Concurrent | Sa force | Notre réponse |
|---|---|---|
| **Breezeway** | Checklists dynamiques par logement, **photo de référence** dans l'app, notation 5 étoiles, inventaire avec alerte stock bas, rapports propriétaire | Checklists + photo modèle + notation + liste de réappro : **fait** |
| **Properly** | Checklists **visuelles** (le résultat attendu en photo) | Photo modèle par point : **fait** |
| **Turno** | Inventaire des consommables, paiement automatique des équipes, place de marché de cleaners | Réappro : **fait**. Paie cleaner : déjà automatique chez nous. Place de marché : sans objet — nous *sommes* l'équipe |
| **Hostaway** | Multi-calendrier, statuts en temps réel, règles d'affectation auto, KPI d'exploitation | Multi-calendrier + préparation en direct + vue performance : **fait**. Affectation auto : à faire, côté admin |
| **Hostify** | Portail propriétaire en marque blanche, relevés filtrables, rôles personnalisés | Relevé propriétaire mensuel PDF + photos : **fait**. Portail par propriétaire : volontairement non repris (voir §3) |
| **Superhote** | Connexion des annonces fluide, calendrier multi-vues, paiement prestataires calculé sur les tâches faites | Parcours de connexion en un écran avec vérification du lien : **fait** |
| **Yaago** | Génération auto des tâches par séjour, photos/vidéos depuis le mobile, suivi des tâches en direct | Déjà en place (synchro iCal → ménage auto, photos avant/après, statuts) |

---

## 2. Les huit chantiers livrés

1. **Préparation du logement en direct** — « Prêt à 12h35 · 2h avant l'arrivée de 15h », et en rouge « arrivée à 15h, ménage pas commencé ». Sur le tableau de bord, le planning et la fiche ménage. *Nous répondons à la question ; eux affichent un statut.*
2. **Checklists par logement** — la conciergerie définit son standard (modèle de départ de 14 points fourni), l'intervenant coche, la conciergerie voit la conformité X/Y avec l'heure de chaque point. Un point retiré est archivé, jamais supprimé : l'historique reste honnête.
3. **Photo de référence par point** — une photo vaut trois lignes de consignes.
4. **Notation du ménage** — 1 à 5 avec un mot, donnée par la conciergerie. *Chez Breezeway la note vient d'un inspecteur interne ; ici elle vient du client, donc elle vaut plus.*
5. **Liste de réapprovisionnement** — les consommables signalés en fin de ménage deviennent une liste de courses, avec mémoire du « racheté » et alerte quand un article revient plusieurs ménages de suite.
6. **Multi-calendrier** — logements × jours : occupation, arrivées, départs, état du ménage. Les départs **sans ménage prévu** sont signalés en creux — c'est le trou qui coûte cher, et personne ne l'affiche.
7. **Connexion d'un logement en un écran** — logement créé à la volée, plateforme **devinée** depuis le lien collé, et lien **vérifié avant enregistrement** (« 12 réservations, prochain départ le 18 août »). *Hostaway et Hostify font enregistrer puis découvrir l'échec à la première synchro.*
8. **Relevé propriétaire mensuel** — ménages, coût, ponctualité, note, incidents, photos ; export PDF et partage, sous le nom de la conciergerie. Plus une **vue performance** par logement sur le tableau de bord.

---

## 3. Ce qu'on refuse volontairement de copier

- **Un portail par propriétaire** (Hostify, Hostaway). Nous ne sommes pas un PMS : le propriétaire du bien est le client de notre client. Lui ouvrir un compte doublonnerait l'outil de la conciergerie et brouillerait qui parle à qui. Un relevé propre qu'elle transmet sous son nom est le bon niveau.
- **La place de marché de cleaners** (Turno, Properly). Leur difficulté — trouver quelqu'un de fiable — est notre métier. Chez nous, « commander » suffit.
- **La durée de ménage visible côté partenaire.** Elle pilote la paie des intervenants : elle reste interne. On expose l'heure de **fin** (le logement est prêt), jamais l'heure de début ni la durée.

---

## 4. Ce qu'on a et qu'ils n'ont pas

- **Mode hors-ligne réel** côté intervenant (lecture IndexedDB + file d'écritures rejouée). Aucun des six ne l'annonce.
- **Vidéo d'accès par logement** — plus efficace qu'un champ « code porte » pour un immeuble compliqué.
- **Réparations qui vivent sur le logement**, pas sur la mission : ouvertes jusqu'à confirmation.
- **Devis et commande de prestation en ligne** depuis l'espace partenaire.
- **Paiement du parking** rattaché à la mission, **pointage GPS**, **zones de tournée**.
- Nous **sommes** l'entreprise de nettoyage : eux coordonnent des prestataires qu'il faut d'abord trouver.

---

## 5. Ce qui reste

- **Règles d'affectation automatique** des cleaners (Hostaway) — manque côté *admin*, visible côté conciergerie sous la forme « non assigné » pendant des jours.
- **Checklist hors-ligne** — cocher exige aujourd'hui du réseau, comme les photos et le compte-rendu. À intégrer à la file d'attente existante.
- **Suivi du linge** — nécessiterait un vrai stock ; l'inventaire consommables couvre déjà l'essentiel.
- **Connecteur API channel manager** — seulement si l'utilisateur adopte un Smoobu/Beds24/Hostaway. L'iCal reste la seule voie en direct.

---

### Migrations à exécuter dans Supabase (SQL Editor)

1. `supabase/migration_checklists.sql` — checklists + photo de référence
2. `supabase/migration_mission_rating.sql` — notation des ménages
3. `supabase/migration_supplies.sql` — réapprovisionnement

---

### Sources

- [Hostaway — Automatiser les tâches de ménage](https://www.hostaway.com/blog/automate-cleaning-tasks/)
- [Hostaway — Coordination des équipes de ménage](https://www.hostaway.com/blog/improve-coordination-among-cleaning-teams/)
- [Hostify — Task app](https://hostify.com/features/task-app)
- [Hostify — Owners portal](https://hostify.com/features/owners-portal)
- [Superhote](https://superhote.com/)
- [Yaago — app équipe](https://apps.apple.com/fr/app/yaago/id1612682305)
- [Breezeway vs Turno](https://www.breezeway.io/blog/turno-vs-breezeway)
- [Breezeway — checklists](https://www.breezeway.io/checklists-mobile-app)
