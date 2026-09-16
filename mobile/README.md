# MonCleanerPro — applications mobiles

Ce dossier contient de quoi fabriquer les deux applications à partir du site
existant. **Le site reste la seule base de code** : les deux applications
affichent `app.moncleanerpro.fr`. Une correction déployée sur Vercel est
immédiatement visible dans les applications, sans nouvelle validation des
stores.

```
mobile/
├── android/twa-manifest.json   → configuration Bubblewrap (Google Play)
└── ios/                        → coquille Capacitor (App Store)
    ├── capacitor.config.json
    ├── package.json
    └── www/index.html          → page de secours si le site est injoignable
```

---

## Avant tout : les variables d'environnement Vercel

À renseigner dans Vercel → Settings → Environment Variables (Production).
Tant qu'elles sont vides, rien ne casse : les fichiers de vérification sont
servis vides et les notifications iOS sont simplement désactivées.

| Variable | Où la trouver | Sert à |
|---|---|---|
| `ANDROID_SHA256_FINGERPRINTS` | Play Console → Configuration → Intégrité de l'app → **Certificat de signature d'application** | Faire disparaître la barre d'adresse dans l'app Android |
| `ANDROID_PACKAGE_NAME` | `fr.moncleanerpro.app` (défaut, facultatif) | idem |
| `APPLE_TEAM_ID` | developer.apple.com → Membership | Ouvrir les liens dans l'app iOS |
| `IOS_BUNDLE_ID` | `fr.moncleanerpro.app` (défaut, facultatif) | idem + notifications |
| `APNS_KEY_ID` | Clé APNs créée sur developer.apple.com | Notifications iOS |
| `APNS_TEAM_ID` | identique à `APPLE_TEAM_ID` | Notifications iOS |
| `APNS_PRIVATE_KEY` | contenu du fichier `.p8` téléchargé | Notifications iOS |
| `APNS_ENVIRONMENT` | `production` (défaut) | `sandbox` uniquement pour un build lancé depuis Xcode |

`APNS_PRIVATE_KEY` contient des retours à la ligne. Vercel les accepte tels
quels dans le champ multiligne ; s'ils posent problème, remplacez-les par `\n`
littéraux, le code les restaure.

**Migration SQL à passer avant la première publication** :
`supabase/migration_mobile_apps.sql` (table des appareils iOS + suppression de
compte).

---

## Android — Google Play

L'application est une **TWA** : une coquille qui ouvre le site dans le moteur de
Chrome, sans barre d'adresse. Les notifications Web Push existantes continuent
de fonctionner, aucune modification du serveur n'est nécessaire.

### 1. Outils

```bash
npm install -g @bubblewrap/cli
```

Bubblewrap télécharge tout seul le JDK et le SDK Android au premier lancement.

### 2. Clé de signature (à faire UNE fois, à sauvegarder précieusement)

```bash
cd mobile/android
keytool -genkeypair -v \
  -keystore moncleanerpro-upload.keystore \
  -alias moncleanerpro -keyalg RSA -keysize 2048 -validity 10000
```

> ⚠️ Ce fichier et son mot de passe sont **irremplaçables** : les perdre
> interdit toute mise à jour de l'application. Sauvegardez-les hors du dépôt
> (gestionnaire de mots de passe + disque externe). Ce fichier ne doit jamais
> être versionné.

### 3. Génération du projet et du bundle

```bash
cd mobile/android
bubblewrap init --manifest=https://app.moncleanerpro.fr/app.webmanifest
# Bubblewrap écrase twa-manifest.json : restaurez celui du dépôt
git checkout twa-manifest.json
bubblewrap update
bubblewrap build
```

Résultat : `app-release-bundle.aab` — c'est le fichier à envoyer au Play Console.

### 4. Empreinte du certificat

```bash
keytool -list -v -keystore moncleanerpro-upload.keystore -alias moncleanerpro
```

Reportez la ligne `SHA256:` dans `ANDROID_SHA256_FINGERPRINTS`. **Après le
premier envoi**, ajoutez aussi (séparée par une virgule) l'empreinte affichée
dans Play Console → Intégrité de l'app : c'est Google qui signe la version
distribuée, et c'est celle-là qu'Android vérifie.

