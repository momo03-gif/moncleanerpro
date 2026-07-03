// Server Component : la session et les données sont chargées CÔTÉ SERVEUR, puis
// passées au composant client d'affichage. Résultat : plus de supabase ni de
// couche données dans le bundle client de cette page (chargement plus rapide),
// et plus de flash de chargement (la page arrive déjà remplie).

import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import { getHotelByUserId, getHotelRequestsForHotelDB } from '@/lib/db';
import HistoriqueClient from './HistoriqueClient';

export default async function HotelHistoriquePage() {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const hotel = await getHotelByUserId(user.id);
  const announces = await getHotelRequestsForHotelDB(hotel?.id ?? user.id);

  return <HistoriqueClient announces={announces} />;
}
