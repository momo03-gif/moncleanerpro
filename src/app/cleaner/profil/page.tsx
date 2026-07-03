'use client';

// Perf : page chargée en différé via composant client dynamique. supabase part
// dans un chunk asynchrone, hors du chemin critique de la route.
import dynamic from 'next/dynamic';
import Loading from '@/components/Loading';

const PageClient = dynamic(() => import('./PageClient'), {
  loading: () => <Loading className="p-5 pt-8 text-sm" />,
});

export default function CleanerProfil() {
  return <PageClient />;
}
