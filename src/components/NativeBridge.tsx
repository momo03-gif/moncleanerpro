'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { isNativeApp, nativePlatform, registerNativePush } from '@/lib/native';

// ══════════════════════════════════════════════════════════════════════════════
//  Adaptations propres à l'application installée depuis un store.
//
//  • Marque le <html> d'une classe `native-app` (+ la plateforme) : c'est ce qui
//    permet au CSS de réserver la place de l'encoche et de la barre d'accueil de
//    l'iPhone SANS toucher à l'affichage du site dans un navigateur.
//  • Enregistre l'appareil pour les notifications dès qu'un utilisateur est
//    connecté — et seulement à ce moment : demander l'autorisation avant la
//    connexion est le meilleur moyen de se faire refuser, et iOS ne repose
//    jamais la question.
//
//  Hors application native, ce composant ne fait strictement rien.
// ══════════════════════════════════════════════════════════════════════════════
export default function NativeBridge() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isNativeApp()) return;
    const root = document.documentElement;
    root.classList.add('native-app', `native-${nativePlatform()}`);

    // `viewport-fit=cover` est ce qui « active » les variables env(safe-area-*).
    // On ne le pose QUE dans l'app native : sur le web, il ferait passer le
    // contenu sous l'encoche des iPhone sans contrepartie.
    const meta = document.querySelector('meta[name="viewport"]');
    const content = meta?.getAttribute('content') ?? '';
    if (meta && !content.includes('viewport-fit')) {
      meta.setAttribute('content', `${content}, viewport-fit=cover`);
    }
  }, []);

  useEffect(() => {
    if (!user || !isNativeApp()) return;
    void registerNativePush(url => router.push(url));
  }, [user, router]);

  return null;
}
