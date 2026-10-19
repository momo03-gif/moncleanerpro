'use client';

// Perf : page chargée en différé via composant client dynamique (cf. /admin/cleaners).
import dynamic from 'next/dynamic';
import Loading from '@/components/Loading';

const PageClient = dynamic(() => import('./PageClient'), {
  loading: () => <Loading className="p-4 md:p-6 text-sm" />,
});

export default function AdminPrestatairesPage() {
  return <PageClient />;
}
