// ── Partenaires : comptes Hôtels & Conciergeries (Airbnb) ────────────────────────
// Extrait de db.ts. Les créations/validations de comptes passent par les routes
// serveur (postServer) ; les lectures se font via le client (clé publique).

import { supabase } from '../supabase';
import { postServer } from './shared';

// ── HOTELS / ACCOUNTS ─────────────────────────────────────────────────────────

export async function getPendingHotelsDB() {
  const { data } = await supabase.from('hotels').select('*, users(name, email, phone)').eq('status_account', 'pending');
  return (data ?? []).map((h: any) => ({
    id: h.id,
    name: h.hotel_name,
    address: h.address,
    email: h.email ?? h.users?.email,
    phone: h.phone ?? h.users?.phone,
    userId: h.user_id,
  }));
}

export async function approveHotelDB(id: string) {
  try { await postServer('/api/admin/users', { action: 'approveHotel', id }); }
  catch (e) { console.error('approveHotelDB:', e); }
}

export async function refuseHotelDB(id: string) {
  await supabase.from('hotels').update({ status_account: 'refused' }).eq('id', id);
}

export async function registerHotelDB(fields: {
  name: string; address: string; email: string; phone: string; password: string;
}) {
  await postServer('/api/auth/register', {
    type: 'hotel', name: fields.name, address: fields.address, email: fields.email, phone: fields.phone, password: fields.password,
  });
}

export async function getApprovedHotelsDB() {
  const { data } = await supabase.from('hotels').select('*').eq('status_account', 'approved').order('hotel_name');
  return data ?? [];
}

// Taux horaire FACTURÉ à un hôtel (€/h) — propre à chaque hôtel, réglé par l'admin.
export async function updateHotelRateDB(hotelId: string, rate: number) {
  await supabase.from('hotels').update({ billing_hourly_rate: rate }).eq('id', hotelId);
}

export async function getHotelByUserId(userId: string) {
  const { data } = await supabase.from('hotels').select('*').eq('user_id', userId).single();
  return data;
}

// ── AIRBNB PARTNERS (comptes) ──────────────────────────────────────────────────

export async function registerAirbnbPartnerDB(fields: {
  name: string; email: string; phone: string; password: string;
}) {
  await postServer('/api/auth/register', {
    type: 'airbnb', name: fields.name, email: fields.email, phone: fields.phone, password: fields.password,
  });
}

export async function getAirbnbPartnerByUserId(userId: string) {
  const { data } = await supabase.from('airbnb_partners').select('*').eq('user_id', userId).single();
  return data;
}

export async function getPendingAirbnbPartnersDB() {
  const { data } = await supabase.from('airbnb_partners').select('*, users(name, email, phone)').eq('status_account', 'pending');
  return (data ?? []).map((p: any) => ({
    id: p.id,
    name: p.partner_name,
    email: p.email ?? p.users?.email,
    phone: p.phone ?? p.users?.phone,
    userId: p.user_id,
    partnerKind: 'airbnb' as const,
  }));
}

export async function approveAirbnbPartnerDB(id: string) {
  try { await postServer('/api/admin/users', { action: 'approveAirbnb', id }); }
  catch (e) { console.error('approveAirbnbPartnerDB:', e); }
}

export async function refuseAirbnbPartnerDB(id: string) {
  await supabase.from('airbnb_partners').update({ status_account: 'refused' }).eq('id', id);
}

// Liste des noms de partenaires connus (comptes + libellés saisis sur les apparts)
// — utile pour proposer une auto-complétion côté admin.
export async function getPartnerNamesDB(): Promise<string[]> {
  const [{ data: partners }, { data: apts }] = await Promise.all([
    supabase.from('airbnb_partners').select('partner_name').eq('status_account', 'approved'),
    supabase.from('airbnbs').select('partner_name'),
  ]);
  const names = new Set<string>();
  (partners ?? []).forEach((p: any) => p.partner_name && names.add(p.partner_name));
  (apts ?? []).forEach((a: any) => a.partner_name && names.add(a.partner_name));
  return Array.from(names).sort();
}
