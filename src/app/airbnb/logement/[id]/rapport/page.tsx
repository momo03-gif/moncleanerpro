'use client';

// Perf : relevé propriétaire chargé en différé (jspdf/html2canvas ne doivent pas
// peser sur le chemin critique des autres pages). L'id est lu via useParams().
import dynamic from 'next/dynamic';
import Loading from '@/components/Loading';

const PageClient = dynamic(() => import('./PageClient'), {
  loading: () => <Loading className="p-5 pt-8 text-sm" />,
});

export default function OwnerReportPage() {
  return <PageClient />;
}
