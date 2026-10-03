// ── Appartements Airbnb + zones géographiques ────────────────────────────────────
// Extrait de db.ts.

import { supabase } from '../supabase';
import { clusterApartments } from '../zones';
import type { Apartment } from '../types';
import { postServer } from './shared';

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
    onSiteContactName: a.on_site_contact_name ?? undefined,
    onSiteContactPhone: a.on_site_contact_phone ?? undefined,
    lingeMode: a.linge_mode ?? 'aucun',
    lingeKits: a.linge_kits != null ? Number(a.linge_kits) : undefined,
    lingeForfait: a.linge_forfait != null ? Number(a.linge_forfait) : undefined,
    lingeLibelle: a.linge_libelle ?? undefined,
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
    // Fiche d'accueil (migration_fiche_logement.sql). Colonnes absentes tant
    // qu'elle n'est pas jouée : tout reste `undefined`, rien ne casse.
    wifiSsid: a.wifi_ssid ?? undefined,
    wifiPassword: a.wifi_password ?? undefined,
    wifiSecurity: a.wifi_security ?? undefined,
    checkinTime: a.checkin_time ?? undefined,
    checkoutTime: a.checkout_time ?? undefined,
    poubelles: a.poubelles ?? undefined,
    parking: a.parking ?? undefined,
    equipements: a.equipements ?? undefined,
    consignesDepart: a.consignes_depart ?? undefined,
    aProximite: a.a_proximite ?? undefined,
    accessVideoUrl: a.access_video_url ?? undefined,
    accessVideoPath: a.access_video_path ?? undefined,
    // Maison à annonces multiples : rattachement chambre → annonce entière, et
    // grille de forfaits par nombre de chambres (portée par l'annonce entière).
    parentAirbnbId: a.parent_airbnb_id ?? undefined,
    groupTiers: a.group_tiers ?? undefined,
  };
}

// ⚠️ Colonnes EXPLICITES, pas d'étoile : les champs d'accès (codes, directives,
// contact de secours) ne sont plus lisibles avec la clé publique. Une étoile
// les redemanderait et la requête entière serait refusée.
const APT_SELECT = 'id, name, address, structure_type, structure_label, product_cost_cents, '
  + 'linge_mode, linge_kits, linge_forfait, linge_libelle, '
  + 'cleaner_id, partner_id, partner_name, bedrooms, beds, sofa_beds, client_price, '
  + 'estimated_cleaning_minutes, latitude, longitude, zone_id, zone_color, zone_name, '
  + 'access_video_url, access_video_path, parent_airbnb_id, group_tiers, created_at, cleaners(name)';

/**
 * Complète les fiches avec leurs champs d'accès, via le serveur : l'admin
 * obtient tous les logements, un partenaire seulement les siens. Échec
 * silencieux — mieux vaut une fiche sans code qu'un écran vide.
 */
async function enrichirAcces(apts: Apartment[]): Promise<Apartment[]> {
  if (apts.length === 0) return apts;
  try {
    const res = await fetch('/api/airbnbs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'access', ids: apts.map(a => a.id) }),
    });
    if (!res.ok) return apts;
    const { acces } = await res.json();
    if (!acces) return apts;
    return apts.map(a => {
      const x = acces[a.id];
      return x ? {
        ...a,
        portalCode: x.portalCode ?? a.portalCode,
        keyboxCode: x.keyboxCode ?? a.keyboxCode,
        entryDirectives: x.entryDirectives ?? a.entryDirectives,
        notes: x.notes ?? a.notes,
        onSiteContactName: x.onSiteContactName ?? a.onSiteContactName,
        onSiteContactPhone: x.onSiteContactPhone ?? a.onSiteContactPhone,
      } : a;
    });
  } catch { return apts; }
}

export async function getAirbnbs(): Promise<Apartment[]> {
  const { data, error } = await supabase.from('airbnbs').select(APT_SELECT).order('created_at');
  if (error) console.error('getAirbnbs error:', error.code, error.message);
  return enrichirAcces((data ?? []).map(rowToApartment));
}

// Appartements d'un partenaire Airbnb (avec compte) — filtrés par partner_id
export async function getAirbnbsForPartner(userId: string): Promise<Apartment[]> {
  const { data, error } = await supabase
    .from('airbnbs')
    .select(APT_SELECT)
    .eq('partner_id', userId)
    .order('created_at');
  if (error) console.error('getAirbnbsForPartner error:', error.code, error.message);
  // Le partenaire ne doit PAS voir la durée de ménage (paramétrée par l'admin, elle
  // sert à la paie des cleaners) ni le gain cleaner : on les retire.
  const base = (data ?? []).map(rowToApartment)
    .map(a => ({ ...a, estimatedCleaningMinutes: undefined, cleanerGain: undefined }));
  return enrichirAcces(base);
}

