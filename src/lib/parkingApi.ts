// Façade CLIENT des paiements de stationnement → route serveur service_role.
// N'importe QUE des types (effacés au build) : aucun code serveur (service_role,
// fournisseur) n'est embarqué côté navigateur.
import type { ParkingPayment } from './types';

async function call<T>(op: string, args?: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/parking', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op, args: args ?? {} }),
  });
  return res.json() as Promise<T>;
}

// Livreur : enregistre un paiement de stationnement sur sa mission (saisie manuelle).
// coords = position du livreur, requise pour le contrôle de proximité (≤ 200 m).
export const recordParkingPaymentClient = (args: {
  missionId: string; amount?: number; durationMinutes?: number; lat?: number; lng?: number;
}) => call<{ payment: ParkingPayment | null; error: string | null; tooFar?: boolean }>('record', args);

// Livreur/admin : paiements déjà enregistrés pour une mission.
export const getMissionParkingClient = (missionId: string) =>
  call<ParkingPayment[]>('mission', { missionId });

// Admin : historique global (filtres période / livreur facultatifs).
export const listParkingPaymentsClient = (filters?: { from?: string; to?: string; cleanerId?: string }) =>
  call<ParkingPayment[]>('list', filters);
