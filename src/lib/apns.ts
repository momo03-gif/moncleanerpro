// ── Notifications natives iOS (APNs) — SERVEUR uniquement ───────────────────────
//
//  POURQUOI CE FICHIER EXISTE
//  Le Web Push (VAPID) que nous utilisons déjà ne fonctionne PAS dans la coquille
//  native iOS (WKWebView) : Safari ne l'accepte qu'en PWA installée depuis Safari,
//  jamais dans une application du Store. Apple impose son propre service, APNs.
//  Sans ce module, l'app iOS serait muette — or pour un cleaner sur le terrain,
//  la notification EST la fonctionnalité.
//
//  IMPLÉMENTATION
//  APNs n'accepte que du HTTP/2. `fetch` (undici) ne parle pas HTTP/2 : on utilise
//  donc le module natif `node:http2`. L'authentification se fait par jeton JWT
//  ES256 signé avec la clé .p8 du compte Apple Developer — `jose` est déjà une
//  dépendance du projet (sessions), aucune librairie supplémentaire n'est requise.
//
//  VARIABLES D'ENVIRONNEMENT (Vercel, server-only)
//    APNS_KEY_ID       — identifiant de la clé .p8 (10 caractères)
//    APNS_TEAM_ID      — identifiant d'équipe Apple (à défaut : APPLE_TEAM_ID)
//    APNS_PRIVATE_KEY  — contenu du fichier .p8 (les retours à la ligne peuvent
//                        être échappés en \n : ils sont restaurés ici)
//    IOS_BUNDLE_ID     — identifiant du bundle, sert de « topic » APNs
//    APNS_ENVIRONMENT  — 'production' (défaut) ou 'sandbox' (builds Xcode/TestFlight
//                        installés en debug)
//
//  Si la configuration est absente, tout ce module est un no-op silencieux : les
//  notifications web et in-app continuent de fonctionner normalement.

import http2 from 'node:http2';
import { SignJWT, importPKCS8 } from 'jose';

const HOSTS = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
} as const;

export type ApnsEnvironment = keyof typeof HOSTS;

export interface ApnsPayload {
  title: string;
  body: string;
  url?: string;
  /** Regroupe les notifications d'un même sujet dans le centre de notifications. */
  tag?: string;
  /** Pastille sur l'icône de l'app. */
  badge?: number;
}

export interface ApnsResult {
  token: string;
  ok: boolean;
  /** true quand Apple indique que ce jeton est définitivement invalide. */
  gone: boolean;
  status?: number;
  reason?: string;
}

function config() {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID || process.env.APPLE_TEAM_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\n/g, '\n');
  const bundleId = process.env.IOS_BUNDLE_ID || 'fr.moncleanerpro.app';
  if (!keyId || !teamId || !privateKey) return null;
  return { keyId, teamId, privateKey, bundleId };
}

export function isApnsConfigured(): boolean {
  return config() !== null;
}

// ── Jeton d'authentification ────────────────────────────────────────────────
// Apple REFUSE qu'on régénère ce jeton plus d'une fois toutes les 20 minutes
// (erreur TooManyProviderTokenUpdates) et l'invalide au bout d'une heure. On le
// garde donc en cache au niveau du module, avec une marge de sécurité.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function providerToken(cfg: NonNullable<ReturnType<typeof config>>): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now) return cachedToken.value;

  const key = await importPKCS8(cfg.privateKey, 'ES256');
  const value = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: cfg.keyId })
    .setIssuer(cfg.teamId)
    .setIssuedAt()
    .sign(key);

  // 45 minutes : bien en dessous de la limite d'une heure, bien au-dessus des
  // 20 minutes minimales entre deux régénérations.
  cachedToken = { value, expiresAt: now + 45 * 60 * 1000 };
  return value;
}

// ── Envoi ───────────────────────────────────────────────────────────────────
// Une session HTTP/2 est ouverte par lot d'envois puis refermée : en serverless,
// garder une connexion vivante entre deux invocations n'apporte rien.
export async function sendApns(
  tokens: { token: string; environment?: ApnsEnvironment }[],
  payload: ApnsPayload,
): Promise<ApnsResult[]> {
  const cfg = config();
  if (!cfg || tokens.length === 0) return [];

  const jwt = await providerToken(cfg);
  const defaultEnv = (process.env.APNS_ENVIRONMENT as ApnsEnvironment) || 'production';

  // Un groupe par environnement : un appareil TestFlight/debug et un appareil du
  // Store ne parlent pas au même serveur Apple.
  const groups = new Map<ApnsEnvironment, string[]>();
  for (const t of tokens) {
    const env = t.environment ?? defaultEnv;
    const list = groups.get(env) ?? [];
    list.push(t.token);
    groups.set(env, list);
  }

  const results: ApnsResult[] = [];
  for (const [env, list] of groups) {
    results.push(...(await sendToHost(HOSTS[env], jwt, cfg.bundleId, list, payload)));
  }
  return results;
}

function sendToHost(
  host: string,
  jwt: string,
  topic: string,
  tokens: string[],
  payload: ApnsPayload,
): Promise<ApnsResult[]> {
  return new Promise(resolve => {
    const session = http2.connect(host);
    const results: ApnsResult[] = [];
    let pending = tokens.length;
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      session.close();
      resolve(results);
    };

    session.on('error', () => {
      // Réseau/TLS indisponible : on n'échoue pas l'action métier pour autant.
      for (const token of tokens) results.push({ token, ok: false, gone: false });
      finish();
    });

    const body = JSON.stringify({
      aps: {
        alert: { title: payload.title, body: payload.body },
        sound: 'default',
        'thread-id': payload.tag,
        ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
      },
      // Données libres lues à l'ouverture de la notification (navigation).
      url: payload.url ?? '/',
    });

    for (const token of tokens) {
      const req = session.request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': topic,
        'apns-push-type': 'alert',
        'apns-priority': '10',
        // 24 h : si le téléphone est éteint, la notification sera délivrée au
        // rallumage plutôt que perdue.
        'apns-expiration': String(Math.floor(Date.now() / 1000) + 86400),
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
      });

      let status = 0;
      let raw = '';
      req.setEncoding('utf8');
      req.on('response', headers => { status = Number(headers[':status']) || 0; });
      req.on('data', chunk => { raw += chunk; });
      req.on('error', () => {
        results.push({ token, ok: false, gone: false });
        if (--pending === 0) finish();
      });
      req.on('end', () => {
        let reason: string | undefined;
        try { reason = raw ? JSON.parse(raw).reason : undefined; } catch { /* corps vide = succès */ }
        results.push({
          token,
          ok: status === 200,
          // 410 = appareil désinscrit ; BadDeviceToken = jeton d'un autre
          // environnement ou révoqué. Dans les deux cas il faut le supprimer.
          gone: status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered',
          status,
          reason,
        });
        if (--pending === 0) finish();
      });

      req.end(body);
    }
  });
}
