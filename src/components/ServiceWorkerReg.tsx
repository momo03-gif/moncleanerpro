'use client';

import { useEffect } from 'react';

export default function ServiceWorkerReg() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Recharge une seule fois quand un nouveau service worker prend le contrôle
    // (auto-guérison après déploiement).
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
