// ── Cleaners (employés) ──────────────────────────────────────────────────────────
// Extrait de db.ts. Les opérations sensibles (création, mot de passe, infos liées au
// compte users) passent par la route serveur /api/admin/users (postServer).

import { supabase } from '../supabase';
import { postServer } from './shared';

export async function getCleaners() {
  const { data: cleaners } = await supabase.from('cleaners').select('*').order('created_at');
  if (cleaners && cleaners.length > 0) return cleaners;

  // Fallback: get cleaners from users table directly (jamais password_hash : colonne
  // révoquée à la clé publique, donc on liste explicitement les colonnes lisibles)
  const { data: users } = await supabase.from('users').select('id, name, email, phone, status').eq('role', 'cleaner');
  return (users ?? []).map(u => ({
    id: u.id, user_id: u.id, name: u.name, email: u.email, phone: u.phone ?? null,
    hourly_rate: 0, status: u.status ?? 'active', can_clean: true, can_deliver: false, delivery_rate: 0,
  }));
}

export async function getActiveCleanersDB() {
  const { data: cleaners } = await supabase.from('cleaners').select('*').eq('status', 'active');
  if (cleaners && cleaners.length > 0) return cleaners;

  // Fallback: get from users table — id = users.id, consistent with missions.cleaner_id
  const { data: users } = await supabase.from('users').select('id, name, email, phone, status').eq('role', 'cleaner').eq('status', 'active');
  return (users ?? []).map(u => ({
    id: u.id, user_id: u.id, name: u.name, email: u.email, phone: u.phone ?? null,
    hourly_rate: 0, status: 'active', can_clean: true, can_deliver: false, delivery_rate: 0,
  }));
}

export async function createCleaner(fields: {
  name: string; email: string; phone?: string;
  password: string; hourlyRate?: number;
  canClean?: boolean; canDeliver?: boolean; deliveryRate?: number;
}) {
  try {
    await postServer('/api/admin/users', {
      action: 'createCleaner',
      name: fields.name, email: fields.email, phone: fields.phone, password: fields.password,
      hourlyRate: fields.hourlyRate, canClean: fields.canClean, canDeliver: fields.canDeliver, deliveryRate: fields.deliveryRate,
    });
  } catch (e) {
    console.error('createCleaner:', e);
  }
}

export async function setCleanerActive(id: string, active: boolean) {
  try { await postServer('/api/cleaners', { op: 'setActive', id, active }); }
  catch (e) { console.error('setCleanerActive:', e); }
}

export async function updateCleanerInfoDB(id: string, fields: { name: string; email: string; phone?: string }) {
  try {
    await postServer('/api/admin/users', { action: 'updateCleanerInfo', id, name: fields.name, email: fields.email, phone: fields.phone });
    return { error: null };
  } catch (e: any) {
    return { error: e?.message ?? 'Erreur' };
  }
}

export async function deleteCleanerDB(id: string) {
  // missions.cleaner_id est FK ON DELETE SET NULL → les missions sont conservées
  try { await postServer('/api/admin/users', { action: 'deleteCleaner', id }); }
  catch (e) { console.error('deleteCleanerDB:', e); }
}

export async function updateCleanerHourlyRateDB(id: string, hourlyRate: number) {
  try { await postServer('/api/cleaners', { op: 'hourlyRate', id, hourlyRate }); }
  catch (e) { console.error('updateCleanerHourlyRateDB:', e); }
}

// Capacités du cleaner : peut faire du nettoyage / de la livraison.
export async function updateCleanerCapabilitiesDB(id: string, caps: { canClean: boolean; canDeliver: boolean }) {
  try { await postServer('/api/cleaners', { op: 'capabilities', id, canClean: caps.canClean, canDeliver: caps.canDeliver }); }
  catch (e) { console.error('updateCleanerCapabilitiesDB:', e); }
}

// Montant fixe gagné par livraison (admin).
export async function updateCleanerDeliveryRateDB(id: string, deliveryRate: number) {
  try { await postServer('/api/cleaners', { op: 'deliveryRate', id, deliveryRate }); }
  catch (e) { console.error('updateCleanerDeliveryRateDB:', e); }
}

// Type de contrat du cleaner (admin) : 'auto' (auto-entrepreneur) ou 'cdi' (charges
// patronales en sus). Impacte le coût réel dans le calcul de rentabilité.
export async function updateCleanerEmploymentTypeDB(id: string, employmentType: 'auto' | 'cdi') {
  try { await postServer('/api/cleaners', { op: 'employmentType', id, employmentType }); }
  catch (e) { console.error('updateCleanerEmploymentTypeDB:', e); }
}

// Plaque d'immatriculation du véhicule du livreur (pour le paiement du stationnement).
// Résout users.id → cleaners.id côté serveur, comme updateCleanerStatusDB.
export async function updateCleanerLicensePlateDB(userId: string, plate: string): Promise<boolean> {
  try { const d = await postServer('/api/cleaners', { op: 'licensePlate', userId, plate }); return !!d.ok; }
  catch (e) { console.warn('updateCleanerLicensePlateDB:', e); return false; }
}

export async function updateCleanerPasswordDB(cleanerId: string, newPassword: string) {
  try { await postServer('/api/admin/users', { action: 'setCleanerPassword', cleanerId, password: newPassword }); }
  catch (e) { console.error('updateCleanerPasswordDB:', e); }
}

export async function getCleanerByUserId(userId: string) {
  const { data } = await supabase.from('cleaners').select('*').eq('user_id', userId).single();
  if (data) return data;
  // Fallback: return user row if no cleaners entry (sans password_hash — colonne révoquée)
  const { data: user } = await supabase.from('users').select('id, name, email, phone, status, role').eq('id', userId).single();
  return user;
}

// ── Disponibilité (statut + jours travaillés) ────────────────────────────────────

export async function updateCleanerStatusDB(userId: string, status: 'available' | 'busy' | 'offline'): Promise<boolean> {
  try { const d = await postServer('/api/cleaners', { op: 'status', userId, status }); return !!d.ok; }
  catch (e) { console.warn('updateCleanerStatusDB:', e); return false; }
}

export async function updateCleanerAvailableDaysDB(userId: string, days: string[]): Promise<boolean> {
  try { const d = await postServer('/api/cleaners', { op: 'availableDays', userId, days }); return !!d.ok; }
  catch (e) { console.warn('updateCleanerAvailableDaysDB:', e); return false; }
}
