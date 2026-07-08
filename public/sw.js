const CACHE = 'mcp-v20';
const OFFLINE_URL = '/offline';

// La vitrine ne doit PAS avoir de service worker en cache. Si ce SW se retrouve
// enregistré sur le domaine vitrine (héritage d'une ancienne version), il
// s'auto-détruit : purge des caches, désinscription, puis rechargement des
// onglets → l'utilisateur récupère immédiatement la vraie version fraîche.
const VITRINE_HOSTS = ['moncleanerpro.fr', 'www.moncleanerpro.fr'];
const SELF_DESTRUCT = VITRINE_HOSTS.includes(self.location.hostname);

if (SELF_DESTRUCT) {
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', e => {
    e.waitUntil((async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(c => c.navigate(c.url));
    })());
  });
  // On n'intercepte AUCUNE requête : tout passe par le réseau (contenu frais).
} else {

// On précache la page hors-ligne. Le HTML des navigations est mis en cache au
// fil de l'eau (network-first) pour que l'app puisse S'OUVRIR hors-ligne — la
// fraîcheur est garantie par le versionnage du cache (purge à l'activation) +
// le rechargement sur `controllerchange` après un déploiement.
const PRECACHE = ['/offline'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

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

  // Assets immuables de Next (hashés) : cache-first
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

  // Navigations (pages) : réseau d'abord, on met la réponse en cache pour pouvoir
  // rouvrir l'app hors-ligne ; repli = HTML en cache de cette page, sinon la page
  // hors-ligne. Le cache versionné est purgé à chaque déploiement (activate).
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Autres GET same-origin : réseau, repli cache
  e.respondWith(fetch(request).catch(() => caches.match(request)));
});

// ── Push : afficher la notification système (sonnerie/vibration gérées par l'OS) ──
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch { data = { title: 'MonCleanerPro', body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'MonCleanerPro';
  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/favicon-48.png',
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
}
