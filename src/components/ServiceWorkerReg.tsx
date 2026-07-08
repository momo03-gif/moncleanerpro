'use client';

import { useEffect } from 'react';

// La vitrine (moncleanerpro.fr) ne doit PAS être une PWA en cache : sinon
// d'anciennes versions restent servies (rendu figé / « pas responsive »).
// Le service worker est réservé à l'app (offline). Sur la vitrine, on nettoie
// tout SW/cache résiduel et on recharge une fois pour repartir propre.
const VITRINE_HOSTS = new Set(['moncleanerpro.fr', 'www.moncleanerpro.fr']);

export default function ServiceWorkerReg() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const host = window.location.hostname.toLowerCase();

    // ── Vitrine : purge de tout service worker / cache résiduel ──────────────
    if (VITRINE_HOSTS.has(host)) {
      (async () => {
        const regs = await navigator.serviceWorker.getRegistrations();
        const had = regs.length > 0;
        await Promise.all(regs.map(r => r.unregister()));
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
        if (had) window.location.reload(); // recharge la vraie version, sans cache
      })().catch(() => {});
      return;
    }

    // ── App : service worker normal (offline + auto-guérison au déploiement) ──
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        reg.update().catch(() => {});
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch(console.error);
  }, []);

  return null;
}
