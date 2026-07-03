'use client';

// Perf : cette page volumineuse (couche données + supabase) est chargée en
// différé via un composant client dynamique. Le chemin critique de la route ne
// contient que ce wrapper léger — supabase et le code de la page partent dans un
// chunk asynchrone.
import dynamic from 'next/dynamic';
import Loading from '@/components/Loading';

const PageClient = dynamic(() => import('./PageClient'), {
  loading: () => <Loading className="p-4 md:p-6 text-sm" />,
});

export default function MissionsPage() {
  return <PageClient />;
}
