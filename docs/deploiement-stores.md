# Dossier de publication — App Store & Google Play

Tout ce qui sera demandé par les deux stores, rédigé à l'avance. La marche à
suivre technique est dans `mobile/README.md`.

---

## 1. Identité de l'application

| Élément | Valeur |
|---|---|
| Nom affiché | MonCleanerPro |
| Identifiant | `fr.moncleanerpro.app` (identique iOS et Android) |
| Catégorie | Professionnel / Productivité |
| Éditeur | MonCleanerPro (SAS, SIREN 930 098 926) |
| Site | https://moncleanerpro.fr |
| Assistance | info@moncleanerpro.fr — 07 83 43 17 00 |
| Confidentialité | https://moncleanerpro.fr/confidentialite |
| Suppression de compte | https://moncleanerpro.fr/suppression-compte |
| Classification | Tout public / 4+ |
| Langue | Français |
| Prix | Gratuite, sans achat intégré |

---

## 2. Textes de la fiche

### Description courte (Google Play, 80 caractères max)

> Missions, photos et rapports de nettoyage, sur le terrain comme au bureau.

### Sous-titre (App Store, 30 caractères max)

> Gestion des interventions

### Description longue

> MonCleanerPro est l’application des équipes de MonCleanerPro et de ses clients
> professionnels : hôtels, résidences, conciergeries et propriétaires de
> locations courte durée.
>
> **Pour les intervenants**
> • Le planning du jour, trié par proximité
> • Les consignes d’accès de chaque logement, photos et vidéo à l’appui
> • Les étapes de l’intervention à cocher, même sans réseau
> • Les photos avant/après et le rapport de fin de mission
> • Une notification dès qu’une mission est attribuée ou modifiée
>
> **Pour les clients professionnels**
> • Déposer une demande d’intervention en quelques secondes
> • Suivre l’avancement et consulter les rapports
> • Retrouver devis et factures
> • Synchroniser un calendrier de réservations (Airbnb, Booking, PMS)
>
> **Conçue pour le terrain**
> Les interventions se préparent souvent dans un sous-sol ou une cage
> d’escalier : l’application continue de fonctionner sans réseau et enregistre
> le travail dès que la connexion revient.
>
> L’accès est réservé aux comptes MonCleanerPro. Les clients professionnels
> peuvent créer un compte depuis l’application ; les comptes intervenants sont
> créés par l’entreprise.

### Mots-clés (App Store, 100 caractères)

> ménage,nettoyage,hôtel,airbnb,conciergerie,planning,intervention,checklist,mission

---

## 3. Visuels à produire

| Store | Élément | Format |
|---|---|---|
| Les deux | Icône | 1024 × 1024 px, sans transparence, sans coins arrondis |
| Play | Image de présentation | 1024 × 500 px |
| Play | Captures téléphone | 2 à 8, min. 1080 px de large |
| App Store | Captures iPhone 6,7" | 1290 × 2796 px, 3 minimum |
| App Store | Captures iPhone 6,5" | 1242 × 2688 px, 3 minimum |

Écrans à capturer, dans cet ordre — ils racontent une journée de travail :
1. `/cleaner` — les missions du jour
2. une mission ouverte, avec les consignes d’accès
3. la liste d’étapes en cours
4. le rapport de fin avec photos
5. `/admin` — la vue d’ensemble (capture Play uniquement)

> L’icône existe déjà : `public/icon-512.png`. La version 1024 px est à
> exporter depuis le même fichier source.

---

## 4. Confidentialité — réponses aux formulaires

Mêmes réponses des deux côtés (Google « Sécurité des données », Apple
« App Privacy »). **Aucune donnée n’est utilisée à des fins publicitaires ni
partagée avec des tiers à des fins commerciales.**

