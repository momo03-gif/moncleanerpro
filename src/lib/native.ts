// ── Pont avec la coquille native (application iOS / App Store) ───────────────────
//
//  L'application iOS est une coquille Capacitor qui charge app.moncleanerpro.fr :
//  c'est LE MÊME site, donc le même code, la même session, le même mode
//  hors-ligne. Seules diffèrent les capacités que le web ne peut pas offrir sur
//  iPhone — au premier rang desquelles les notifications.
//
//  Aucune dépendance npm n'est ajoutée au site : la couche native injecte
//  `window.Capacitor` dans la WebView, et ses plugins sont accessibles par
//  `Capacitor.Plugins.<Nom>`. Hors de l'app (navigateur, Android/TWA, PWA),
//  `window.Capacitor` n'existe pas et toutes ces fonctions ne font rien.

const TOKEN_KEY = 'mcp_native_push_token';

type PluginProxy = {
  [method: string]: (...args: unknown[]) => Promise<unknown>;
} & {
  addListener: (event: string, cb: (data: never) => void) => Promise<unknown>;
};

interface CapacitorGlobal {
  getPlatform?: () => string;
  isNativePlatform?: () => boolean;
  Plugins?: Record<string, PluginProxy>;
}

function cap(): CapacitorGlobal | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor ?? null;
}

/** true uniquement dans l'application installée depuis un store. */
export function isNativeApp(): boolean {
  const c = cap();
  return !!c && (c.isNativePlatform?.() ?? false);
}

/** 'ios' | 'android' | 'web' */
export function nativePlatform(): string {
  return cap()?.getPlatform?.() ?? 'web';
}

function plugin(name: string): PluginProxy | null {
  return cap()?.Plugins?.[name] ?? null;
}

// ── Notifications ───────────────────────────────────────────────────────────
// Le déroulé imposé par iOS : demander l'autorisation → s'enregistrer auprès
// d'APNs → recevoir un « device token » de façon ASYNCHRONE (événement), et
// seulement alors le transmettre au serveur.
let registering = false;

export async function registerNativePush(onOpenUrl?: (url: string) => void): Promise<void> {
  const push = plugin('PushNotifications');
  if (!isNativeApp() || !push || registering) return;
  registering = true;

  try {
    const perm = (await push.checkPermissions()) as { receive?: string };
    let granted = perm?.receive === 'granted';
    if (!granted) {
      const asked = (await push.requestPermissions()) as { receive?: string };
      granted = asked?.receive === 'granted';
    }
    // Refus de l'utilisateur : on n'insiste pas. iOS ne repose la question
    // qu'une seule fois — relancer ici ne ferait qu'échouer en silence.
    if (!granted) return;

    await push.addListener('registration', (t: { value: string }) => {
      void sendTokenToServer(t.value);
    });

    await push.addListener('registrationError', () => { /* rien à faire côté web */ });

    // Notification ouverte par l'utilisateur → on navigue vers la page visée
    // (mission, demande…), comme le fait déjà le service worker sur le web.
    await push.addListener('pushNotificationActionPerformed', (ev: { notification?: { data?: { url?: string } } }) => {
      const url = ev?.notification?.data?.url;
      if (url && onOpenUrl) onOpenUrl(url);
    });

    await push.register();
  } catch {
    // Une coquille sans le plugin (build de test) ne doit pas casser l'app.
  } finally {
    registering = false;
  }
}

async function sendTokenToServer(token: string): Promise<void> {
  if (!token) return;
  try {
    const res = await fetch('/api/push/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        platform: nativePlatform(),
        environment: process.env.NEXT_PUBLIC_APNS_ENVIRONMENT || 'production',
      }),
    });
    if (res.ok) localStorage.setItem(TOKEN_KEY, token);
  } catch { /* hors ligne : le jeton sera renvoyé au prochain démarrage */ }
}

/**
 * À la déconnexion : on détache l'appareil du compte. Sans cela, un téléphone
 * partagé entre deux cleaners continuerait de recevoir les missions du premier.
 */
export async function unregisterNativePush(): Promise<void> {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  localStorage.removeItem(TOKEN_KEY);
  try {
    await fetch('/api/push/token', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
  } catch { /* sans importance : le jeton sera réattribué à la reconnexion */ }
}

/** Pastille sur l'icône de l'app (nombre de notifications non lues). */
export async function setAppBadge(count: number): Promise<void> {
  const badge = plugin('Badge');
  if (!isNativeApp() || !badge) return;
  try {
    if (count > 0) await badge.set({ count });
    else await badge.clear();
  } catch { /* plugin absent */ }
}
