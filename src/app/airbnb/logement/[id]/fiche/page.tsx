'use client';

// Même conception que la fiche logement voisine : le composant client part en
// différé, et lit l'identifiant via useParams().
import dynamic from 'next/dynamic';
import Loading from '@/components/Loading';

const PageClient = dynamic(() => import('./PageClient'), {
  loading: () => <Loading className="p-5 pt-8 text-sm" />,
});

export default function FicheAccueilPage() {
  return <PageClient />;
}
