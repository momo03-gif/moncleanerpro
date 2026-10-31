// Ce que partagent les modes de création de l'onglet « Créer » (Missions admin).

import { geocodeAddress } from '@/lib/zones';
import type { Apartment, RecurringMission } from '@/lib/types';

export interface ProprietesCreation {
  cleaners: any[];
  hotels: any[];
  airbnbs: Apartment[];
  staff: { id: string; name: string; role: string }[];
  recurrings: RecurringMission[];
  userId?: string;
  onReload: () => Promise<void> | void;
  onGoToMissions: () => void;
}

// Coordonnées de l'adresse cible : celles du site sélectionné, sinon géocodage de
// l'adresse libre. Sert au contrôle de proximité (démarrage / parking).
export async function resolveCoords(airbnbs: Apartment[], siteId: string, address: string): Promise<{ lat?: number; lng?: number }> {
  if (siteId) {
    const a = airbnbs.find(x => x.id === siteId);
    if (a?.latitude != null && a?.longitude != null) return { lat: a.latitude, lng: a.longitude };
  }
  if (address && address.trim()) {
    const g = await geocodeAddress(address);
    if (g) return { lat: g.lat, lng: g.lon };
  }
  return {};
}
