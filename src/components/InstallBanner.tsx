'use client';

import { useState, useEffect } from 'react';

export default function InstallBanner() {
  const [prompt, setPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOS, setShowIOS] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // iOS detection
    const ios = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const standalone = ('standalone' in navigator) && (navigator as any).standalone;
    setIsIOS(ios && !standalone);

    // Check if already dismissed
    if (sessionStorage.getItem('install-dismissed')) { setDismissed(true); return; }

    // Chrome / Android install prompt
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    sessionStorage.setItem('install-dismissed', '1');
    setDismissed(true);
    setPrompt(null);
    setShowIOS(false);
  }

  async function handleInstall() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') dismiss();
    else setPrompt(null);
  }

  if (dismissed) return null;

  // Android / Chrome: native install
  if (prompt) return (
    <div className="fixed bottom-20 left-4 right-4 z-50 rounded-2xl p-4 shadow-lg flex items-center gap-3" style={{ backgroundColor: '#1A1A1A', border: '1px solid #2E2E2E' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg" style={{ backgroundColor: '#C9A84C' }}>✦</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: '#F5F5F5' }}>Installer l'app</p>
        <p className="text-xs" style={{ color: '#6A6058' }}>Accès rapide depuis votre écran</p>
      </div>
      <button onClick={handleInstall} className="px-3 py-2 rounded-xl text-xs font-semibold shrink-0" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
        Installer
      </button>
      <button onClick={dismiss} className="text-lg shrink-0" style={{ color: '#6A6058' }}>✕</button>
    </div>
  );

  // iOS: instructions
  if (isIOS && !showIOS) return (
    <button
      onClick={() => setShowIOS(true)}
      className="fixed bottom-20 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-lg text-sm font-semibold"
      style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}
    >
      <span>⬆</span> Installer l'app
    </button>
  );

  if (isIOS && showIOS) return (
    <div className="fixed inset-x-4 bottom-20 z-50 rounded-2xl p-5 shadow-xl" style={{ backgroundColor: '#1A1A1A', border: '1px solid #2E2E2E' }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold" style={{ color: '#F5F5F5' }}>Installer MonCleanerPro</p>
        <button onClick={dismiss} style={{ color: '#6A6058' }}>✕</button>
      </div>
      <div className="space-y-2 text-sm" style={{ color: '#A8A09A' }}>
        <p>1. Appuyez sur <span style={{ color: '#C9A84C' }}>⬆ Partager</span> en bas de Safari</p>
        <p>2. Faites défiler et appuyez sur <span style={{ color: '#C9A84C' }}>"Sur l'écran d'accueil"</span></p>
        <p>3. Confirmez en appuyant sur <span style={{ color: '#C9A84C' }}>"Ajouter"</span></p>
      </div>
    </div>
  );

  return null;
}
