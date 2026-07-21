// ── Appartements Airbnb + zones géographiques ────────────────────────────────────
// Extrait de db.ts.

import { supabase } from '../supabase';
import { clusterApartments } from '../zones';
import type { Apartment } from '../types';

function rowToApartment(a: any): Apartment {
  return {
    id: a.id,
    name: a.name,
    address: a.address,
    structureType: a.structure_type ?? 'apartment',
    structureLabel: a.structure_label ?? undefined,
    productCostCents: a.product_cost_cents != null ? Number(a.product_cost_cents) : undefined,
    portalCode: a.code_portail,
    keyboxCode: a.code_boite,
    entryDirectives: a.entry_instructions ?? '',
    cleanerId: a.cleaner_id,
    cleanerName: a.cleaners?.name,
    clientPrice: a.client_price != null ? Number(a.client_price) : undefined,
    estimatedCleaningMinutes: a.estimated_cleaning_minutes != null ? Number(a.estimated_cleaning_minutes) : undefined,
    cleanerGain: 0,
    latitude: a.latitude != null ? Number(a.latitude) : undefined,
    longitude: a.longitude != null ? Number(a.longitude) : undefined,
    zoneId: a.zone_id ?? undefined,
    zoneColor: a.zone_color ?? undefined,
    zoneName: a.zone_name ?? undefined,
    partnerId: a.partner_id ?? undefined,
    partnerName: a.partner_name ?? undefined,
    bedrooms: a.bedrooms ?? undefined,
    beds: a.beds ?? undefined,
    sofaBeds: a.sofa_beds ?? undefined,
    notes: a.notes ?? undefined,
    accessVideoUrl: a.access_video_url ?? undefined,
    accessVideoPath: a.access_video_path ?? undefined,
  };
}

export async function getAirbnbs(): Promise<Apartment[]> {
  const { data, error } = await supabase.from('airbnbs').select('*, cleaners(name)').order('created_at');
  if (error) console.error('getAirbnbs error:', error.code, error.message);
  return (data ?? []).map(rowToApartment);
}

// Appartements d'un partenaire Airbnb (avec compte) — filtrés par partner_id
export async function getAirbnbsForPartner(userId: string): Promise<Apartment[]> {
  const { data, error } = await supabase
    .from('airbnbs')
    .select('*, cleaners(name)')
    .eq('partner_id', userId)
    .order('created_at');
  if (error) console.error('getAirbnbsForPartner error:', error.code, error.message);
  // Le partenaire ne doit PAS voir la durée de ménage (paramétrée par l'admin, elle
  // sert à la paie des cleaners) ni le gain cleaner : on les retire.
  return (data ?? []).map(rowToApartment).map(a => ({ ...a, estimatedCleaningMinutes: undefined, cleanerGain: undefined }));
}

export async function createAirbnb(fields: {
  name: string; address: string; portalCode?: string; keyboxCode?: string;
  entryDirectives: string; partnerId?: string; partnerName?: string;
  bedrooms?: number; beds?: number; sofaBeds?: number; clientPrice?: number;
  estimatedCleaningMinutes?: number; zoneColor?: string; zoneName?: string; notes?: string;
  structureType?: string; structureLabel?: string; productCostCents?: number;
}): Promise<string | null> {
  const isApartment = (fields.structureType ?? 'apartment') === 'apartment';
  const { data, error } = await supabase.from('airbnbs').insert({
    name: fields.name,
    address: fields.address,
    structure_type: fields.structureType ?? 'apartment',
    structure_label: fields.structureLabel || null,
    product_cost_cents: fields.productCostCents ?? null,
    code_portail: fields.portalCode || null,
    code_boite: fields.keyboxCode || null,
    entry_instructions: fields.entryDirectives,
    partner_id: fields.partnerId || null,
    partner_name: fields.partnerName || null,
    // Chambres/lits/canapés : pertinents uniquement pour un logement.
    bedrooms: isApartment ? (fields.bedrooms ?? null) : null,
    beds: isApartment ? (fields.beds ?? null) : null,
    sofa_beds: isApartment ? (fields.sofaBeds ?? null) : null,
    client_price: fields.clientPrice ?? null,
    estimated_cleaning_minutes: fields.estimatedCleaningMinutes ?? 60,
    zone_color: fields.zoneColor || null,
    zone_name: fields.zoneName || null,
    notes: fields.notes || null,
  }).select('id').single();
  if (error) { console.error('createAirbnb error:', error.code, error.message); return null; }
  return data?.id ?? null;
}

