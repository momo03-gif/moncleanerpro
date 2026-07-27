import { Suspense } from 'react';
import PageClient from './PageClient';

export const metadata = {
  title: 'Prendre rendez-vous',
  description: 'Réservez le créneau de votre intervention de nettoyage après validation de votre devis.',
};

export default function RendezVousPage() {
  return (
    <Suspense fallback={null}>
      <PageClient />
    </Suspense>
  );
}