// Réapplique les forfaits d'une maison partagée aux ménages À VENIR.
// Sans ça, changer un tarif n'avait d'effet que sur les missions créées ensuite :
// celles déjà au planning gardaient l'ancien prix, en silence.
// Les missions DÉJÀ ASSIGNÉES ne sont pas touchées — la durée pilote la paie du
// cleaner, on ne la modifie pas dans son dos une fois qu'il l'a acceptée.
export async function recalcGroupMissionsDB(houseId: string): Promise<{ updated: number; skipped: number }> {
  // Écrit des prix : côté serveur (cf. lib/missionActions.ts, 'recalc-group').
  try {
    const d = await postServer('/api/missions', { action: 'recalc-group', houseId });
    return { updated: Number(d.updated) || 0, skipped: Number(d.skipped) || 0 };
  } catch (e) {
    console.error('recalcGroupMissionsDB:', e);
    return { updated: 0, skipped: 0 };
  }
}

// ── Contact de secours : colonnes optionnelles ────────────────────────────────
// `on_site_contact_name` / `on_site_contact_phone` n'existent qu'une fois
// migration_contact_terrain.sql jouée. Tant qu'elle ne l'est pas, créer ou
// modifier un logement doit continuer de marcher — sans le contact, pas d'échec.
// On le détecte une fois (42703 : colonne inconnue) et on n'insiste plus.
// ── Écritures : par le serveur ───────────────────────────────────────────────
// Cette table porte l'adresse exacte, le code du portail, celui de la boîte à
// clés et les directives d'entrée : de quoi entrer chez les clients de nos
// clients. Les écritures passent par /api/airbnbs, qui vérifie la session et,
// pour un partenaire, que le logement lui appartient — et qui ignore les
// champs qui nous sont propres (prix facturé, temps de ménage, zone).
async function ecrireLogement(payload: Record<string, unknown>): Promise<{ error: string | null; id?: string | null }> {
  try {
    const res = await fetch('/api/airbnbs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: String(data.error ?? 'Enregistrement impossible.') };
    return { error: null, id: (data.id as string) ?? null };
  } catch {
    return { error: 'Connexion impossible. Réessayez.' };
  }
}

async function insertApartment(row: Record<string, unknown>) {
  const res = await ecrireLogement({ action: 'create', row });
  return { data: res.id ? { id: res.id } : null, error: res.error ? { message: res.error, code: '' } : null };
}

async function patchApartment(id: string, patch: Record<string, unknown>) {
  const res = await ecrireLogement({ action: 'update', id, patch });
  return { error: res.error ? { message: res.error, code: '' } : null };
}

export async function createAirbnb(fields: {
  name: string; address: string; portalCode?: string; keyboxCode?: string;
  onSiteContactName?: string; onSiteContactPhone?: string;
  entryDirectives: string; partnerId?: string; partnerName?: string;
  lingeMode?: string; lingeKits?: number | null; lingeForfait?: number | null; lingeLibelle?: string | null;
  bedrooms?: number; beds?: number; sofaBeds?: number; clientPrice?: number;
  estimatedCleaningMinutes?: number; zoneColor?: string; zoneName?: string; notes?: string;
  structureType?: string; structureLabel?: string; productCostCents?: number;
  parentAirbnbId?: string | null;
  groupTiers?: Record<string, { price?: number; minutes?: number }> | null;
}): Promise<string | null> {
  const isApartment = (fields.structureType ?? 'apartment') === 'apartment';
  const { data, error } = await insertApartment({
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
    parent_airbnb_id: fields.parentAirbnbId || null,
    group_tiers: fields.groupTiers ?? null,
    on_site_contact_name: fields.onSiteContactName || null,
    on_site_contact_phone: fields.onSiteContactPhone || null,
    linge_mode: fields.lingeMode || 'aucun',
    linge_kits: fields.lingeKits ?? null,
    linge_forfait: fields.lingeForfait ?? null,
    linge_libelle: fields.lingeLibelle || null,
  });
  if (error) { console.error('createAirbnb error:', error.code, error.message); return null; }
  return data?.id ?? null;
}

/** Les champs de la fiche d'accueil, remplis par la conciergerie. */
export interface ChampsFiche {
  wifiSsid?: string; wifiPassword?: string; wifiSecurity?: string;
  checkinTime?: string; checkoutTime?: string;
  poubelles?: string; parking?: string; equipements?: string;
  consignesDepart?: string; aProximite?: string;
}

/** Les colonnes correspondantes. Une valeur vide efface, elle ne garde pas. */
export function colonnesFiche(f: ChampsFiche): Record<string, string | null> {
  const v = (x?: string) => (x ?? '').trim() || null;
  return {
    wifi_ssid: v(f.wifiSsid),
    wifi_password: v(f.wifiPassword),
    wifi_security: v(f.wifiSecurity),
    checkin_time: v(f.checkinTime),
    checkout_time: v(f.checkoutTime),
    poubelles: v(f.poubelles),
    parking: v(f.parking),
    equipements: v(f.equipements),
    consignes_depart: v(f.consignesDepart),
    a_proximite: v(f.aProximite),
  };
}

/**
 * Enregistre la fiche d'accueil d'un logement.
 *
 * Écriture à part de `updateAirbnb` : la conciergerie remplit sa fiche depuis
 * son propre espace, sans toucher au tarif, à la durée ni au linge — des champs
 * qui ne lui appartiennent pas.
 */
export async function saveFicheLogement(
  airbnbId: string, champs: ChampsFiche,
): Promise<{ error: string | null }> {
  // Par le serveur (admin ou conciergerie du logement) : la table des logements
  // n'accepte pas d'écriture avec la clé publique — aucune fiche n'avait pu
  // être enregistrée.
  try { await postServer('/api/annexes', { op: 'fiche-save', airbnbId, champs }); return { error: null }; }
  catch (e) {
    const m = e instanceof Error ? e.message : 'Enregistrement impossible.';
    console.error('saveFicheLogement:', m);
    return { error: m };
  }
}

export async function updateAirbnb(id: string, fields: {
  name: string; address: string; portalCode?: string; keyboxCode?: string;
  onSiteContactName?: string; onSiteContactPhone?: string;
  entryDirectives: string; partnerName?: string;
  lingeMode?: string; lingeKits?: number | null; lingeForfait?: number | null; lingeLibelle?: string | null;
  bedrooms?: number; beds?: number; sofaBeds?: number; clientPrice?: number;
  estimatedCleaningMinutes?: number; zoneColor?: string; zoneName?: string; notes?: string;
  structureType?: string; structureLabel?: string; productCostCents?: number;
  parentAirbnbId?: string | null;
  groupTiers?: Record<string, { price?: number; minutes?: number }> | null;
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
  if (fields.onSiteContactName !== undefined) patch.on_site_contact_name = fields.onSiteContactName || null;
  if (fields.onSiteContactPhone !== undefined) patch.on_site_contact_phone = fields.onSiteContactPhone || null;
  // Fourniture facturée : c'est du prix, donc réservé à l'admin (le formulaire
  // partenaire ne l'envoie pas, et la route l'ignorerait de toute façon).
  if (fields.lingeMode !== undefined) patch.linge_mode = fields.lingeMode || 'aucun';
  if (fields.lingeKits !== undefined) patch.linge_kits = fields.lingeKits ?? null;
  if (fields.lingeForfait !== undefined) patch.linge_forfait = fields.lingeForfait ?? null;
  if (fields.lingeLibelle !== undefined) patch.linge_libelle = fields.lingeLibelle || null;
  if (fields.structureType !== undefined) patch.structure_type = fields.structureType;
  if (fields.structureLabel !== undefined) patch.structure_label = fields.structureLabel || null;
  // Rattachement et forfaits : réglages admin, même règle (écrits seulement si fournis).
  if (fields.parentAirbnbId !== undefined) patch.parent_airbnb_id = fields.parentAirbnbId || null;
  if (fields.groupTiers !== undefined) patch.group_tiers = fields.groupTiers ?? null;

  const { error } = await patchApartment(id, patch);
  if (error) console.error('updateAirbnb error:', error.code, error.message);
  return { error: error?.message ?? null };
}

export async function deleteAirbnb(id: string) {
  const res = await ecrireLogement({ action: 'delete', id });
  if (res.error) console.error('deleteAirbnb error:', res.error);
}

export async function assignAirbnbCleaner(airbnbId: string, cleanerId: string | null) {
  const res = await ecrireLogement({ action: 'assign-cleaner', id: airbnbId, cleanerId });
  if (res.error) console.error('assignAirbnbCleaner error:', res.error);
}

// ── ZONES GÉOGRAPHIQUES ─────────────────────────────────────────────────────────

// Enregistre les coordonnées géocodées d'un appartement.
export async function setAirbnbCoordsDB(id: string, lat: number, lng: number) {
  const res = await ecrireLogement({ action: 'set-coords', id, lat, lng });
  if (res.error) console.error('setAirbnbCoordsDB error:', res.error);
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
  // En une seule requête serveur : la table n'est plus écrite par le navigateur.
  const res = await ecrireLogement({
    action: 'set-zones',
    zones: apts.map(a => {
      const z = assignment.get(a.id);
      return {
        id: a.id,
        zoneId: z?.zoneId ?? null,
        zoneColor: z?.zoneColor ?? null,
        zoneName: z?.zoneName ?? null,
      };
    }),
  });
  if (res.error) console.error('regenerateZonesDB:', res.error);

  const zoneIds = new Set(Array.from(assignment.values()).map(z => z.zoneId));
  return { zones: zoneIds.size, assigned: assignment.size };
}
