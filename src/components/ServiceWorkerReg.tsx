'use client';

import { useEffect } from 'react';

export default function ServiceWorkerReg() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Recharge une seule fois quand un nouveau service worker prend le contrôle
    // (auto-guérison après déploiement : iOS/Safari gardent l'ancienne version).
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(reg => {
        // Cherche une mise à jour dès le chargement, puis périodiquement
        reg.update().catch(() => {});
        setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
      })
      .catch(console.error);
  }, []);

  return null;
}
