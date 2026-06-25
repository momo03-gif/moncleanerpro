// ── Module Livraison : paiements de stationnement — couche d'accès données ───────
// SERVEUR (service_role via getServerDb). Table `parking_payments` verrouillée RLS :
// toute lecture/écriture passe par la route serveur /api/parking. La logique
// fournisseur est déléguée à getParkingProvider() (abstraction extensible).

import { getServerDb } from './serverDb';
import { getParkingProvider } from './parking/index';
import type { ParkingPayment } from './types';

const supabase = getServerDb();

const MISSION_SNAPSHOT_SELECT =
  'id, property_name, address, cleaner_id, cleaner_name, airbnb_id, airbnbs(name, address, latitude, longitude)';

const toParkingPayment = (r: any): ParkingPayment => ({
  id: r.id,
  missionId: r.mission_id ?? undefined,
  cleanerId: r.cleaner_id ?? undefined,
  cleanerName: r.cleaner_name ?? undefined,
  address: r.address ?? '',
  latitude: r.latitude != null ? Number(r.latitude) : undefined,
  longitude: r.longitude != null ? Number(r.longitude) : undefined,
  amount: r.amount != null ? Number(r.amount) : undefined,
  currency: r.currency ?? 'EUR',
  durationMinutes: r.duration_minutes != null ? Number(r.duration_minutes) : undefined,
  status: r.status ?? 'paid',
  provider: r.provider ?? 'manual',
  providerRef: r.provider_ref ?? undefined,
  paidAt: r.paid_at,
  createdAt: r.created_at,
  property: r.missions?.property_name ?? r.missions?.airbnbs?.name ?? undefined,
});

// Snapshot adresse/coords/propriété/livreur depuis la mission. Pour un appart Airbnb
// lié, l'adresse et les coordonnées viennent de l'appartement ; sinon de la mission.
async function missionSnapshot(missionId: string): Promise<{
  address: string; property: string; lat?: number; lng?: number;
  cleanerId?: string; cleanerName?: string; cleanerUserId?: string; found: boolean;
}> {
  const { data: m } = await supabase.from('missions').select(MISSION_SNAPSHOT_SELECT).eq('id', missionId).single();
  if (!m) return { address: '', property: '', found: false };
  const apt = (m as any).airbnbs;
  const address = apt?.address ?? m.address ?? '';
  const property = m.property_name ?? apt?.name ?? '';
  const lat = apt?.latitude != null ? Number(apt.latitude) : undefined;
  const lng = apt?.longitude != null ? Number(apt.longitude) : undefined;
  return { address, property, lat, lng, cleanerId: m.cleaner_id ?? undefined, cleanerName: m.cleaner_name ?? undefined, found: true };
}

// Résout l'user_id (users.id) du cleaner assigné à la mission — pour le contrôle
// d'accès côté route (un livreur ne paie que SUR sa mission).
export async function getMissionCleanerUserId(missionId: string): Promise<string | null> {
  const { data } = await supabase.from('missions').select('cleaners(user_id)').eq('id', missionId).single();
  const uid = (data as any)?.cleaners?.user_id;
  return uid ?? null;
}

export async function createParkingPaymentDB(input: {
  missionId: string;
  amount?: number;
  durationMinutes?: number;
  cleanerName?: string;
}): Promise<{ payment: ParkingPayment | null; error: string | null }> {
  const snap = await missionSnapshot(input.missionId);
  if (!snap.found) return { payment: null, error: 'Mission introuvable.' };
  if (!snap.address) return { payment: null, error: 'Adresse de la mission manquante.' };

  const provider = getParkingProvider();
  let result;
  try {
    result = await provider.createPayment({
      address: snap.address, lat: snap.lat, lng: snap.lng,
      amount: input.amount, durationMinutes: input.durationMinutes,
    });
  } catch (e: any) {
    return { payment: null, error: e?.message ?? 'Échec du fournisseur de stationnement.' };
  }

  const { data, error } = await supabase.from('parking_payments').insert({
    mission_id: input.missionId,
    cleaner_id: snap.cleanerId ?? null,
    cleaner_name: input.cleanerName ?? snap.cleanerName ?? null,
    address: snap.address,
    latitude: snap.lat ?? null,
    longitude: snap.lng ?? null,
    amount: input.amount ?? null,
    duration_minutes: input.durationMinutes ?? null,
    status: result.status,
    provider: provider.id,
    provider_ref: result.providerRef ?? null,
    metadata: result.metadata ?? {},
  }).select('*').single();

  if (error) { console.error('createParkingPaymentDB:', error.code, error.message); return { payment: null, error: error.message }; }
  return { payment: toParkingPayment(data), error: null };
}

export async function getMissionParkingDB(missionId: string): Promise<ParkingPayment[]> {
  const { data, error } = await supabase.from('parking_payments')
    .select('*').eq('mission_id', missionId).order('paid_at', { ascending: false });
  if (error) { console.error('getMissionParkingDB:', error.code, error.message); return []; }
  return (data ?? []).map(toParkingPayment);
}

export async function getParkingPaymentsDB(filters?: {
  from?: string; to?: string; cleanerId?: string;
}): Promise<ParkingPayment[]> {
  let q = supabase.from('parking_payments')
    .select('*, missions(property_name, airbnbs(name))')
    .order('paid_at', { ascending: false });
  if (filters?.from) q = q.gte('paid_at', filters.from);
  if (filters?.to) q = q.lte('paid_at', filters.to);
  if (filters?.cleanerId) q = q.eq('cleaner_id', filters.cleanerId);
  const { data, error } = await q;
  if (error) { console.error('getParkingPaymentsDB:', error.code, error.message); return []; }
  return (data ?? []).map(toParkingPayment);
}