### 5. Vérification

```
https://app.moncleanerpro.fr/.well-known/assetlinks.json
```

doit renvoyer votre empreinte. Si l'application affiche une barre d'adresse en
haut, c'est que cette étape est incomplète.

### ⏳ Délai à prévoir

Un compte Play **particulier** créé après novembre 2023 doit passer par un test
fermé de **12 testeurs pendant 14 jours** avant d'accéder à la production. Un
compte **organisation** (avec numéro DUNS) n'a pas cette contrainte. À lancer en
premier, c'est le chemin critique.

---

## iOS — App Store

L'application est une coquille **Capacitor**. Apple n'accepte pas l'équivalent
Android d'un simple raccourci : il faut un projet Xcode signé.

### ⚠️ Un Mac est nécessaire

La compilation iOS n'existe pas sur Windows. Trois options :

- un Mac (même un Mac mini d'occasion) ;
- **Codemagic** ou **Bitrise** : compilation dans le nuage, environ 30 €/mois,
  aucun Mac à acheter ;
- **MacInCloud** : location à l'heure, suffisant pour quelques envois.

### 1. Préparer le compte Apple

1. developer.apple.com → Identifiers → **App ID** `fr.moncleanerpro.app`,
   avec les capacités **Push Notifications** et **Associated Domains**.
2. Keys → nouvelle clé **Apple Push Notifications service (APNs)** →
   télécharger le `.p8` (**téléchargeable une seule fois**) → noter le Key ID.
3. App Store Connect → nouvelle application, même identifiant de bundle.
4. Renseigner `APNS_*` et `APPLE_TEAM_ID` sur Vercel (tableau plus haut).

### 2. Générer le projet (sur le Mac)

```bash
cd mobile/ios
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

### 3. Dans Xcode

- **Signing & Capabilities** : sélectionner l'équipe ; ajouter
  **Push Notifications**, **Background Modes → Remote notifications**, et
  **Associated Domains → `applinks:app.moncleanerpro.fr`**.
- **Info.plist** : ajouter les textes d'autorisation, sans quoi l'app est
  rejetée ou plante à la première photo :

| Clé | Texte |
|---|---|
| `NSCameraUsageDescription` | L’appareil photo sert à joindre les photos d’une intervention (avant/après, dégâts constatés). |
| `NSPhotoLibraryUsageDescription` | L’accès aux photos permet de joindre une image existante à un rapport d’intervention. |
| `NSPhotoLibraryAddUsageDescription` | Permet d’enregistrer une facture ou un devis dans vos photos. |
| `NSLocationWhenInUseUsageDescription` | Votre position sert à trier vos missions du jour par proximité. |

- **Archive** → Distribute App → App Store Connect.

### 4. Vérifier les notifications

Installer via TestFlight (et non depuis Xcode : un build Xcode utilise le
serveur *sandbox* d'Apple), se connecter, accepter les notifications, puis
déclencher une mission. Le jeton de l'appareil doit apparaître dans la table
`native_push_tokens`.

---

## Ce qui a été ajouté côté site pour ces applications

| Fichier | Rôle |
|---|---|
| `src/app/api/wellknown/*` + rewrites dans `next.config.ts` | `/.well-known/assetlinks.json` et `/.well-known/apple-app-site-association` |
| `src/lib/apns.ts` | Envoi des notifications iOS (APNs, HTTP/2, clé `.p8`) |
| `src/lib/webpush.ts` | Diffusion vers les deux canaux — web et natif |
| `src/app/api/push/token/route.ts` | Enregistrement d'un appareil iOS |
| `src/lib/native.ts`, `src/components/NativeBridge.tsx` | Détection de l'app, notifications, marges d'écran |
| `src/app/api/account/delete/route.ts`, `src/components/DeleteAccountCard.tsx` | Suppression de compte (exigée par les deux stores) |
| `src/app/suppression-compte/page.tsx` | Page publique de suppression (exigée par Google Play) |
| `supabase/migration_mobile_apps.sql` | Table des appareils iOS + traçabilité des suppressions |
