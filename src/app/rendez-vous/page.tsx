import { Suspense } from 'react';
import PageClient from './PageClient';
import { VITRINE_VIEWPORT } from '@/lib/vitrineViewport';

// Page publique : zoom autorisé (cf. lib/vitrineViewport.ts).
export const viewport = VITRINE_VIEWPORT;

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
