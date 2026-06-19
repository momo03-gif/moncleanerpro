'use client';

import { useEffect, useState } from 'react';

// Page de secours : désinscrit le service worker et vide tous les caches,
// puis redirige vers la connexion. À ouvrir si l'app reste bloquée après
// une mise à jour (cache PWA périmé, surtout sur iOS).
export default function ResetPage() {
  const [msg, setMsg] = useState('Nettoyage du cache en cours…');

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
        setMsg('Terminé ✓  Rechargement…');
      } catch {
        setMsg('Terminé.  Rechargement…');
      }
      setTimeout(() => { window.location.replace('/login'); }, 1400);
    })();
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FAFAF8', padding: 24 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#1A1A1A', color: '#C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 22, margin: '0 auto 12px' }}>M</div>
        <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>MonCleaner<span style={{ color: '#C9A84C' }}>Pro</span></p>
        <p style={{ fontSize: 13, color: '#7A7068', marginTop: 10 }}>{msg}</p>
      </div>
    </div>
  );
}
