'use client';

// Perf : la page cleaner (couche données + supabase temps réel + file hors-ligne)
// est chargée en différé via un composant client dynamique. Le chemin critique de
// la route ne contient que ce wrapper léger — supabase part dans un chunk
// asynchrone.
//
// Hors-ligne : le service worker met en cache les chunks /_next/static en
// cache-first, donc le chunk de PageClient est disponible hors-ligne dès la
// première ouverture en ligne après un déploiement (même garantie qu'auparavant).
import dynamic from 'next/dynamic';
import Loading from '@/components/Loading';

const PageClient = dynamic(() => import('./PageClient'), {
  loading: () => <Loading className="p-5 pt-8 text-sm" />,
});

export default function CleanerDashboard() {
  return <PageClient />;
}
