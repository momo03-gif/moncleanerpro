'use client';

// Perf : page chargée en différé via composant client dynamique. Le chemin
// critique de la route ne contient que ce wrapper — supabase part dans un chunk
// asynchrone.
import dynamic from 'next/dynamic';
import Loading from '@/components/Loading';

const PageClient = dynamic(() => import('./PageClient'), {
  loading: () => <Loading className="p-4 md:p-6 text-sm" />,
});

export default function AdminComptesPage() {
  return <PageClient />;
}
