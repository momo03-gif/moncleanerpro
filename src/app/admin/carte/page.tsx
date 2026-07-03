'use client';

// Perf : page chargée en différé via composant client dynamique. supabase (et la
// carte Leaflet) partent dans des chunks asynchrones, hors du chemin critique.
import dynamic from 'next/dynamic';
import Loading from '@/components/Loading';

const PageClient = dynamic(() => import('./PageClient'), {
  loading: () => <Loading className="p-4 md:p-6 text-sm" />,
});

export default function CartePage() {
  return <PageClient />;
}
