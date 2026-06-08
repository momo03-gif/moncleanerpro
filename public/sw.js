// ⚠️ Service worker « auto-destructeur » — déployé pour débloquer les appareils
// dont l'ancien cache PWA empêchait l'ouverture de l'app.
// Au prochain lancement, le navigateur récupère ce fichier : il vide tous les
// caches, se désinscrit, puis recharge automatiquement les pages ouvertes.
// (Le push pourra être réactivé via un service worker propre ensuite.)

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch { /* ignore */ }

    try {
      await self.registration.unregister();
    } catch { /* ignore */ }

    // Recharge toutes les fenêtres ouvertes → app fraîche, sans cache
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => {
      try { client.navigate(client.url); } catch { /* ignore */ }
    });
  })());
});

// Pendant la transition : ne rien intercepter, tout passe au réseau.
self.addEventListener('fetch', () => {});
