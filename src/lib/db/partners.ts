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
  clientType?: 'hotel' | 'ehpad';
}) {
  await postServer('/api/auth/register', {
    type: 'hotel', name: fields.name, address: fields.address, email: fields.email, phone: fields.phone, password: fields.password,
    clientType: fields.clientType === 'ehpad' ? 'ehpad' : 'hotel',
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

// Corrige le type d'un compte hôtelier (hôtel ↔ EHPAD) — admin uniquement.
export async function updateHotelClientTypeDB(hotelId: string, clientType: 'hotel' | 'ehpad'): Promise<{ error: string | null }> {
  try { await postServer('/api/partners', { op: 'updateHotelClientType', hotelId, clientType }); return { error: null }; }
  catch (e) { return { error: e instanceof Error ? e.message : 'Modification impossible.' }; }
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

// ── FICHES D'ADMINISTRATION DES COMPTES PARTENAIRES ─────────────────────────────
// Vue unifiée (hôtels + conciergeries) validés/suspendus + actions admin.

export type PartnerKind = 'hotel' | 'airbnb';
export interface PartnerAccount {
  id: string;
  userId: string | null;
  kind: PartnerKind;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: 'approved' | 'suspended';
  // Hôtels uniquement : facturation propre à la fiche.
  billingHourlyRate?: number | null;
  clientType?: 'hotel' | 'ehpad';
}

export async function getPartnerAccountsDB(): Promise<PartnerAccount[]> {
  try { const d = await getServer('/api/partners?op=partnerAccounts'); return d.accounts ?? []; }
  catch { return []; }
}

// Modifie les coordonnées d'un partenaire (fiche + compte users lié).
export async function updatePartnerInfoDB(
  kind: PartnerKind, id: string,
  fields: { name: string; email: string; phone?: string; address?: string },
): Promise<{ error: string | null }> {
  try {
    await postServer('/api/admin/users', { action: 'updatePartnerInfo', kind, id, ...fields });
    return { error: null };
  } catch (e) { return { error: e instanceof Error ? e.message : 'Modification impossible.' }; }
}

// Réinitialise le mot de passe du compte partenaire.
export async function setPartnerPasswordDB(kind: PartnerKind, id: string, password: string): Promise<{ error: string | null }> {
  try { await postServer('/api/admin/users', { action: 'setPartnerPassword', kind, id, password }); return { error: null }; }
  catch (e) { return { error: e instanceof Error ? e.message : 'Modification impossible.' }; }
}

// Suspend (bloque la connexion) ou réactive un compte partenaire.
export async function setPartnerStatusDB(kind: PartnerKind, id: string, suspend: boolean): Promise<{ error: string | null }> {
  try { await postServer('/api/admin/users', { action: 'setPartnerStatus', kind, id, suspend }); return { error: null }; }
  catch (e) { return { error: e instanceof Error ? e.message : 'Modification impossible.' }; }
}

// Supprime définitivement la fiche partenaire + son compte.
export async function deletePartnerAccountDB(kind: PartnerKind, id: string): Promise<{ error: string | null }> {
  try { await postServer('/api/admin/users', { action: 'deletePartner', kind, id }); return { error: null }; }
  catch (e) { return { error: e instanceof Error ? e.message : 'Suppression impossible.' }; }
}

// Liste des noms de partenaires connus (comptes + libellés saisis sur les apparts)
// — utile pour proposer une auto-complétion côté admin.
export async function getPartnerNamesDB(): Promise<string[]> {
  try { const d = await getServer('/api/partners?op=partnerNames'); return d.names ?? []; }
  catch { return []; }
}
