// Registre des fournisseurs de stationnement. Sélection par variable d'env
// PARKING_PROVIDER (défaut : 'manual'). Brancher un nouveau fournisseur = ajouter
// une entrée ici + son fichier d'implémentation.

import type { ParkingProvider } from './types';
import type { ParkingProviderId } from '../types';
import { manualParkingProvider } from './manual';
import { payByPhoneProvider } from './paybyphone';

export type { ParkingProvider, ParkingSessionInput, ParkingSessionResult } from './types';

const PROVIDERS: Record<ParkingProviderId, ParkingProvider> = {
  manual: manualParkingProvider,
  paybyphone: payByPhoneProvider,
};

// Fournisseur actif. Tout id inconnu retombe sur 'manual' (filet de sécurité).
export function getParkingProvider(): ParkingProvider {
  const id = (process.env.PARKING_PROVIDER ?? 'manual') as ParkingProviderId;
  return PROVIDERS[id] ?? manualParkingProvider;
}