| Donnée collectée | Pourquoi | Liée à l’identité | Suivi publicitaire |
|---|---|---|---|
| Nom, email, téléphone | Compte et contact | Oui | Non |
| Adresse postale | Localiser l’intervention | Oui | Non |
| Photos | Rapports d’intervention | Oui | Non |
| Position approximative | Trier les missions par proximité | Oui | Non |
| Identifiants de connexion | Authentification | Oui | Non |
| Données d’utilisation | Mesure d’audience sans cookie (Vercel) | Non | Non |

À cocher également :
- Les données transitent **chiffrées** (HTTPS de bout en bout) : oui
- L’utilisateur peut **demander la suppression** de ses données : oui →
  https://moncleanerpro.fr/suppression-compte
- Collecte de données **facultative** : la position peut être refusée sans
  empêcher l’usage de l’application.

Sous-traitants à mentionner si le formulaire le demande : Vercel (hébergement,
UE/USA), Supabase (base de données, UE), Hostinger (envoi des emails).

---

## 5. Notes pour les validateurs

À coller dans « App Review Information » (Apple) et « Accès à l’application »
(Google). **Sans compte de démonstration, le refus est automatique** : les deux
stores refusent une application dont ils ne peuvent pas passer l’écran de
connexion.

> L’application est réservée aux clients et aux équipes de MonCleanerPro,
> entreprise de nettoyage professionnel basée à Lyon (France). Un compte de
> démonstration est fourni ci-dessous.
>
> Identifiant : demo-cleaner@moncleanerpro.fr
> Mot de passe : (à compléter)
>
> Ce compte donne accès à l’espace « intervenant » avec des missions fictives :
> planning, consignes d’accès, étapes à cocher, photos et rapport de fin.
>
> Les notifications sont envoyées lorsqu’une mission est créée ou modifiée par
> un administrateur ; elles ne peuvent pas être déclenchées depuis ce compte.
>
> La suppression du compte est accessible dans l’application : onglet Profil →
> « Supprimer mon compte ». Elle est immédiate et confirmée par mot de passe.
> Merci de ne pas l’utiliser sur le compte de démonstration.

**Compte de démonstration à créer avant l’envoi** : un compte `cleaner` actif,
avec 3 ou 4 missions fictives réparties sur la semaine, dont une terminée avec
photos et rapport. À ne pas supprimer entre deux mises à jour : Apple le
réutilise à chaque validation.

---

## 6. Points de refus les plus probables

| Risque | Store | Parade |
|---|---|---|
| « Minimum functionality » (règle 4.2) : l’app ressemble à un site | Apple | Insister dans les notes sur le mode hors-ligne, les notifications, l’appareil photo et le public professionnel. En cas de refus, répondre en détaillant ces quatre points — c’est souvent accepté au second passage. |
| Suppression de compte absente (règle 5.1.1 v) | Apple + Google | Déjà en place : Profil → Supprimer mon compte. |
| Compte de démonstration manquant ou expiré | Apple + Google | Vérifier qu’il fonctionne **la veille** de chaque envoi. |
| Textes d’autorisation absents dans Info.plist | Apple | Tableau fourni dans `mobile/README.md`. |
| Barre d’adresse visible dans l’app Android | Google | `ANDROID_SHA256_FINGERPRINTS` mal renseignée — vérifier `/.well-known/assetlinks.json`. |
| Application vide à l’ouverture si le réseau est coupé | Les deux | Le service worker sert `/offline` ; à tester en mode avion avant l’envoi. |

---

## 7. Ordre de marche recommandé

1. Passer `supabase/migration_mobile_apps.sql`.
2. Déployer le site (les routes `/.well-known/` doivent répondre).
3. Créer le compte de démonstration et ses missions fictives.
4. **Android** : clé de signature → bundle → test fermé (14 jours si compte
   particulier) → production.
5. **Apple** : App ID + clé APNs → variables Vercel → projet Xcode sur un Mac →
   TestFlight → validation.
6. Tester les notifications sur un vrai iPhone via TestFlight avant l’envoi
   final.
