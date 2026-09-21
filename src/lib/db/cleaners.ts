// ── Cleaners (employés) ──────────────────────────────────────────────────────────
// Extrait de db.ts. Les opérations sensibles (création, mot de passe, infos liées au
// compte users) passent par la route serveur /api/admin/users (postServer).

import { supabase } from '../supabase';
import { postServer } from './shared';
import { getServerDb } from '../serverDb';

// ── Lecture : par le serveur ─────────────────────────────────────────────────
// La table porte l'e-mail, le téléphone, le TAUX HORAIRE et le type de contrat
// de chaque salarié. Ces colonnes ne sont plus lisibles avec la clé publique :
// /api/cleaners les rend à l'admin, et à chacun sa propre fiche.
export interface CleanerRecord {
  id: string;
  user_id?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  status?: string | null;
  hourly_rate?: number | null;
  delivery_rate?: number | null;
  can_clean?: boolean | null;
  can_deliver?: boolean | null;
  employment_type?: string | null;
  license_plate?: string | null;
  formation_completee?: boolean | null;
  created_at?: string | null;
}

// Toutes les colonnes, y compris la rémunération : réservées au serveur et à
// l'admin (cf. /api/cleaners).
const CLEANER_COLONNES = 'id, user_id, name, status, can_clean, can_deliver, formation_completee, '
  + 'created_at, email, phone, hourly_rate, delivery_rate, employment_type, license_plate';

async function lireCleaners(payload: Record<string, unknown>): Promise<CleanerRecord[]> {
  // CÔTÉ SERVEUR (moteur RH, fiches de paie, crons) : on lit directement en
  // service_role. Passer par la route serait une URL relative, qui n'existe pas
  // hors navigateur — c'est ce qui vidait les salaires de la comptabilité.
  if (typeof window === 'undefined') {
    try {
      const db = getServerDb();
      let q = db.from('cleaners').select(CLEANER_COLONNES);
      if (payload.activeOnly) q = q.eq('status', 'active');
      const { data } = await q.order('created_at');
      return (data ?? []) as unknown as CleanerRecord[];
    } catch (e) { console.error('lireCleaners (serveur):', e); return []; }
  }

  // CÔTÉ NAVIGATEUR : par la route, qui décide de ce qu'on a le droit de voir.
  try {
    const res = await fetch('/api/cleaners', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.cleaners ?? [];
  } catch { return []; }
}

export async function getCleaners() {
  return lireCleaners({ op: 'list' });
}

export async function getActiveCleanersDB() {
  return lireCleaners({ op: 'list', activeOnly: true });
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
  // Côté serveur : lecture directe (une URL relative n'existe pas hors navigateur).
  if (typeof window === 'undefined') {
    const { data } = await getServerDb().from('cleaners')
      .select(CLEANER_COLONNES).eq('user_id', userId).maybeSingle();
    if (data) return data;
  }
  // Sa propre fiche, complète : un cleaner a le droit de connaître son taux.
  try {
    const res = await fetch('/api/cleaners', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'self', userId }),
    });
    if (res.ok) {
      const { cleaner } = await res.json();
      if (cleaner) return cleaner;
    }
  } catch { /* repli ci-dessous */ }
  // Repli : la fiche utilisateur, quand aucune ligne `cleaners` n'existe.
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
