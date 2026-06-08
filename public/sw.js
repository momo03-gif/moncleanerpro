const CACHE = 'mcp-v2';
const OFFLINE_URL = '/offline';

const PRECACHE = [
  '/',
  '/login',
  '/offline',
  '/cleaner',
  '/hotel',
  '/admin',
];

// Install — précache les routes principales
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Activate — nettoie les anciens caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch — stratégie hybride
self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);

  // Ne pas intercepter les appels Supabase / API externes
  if (url.hostname !== location.hostname) return;
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/_next/')) {
    // Static assets : cache first
    e.respondWith(
      caches.match(request).then(cached => cached ?? fetch(request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(request, clone));
        return res;
      }))
    );
    return;
  }

  // Pages : network first, fallback cache puis offline
  e.respondWith(
    fetch(request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request).then(cached => cached ?? caches.match(OFFLINE_URL)))
  );
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