export async function updateAirbnb(id: string, fields: {
  name: string; address: string; portalCode?: string; keyboxCode?: string;
  entryDirectives: string; partnerName?: string;
  bedrooms?: number; beds?: number; sofaBeds?: number; clientPrice?: number;
  estimatedCleaningMinutes?: number; zoneColor?: string; zoneName?: string; notes?: string;
  structureType?: string; structureLabel?: string; productCostCents?: number;
}) {
  const isApartment = (fields.structureType ?? 'apartment') === 'apartment';
  // Champs éditables par TOUT propriétaire de fiche (admin ET partenaire).
  const patch: Record<string, unknown> = {
    name: fields.name,
    address: fields.address,
    code_portail: fields.portalCode || null,
    code_boite: fields.keyboxCode || null,
    entry_instructions: fields.entryDirectives,
    bedrooms: isApartment ? (fields.bedrooms ?? null) : null,
    beds: isApartment ? (fields.beds ?? null) : null,
    sofa_beds: isApartment ? (fields.sofaBeds ?? null) : null,
    notes: fields.notes || null,
  };
  // Champs INTERNES / réservés à l'admin : on ne les écrit QUE s'ils sont
  // explicitement fournis. Ainsi une modification côté partenaire (son formulaire
  // ne les envoie pas) ne les écrase plus — notamment le temps de ménage (paie
  // cleaners) et le PRIX facturé, qui nous sont propres. Idem coût produits, zone,
  // nom du partenaire et type de structure.
  if (fields.clientPrice !== undefined) patch.client_price = fields.clientPrice;
  if (fields.estimatedCleaningMinutes !== undefined) patch.estimated_cleaning_minutes = fields.estimatedCleaningMinutes;
  if (fields.productCostCents !== undefined) patch.product_cost_cents = fields.productCostCents;
  if (fields.zoneColor !== undefined) patch.zone_color = fields.zoneColor || null;
  if (fields.zoneName !== undefined) patch.zone_name = fields.zoneName || null;
  if (fields.partnerName !== undefined) patch.partner_name = fields.partnerName || null;
  if (fields.structureType !== undefined) patch.structure_type = fields.structureType;
  if (fields.structureLabel !== undefined) patch.structure_label = fields.structureLabel || null;

  const { error } = await supabase.from('airbnbs').update(patch).eq('id', id);
  if (error) console.error('updateAirbnb error:', error.code, error.message);
  return { error: error?.message ?? null };
}

export async function deleteAirbnb(id: string) {
  const { error } = await supabase.from('airbnbs').delete().eq('id', id);
  if (error) console.error('deleteAirbnb error:', error.code, error.message);
}

export async function assignAirbnbCleaner(airbnbId: string, cleanerId: string | null) {
  await supabase.from('airbnbs').update({ cleaner_id: cleanerId }).eq('id', airbnbId);
}

// ── ZONES GÉOGRAPHIQUES ─────────────────────────────────────────────────────────

// Enregistre les coordonnées géocodées d'un appartement.
export async function setAirbnbCoordsDB(id: string, lat: number, lng: number) {
  const { error } = await supabase.from('airbnbs').update({ latitude: lat, longitude: lng }).eq('id', id);
  if (error) console.error('setAirbnbCoordsDB error:', error.code, error.message);
}

// Recalcule les zones de tous les appartements géolocalisés (clustering 2 km)
// et persiste zone_id / zone_color / zone_name. Renvoie le nombre de zones.
export async function regenerateZonesDB(): Promise<{ zones: number; assigned: number }> {
  const { data } = await supabase.from('airbnbs').select('id, latitude, longitude');
  const apts = (data ?? []).map((a: any) => ({
    id: a.id,
    latitude: a.latitude != null ? Number(a.latitude) : null,
    longitude: a.longitude != null ? Number(a.longitude) : null,
  }));
  const assignment = clusterApartments(apts);

  // Écrit chaque appartement (ceux sans coords sont remis à zone nulle).
  await Promise.all(apts.map(a => {
    const z = assignment.get(a.id);
    return supabase.from('airbnbs').update({
      zone_id: z?.zoneId ?? null,
      zone_color: z?.zoneColor ?? null,
      zone_name: z?.zoneName ?? null,
    }).eq('id', a.id);
  }));

  const zoneIds = new Set(Array.from(assignment.values()).map(z => z.zoneId));
  return { zones: zoneIds.size, assigned: assignment.size };
}
