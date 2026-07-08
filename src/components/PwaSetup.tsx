'use client';

import { useEffect, useState } from 'react';
import InstallBanner from './InstallBanner';

// Active la PWA (manifest + métadonnées standalone + bannière d'installation)
// UNIQUEMENT hors vitrine. Ainsi `moncleanerpro.fr` (site vitrine) n'est jamais
// « installable » comme application — seul `app.moncleanerpro.fr` l'est, et son
// démarrage (start_url « / ») mène au login. Corrige le cas où installer depuis
// la vitrine ouvrait… la vitrine.
const VITRINE_HOSTS = new Set(['moncleanerpro.fr', 'www.moncleanerpro.fr']);

export default function PwaSetup() {
  const [isApp, setIsApp] = useState(false);

  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    if (VITRINE_HOSTS.has(host)) return; // vitrine : pas d'installation d'app
    setIsApp(true);

    if (!document.querySelector('link[rel="manifest"]')) {
      const link = document.createElement('link');
      link.rel = 'manifest';
      link.href = '/app.webmanifest';
      document.head.appendChild(link);
    }

    const ensureMeta = (name: string, content: string) => {
      if (!document.querySelector(`meta[name="${name}"]`)) {
        const m = document.createElement('meta');
        m.name = name;
        m.content = content;
        document.head.appendChild(m);
      }
    };
    ensureMeta('mobile-web-app-capable', 'yes');
    ensureMeta('apple-mobile-web-app-capable', 'yes');
    ensureMeta('apple-mobile-web-app-status-bar-style', 'default');
    ensureMeta('apple-mobile-web-app-title', 'MonCleanerPro');
  }, []);

  return isApp ? <InstallBanner /> : null;
}
