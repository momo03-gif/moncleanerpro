// ── Partenaires : comptes Hôtels & Conciergeries (Airbnb) ────────────────────────
// Données PII (clients/partenaires) → tout passe par la route serveur /api/partners
// (service_role, autorisation par session). La clé publique ne lit/écrit plus ces
// tables (verrouillées RLS). Les créations de compte gardent leurs routes dédiées.

import { getServer, postServer } from './shared';

// ── HOTELS / ACCOUNTS ─────────────────────────────────────────────────────────

export async function getPendingHotelsDB() {
  try { const d = await getServer('/api/partners?op=pendingHotels'); return d.hotels ?? []; }
  catch { return []; }
}

export async function approveHotelDB(id: string) {
  try { await postServer('/api/admin/users', { action: 'approveHotel', id }); }
  catch (e) { console.error('approveHotelDB:', e); }
}

export async function refuseHotelDB(id: string) {
  try { await postServer('/api/partners', { op: 'refuseHotel', id }); }
  catch (e) { console.error('refuseHotelDB:', e); }
}

export async function registerHotelDB(fields: {
  name: string; address: string; email: string; phone: string; password: string;
}) {
  await postServer('/api/auth/register', {
    type: 'hotel', name: fields.name, address: fields.address, email: fields.email, phone: fields.phone, password: fields.password,
  });
}

export async function getApprovedHotelsDB() {
  try { const d = await getServer('/api/partners?op=approvedHotels'); return d.hotels ?? []; }
  catch { return []; }
}

// Taux horaire FACTURÉ à un hôtel (€/h) — propre à chaque hôtel, réglé par l'admin.
export async function updateHotelRateDB(hotelId: string, rate: number) {
  try { await postServer('/api/partners', { op: 'updateHotelRate', hotelId, rate }); }
  catch (e) { console.error('updateHotelRateDB:', e); }
}

export async function getHotelByUserId(userId: string) {
  try { const d = await getServer(`/api/partners?op=hotelByUser&userId=${encodeURIComponent(userId)}`); return d.hotel ?? null; }
  catch { return null; }
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
  try { const d = await getServer(`/api/partners?op=airbnbPartnerByUser&userId=${encodeURIComponent(userId)}`); return d.partner ?? null; }
  catch { return null; }
}

export async function getPendingAirbnbPartnersDB() {
  try { const d = await getServer('/api/partners?op=pendingAirbnbPartners'); return d.partners ?? []; }
  catch { return []; }
}

export async function approveAirbnbPartnerDB(id: string) {
  try { await postServer('/api/admin/users', { action: 'approveAirbnb', id }); }
  catch (e) { console.error('approveAirbnbPartnerDB:', e); }
}

export async function refuseAirbnbPartnerDB(id: string) {
  try { await postServer('/api/partners', { op: 'refuseAirbnbPartner', id }); }
  catch (e) { console.error('refuseAirbnbPartnerDB:', e); }
}

// Liste des noms de partenaires connus (comptes + libellés saisis sur les apparts)
// — utile pour proposer une auto-complétion côté admin.
export async function getPartnerNamesDB(): Promise<string[]> {
  try { const d = await getServer('/api/partners?op=partnerNames'); return d.names ?? []; }
  catch { return []; }
}
