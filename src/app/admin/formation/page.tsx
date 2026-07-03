'use client';

// Perf : la page formation (couche données + supabase) est chargée en différé
// via un composant client dynamique. Le chemin critique de la route ne contient
// que ce léger wrapper — supabase part dans un chunk asynchrone.
import dynamic from 'next/dynamic';
import Loading from '@/components/Loading';

const FormationClient = dynamic(() => import('./FormationClient'), {
  loading: () => <Loading className="p-4 md:p-6 text-sm" />,
});

export default function AdminFormationPage() {
  return <FormationClient />;
}
