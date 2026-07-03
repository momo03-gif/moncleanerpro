'use client';

// Perf : page publique chargée en différé via composant client dynamique. Le
// token est lu par le composant via useParams(). supabase part dans un chunk
// asynchrone, hors du chemin critique de la route.
import dynamic from 'next/dynamic';
import Loading from '@/components/Loading';

const PageClient = dynamic(() => import('./PageClient'), {
  loading: () => <Loading className="min-h-screen flex items-center justify-center text-sm" />,
});

export default function PublicDevisPage() {
  return <PageClient />;
}
