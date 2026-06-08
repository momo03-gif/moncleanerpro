const CACHE = 'mcp-v3';
const OFFLINE_URL = '/offline';

// On ne précache que la page hors-ligne. On NE met PLUS le HTML des pages en
// cache : cela évite qu'une ancienne « coquille » périmée (référençant d'anciens
// fichiers JS supprimés après un déploiement) ne bloque l'ouverture de l'app.
const PRECACHE = ['/offline'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Active immédiatement la nouvelle version et purge tous les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  if (url.hostname !== location.hostname) return; // pas Supabase / externes
  if (request.method !== 'GET') return;

  // Assets immuables de Next (hashés) : cache-first, sans risque de péremption
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(request, clone));
        return res;
      }))
    );
    return;
  }

  // Navigations (pages HTML) : toujours le réseau ; repli = page hors-ligne.
  // Jamais de HTML mis en cache → jamais d'app bloquée par une version périmée.
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Autres requêtes GET same-origin : réseau, repli cache si présent
  e.respondWith(fetch(request).catch(() => caches.match(request)));
});

// ── Push : afficher la notification système (sonnerie/vibration gérées par l'OS) ──
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: 'MonCleanerPro', body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'MonCleanerPro';
  const options = {
    body: data.body || '',
    icon: '/icon/192',
    badge: '/icon/96',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    vibrate: [120, 60, 120],
    data: { url: data.url || '/' },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// ── Clic sur la notification : ouvrir / focus l'app sur la bonne page ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});
