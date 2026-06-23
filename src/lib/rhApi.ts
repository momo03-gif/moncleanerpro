// ══════════════════════════════════════════════════════════════════════════════
//  Façade CLIENT des opérations RH (LOT 4).
//  Mêmes signatures que lib/rh.ts, mais via les routes serveur (/api/admin/rh) en
//  service_role. Les écrans admin importent d'ici → aucune lecture RH directe
//  côté navigateur (compatible RLS deny-all).
// ══════════════════════════════════════════════════════════════════════════════

import type {
  RhConfigRow, PrimeType, PrimeConditionType, PrimeMode,
  RhIncident, RhIncidentType, CleanerRh, PrimeRequest, PrimeRequestStatus,
} from './rh';

// Types + constantes pures réexportés (pas d'accès base).
export {
  RH_CONFIG_META, PRIME_CONDITION_LABEL, INCIDENT_LABEL, currentPeriod,
} from './rh';
export type {
  RhConfigRow, RhConfigKey, RhConfigMeta, PrimeType, PrimeConditionType, PrimeMode,
  RhIncident, RhIncidentType, CleanerRh, PrimeRequest, PrimeRequestStatus,
} from './rh';

async function call<T>(op: string, args?: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/admin/rh', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op, args: args ?? {} }),
  });
  return res.json() as Promise<T>;
}

export const getRhConfigDB = () => call<RhConfigRow[]>('getRhConfig');
export const saveRhConfigDB = (rows: RhConfigRow[]) => call<{ error: string | null }>('saveRhConfig', { rows });

export const getPrimeTypesDB = () => call<PrimeType[]>('getPrimeTypes');
export const createPrimeTypeDB = (fields: { nom: string; montant: number; conditionType: PrimeConditionType; conditionValeur?: number; mode: PrimeMode; actif?: boolean }) =>
  call<{ error: string | null }>('createPrimeType', fields as any);
export const updatePrimeTypeDB = (id: string, fields: Record<string, unknown>) =>
  call<{ error: string | null }>('updatePrimeType', { id, fields });
export const deletePrimeTypeDB = (id: string) => call<{ error: string | null }>('deletePrimeType', { id });

export const getIncidentsForCleanerDB = (cleanerId: string) => call<RhIncident[]>('getIncidents', { cleanerId });
export const getMissionIncidentsDB = (missionId: string) => call<RhIncident[]>('getMissionIncidents', { missionId });
export const createIncidentDB = (fields: { cleanerId?: string | null; missionId?: string | null; type: RhIncidentType; note?: string; date?: string }) =>
  call<{ error: string | null }>('createIncident', fields as any);
export const deleteIncidentDB = (id: string, cleanerId?: string | null) =>
  call<{ error: string | null }>('deleteIncident', { id, cleanerId });

export const getPrimeRequestsDB = (statut?: PrimeRequestStatus) => call<PrimeRequest[]>('getPrimeRequests', { statut });
export const resolvePrimeRequestDB = (id: string, accept: boolean) => call<{ error: string | null }>('resolvePrimeRequest', { id, accept });

export const getAllCleanerRhDB = () => call<CleanerRh[]>('getAllCleanerRh');
