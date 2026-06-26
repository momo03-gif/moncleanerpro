// ── Module Livraison : paiements de stationnement — couche d'accès données ───────
// SERVEUR (service_role via getServerDb). Table `parking_payments` verrouillée RLS :
// toute lecture/écriture passe par la route serveur /api/parking. La logique
// fournisseur est déléguée à getParkingProvider() (abstraction extensible).

import { getServerDb } from './serverDb';
import { getParkingProvider } from './parking/index';
import { distanceMeters, TRACKING_TOLERANCE_METERS, type GeoPoint } from './geo';
import type { ParkingPayment } from './types';

const supabase = getServerDb();

const MISSION_SNAPSHOT_SELECT =
  'id, property_name, address, address_lat, address_lng, cleaner_id, cleaner_name, airbnb_id, airbnbs(name, address, latitude, longitude), cleaners(license_plate)';

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
  cleanerId?: string; cleanerName?: string; plate?: string; found: boolean;
}> {
  const { data: m } = await supabase.from('missions').select(MISSION_SNAPSHOT_SELECT).eq('id', missionId).single();
  if (!m) return { address: '', property: '', found: false };
  const md = m as any;
  const apt = md.airbnbs;
  const address = apt?.address ?? md.address ?? '';
  const property = md.property_name ?? apt?.name ?? '';
  // Coordonnées : portées par la mission, sinon par le site lié.
  const lat = md.address_lat != null ? Number(md.address_lat) : (apt?.latitude != null ? Number(apt.latitude) : undefined);
  const lng = md.address_lng != null ? Number(md.address_lng) : (apt?.longitude != null ? Number(apt.longitude) : undefined);
  return { address, property, lat, lng, cleanerId: m.cleaner_id ?? undefined, cleanerName: m.cleaner_name ?? undefined, plate: md.cleaners?.license_plate ?? undefined, found: true };
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
  coords?: GeoPoint | null;
}): Promise<{ payment: ParkingPayment | null; error: string | null; tooFar?: boolean }> {
  const snap = await missionSnapshot(input.missionId);
  if (!snap.found) return { payment: null, error: 'Mission introuvable.' };
  if (!snap.address) return { payment: null, error: 'Adresse de la mission manquante.' };

  // RÈGLE : on ne paie le stationnement qu'À PROXIMITÉ (≤ 200 m) de l'adresse de la
  // mission. Si l'adresse est géolocalisée, la position du livreur est obligatoire et
  // vérifiée. (Adresse sans coordonnées → impossible de vérifier : on laisse passer.)
  if (snap.lat != null && snap.lng != null) {
    if (!input.coords) {
      return { payment: null, error: 'Activez la localisation : vous devez être à proximité de l’adresse de la mission pour payer le parking.', tooFar: true };
    }
    if (distanceMeters({ lat: snap.lat, lng: snap.lng }, input.coords) > TRACKING_TOLERANCE_METERS) {
      return { payment: null, error: 'Vous devez être à moins de 200 m de l’adresse de la mission pour payer le parking.', tooFar: true };
    }
  }

  const provider = getParkingProvider();

  // Tarif fournisseur : si un devis existe pour cette durée (ex. PayByPhone 20 min = 1 €),
  // il fait foi sur le montant — le livreur ne le saisit pas.
  let amount = input.amount;
  if (provider.quote && input.durationMinutes) {
    try {
      const q = await provider.quote({ address: snap.address, lat: snap.lat, lng: snap.lng, durationMinutes: input.durationMinutes, licensePlate: snap.plate });
      if (q) amount = q.amount;
    } catch { /* devis indisponible → on garde le montant fourni */ }
  }

  let result;
  try {
    result = await provider.createPayment({
      address: snap.address, lat: snap.lat, lng: snap.lng,
      amount, durationMinutes: input.durationMinutes, licensePlate: snap.plate,
    });
  } catch (e: any) {
    return { payment: null, error: e?.message ?? 'Échec du fournisseur de stationnement.' };
  }
  // Montant réellement facturé par le fournisseur (PayByPhone) → prioritaire.
  if (result.amount != null) amount = result.amount;

  const { data, error } = await supabase.from('parking_payments').insert({
    mission_id: input.missionId,
    cleaner_id: snap.cleanerId ?? null,
    cleaner_name: input.cleanerName ?? snap.cleanerName ?? null,
    address: snap.address,
    latitude: snap.lat ?? null,
    longitude: snap.lng ?? null,
    amount: amount ?? null,
    duration_minutes: input.durationMinutes ?? null,
    status: result.status,
    provider: provider.id,
    provider_ref: result.providerRef ?? null,
    metadata: result.metadata ?? {},
  }).select('*').single();

  if (error) { console.error('createParkingPaymentDB:', error.code, error.message); return { payment: null, error: error.message }; }
  return { payment: toParkingPayment(data), error: null };
}

// Devis : prix calculé pour une durée selon le tarif du fournisseur actif (ex.
// PayByPhone). null = pas de tarif automatique → le livreur saisit le montant.
export async function quoteParkingDB(missionId: string, durationMinutes?: number): Promise<{ amount: number; currency: string } | null> {
  const provider = getParkingProvider();
  if (!provider.quote || !durationMinutes) return null;
  const snap = await missionSnapshot(missionId);
  if (!snap.found) return null;
  try {
    return await provider.quote({ address: snap.address, lat: snap.lat, lng: snap.lng, durationMinutes });
  } catch { return null; }
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
