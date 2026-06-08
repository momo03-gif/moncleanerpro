'use client';

import { useEffect } from 'react';

// Temporairement : on N'ENREGISTRE PLUS de service worker. On nettoie au contraire
// tout SW/cache résiduel côté page, pour débloquer les appareils dont l'ancien
// cache PWA empêchait l'ouverture. Un service worker propre (avec push) sera
// réintroduit une fois la situation stabilisée.
export default function ServiceWorkerReg() {
  useEffect(() => {
    (async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(r => r.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(k => caches.delete(k)));
        }
      } catch { /* ignore */ }
    })();
  }, []);

  return null;
}
