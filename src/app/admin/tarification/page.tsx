'use client';

// Perf : écran chargé en différé (supabase hors du chemin critique des autres
// pages d'administration).
import dynamic from 'next/dynamic';
import Loading from '@/components/Loading';

const PageClient = dynamic(() => import('./PageClient'), {
  loading: () => <Loading className="p-6 text-sm" />,
});

export default function TarificationPage() {
  return <PageClient />;
}
