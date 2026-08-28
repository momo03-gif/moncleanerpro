import { supabase } from './supabase';
import { saveInvoiceDB } from './db';

// ══════════════════════════════════════════════════════════════════════════════
//  Module Devis + Grille tarifaire (LOT 8 / 8A / 8B) — couche d'accès données.
//  Réutilise saveInvoiceDB pour la conversion devis → facture (pas de duplication).
// ══════════════════════════════════════════════════════════════════════════════

export type TarifUnite = 'forfait' | 'm2' | 'heure' | 'piece';
export const UNITE_LABEL: Record<TarifUnite, string> = { forfait: 'Forfait', m2: 'au m²', heure: 'par heure', piece: 'par pièce' };

export interface Tarif {
  id: string; nom: string; unite: TarifUnite; prix: number; actif: boolean;
  // Synonymes/variantes séparés par des virgules (« vitres, fenêtres, baies ») → précision de l'agent local.
  motsCles?: string;
  // Fourchette d'estimation. null = pas de fourchette (on utilise `prix` des deux côtés).
  prixMin?: number | null; prixMax?: number | null;
  // Catégorie de regroupement pour la page publique (ex. « Vitrerie »).
  categorie?: string;
}
export interface DevisLine { nom: string; quantite: number; prix_unitaire: number; total: number; }
export type DevisStatus = 'brouillon' | 'envoye' | 'accepte' | 'refuse';
export interface Devis {
  id: string; number: string; partnerLabel: string; partnerType?: string;
  clientName?: string; clientEmail?: string; clientAddress?: string; description?: string;
  lines: DevisLine[]; total: number; status: DevisStatus; validUntil?: string;
  publicToken: string; source: 'admin' | 'public'; invoiceId?: string; createdAt?: string;
  // Corrections d'un devis déjà envoyé : même numéro, même lien, version incrémentée.
  revision: number; revisionNote?: string; revisedAt?: string;
  previousLines?: DevisLine[]; previousTotal?: number;
}

const toTarif = (r: any): Tarif => ({
  id: r.id, nom: r.nom_prestation, unite: r.unite, prix: Number(r.prix_unitaire) || 0, actif: !!r.actif,
  motsCles: r.mots_cles ?? undefined,
  prixMin: r.prix_min != null ? Number(r.prix_min) : null,
  prixMax: r.prix_max != null ? Number(r.prix_max) : null,
  categorie: r.categorie ?? undefined,
});
const toDevis = (r: any): Devis => ({
  id: r.id, number: r.number ?? '', partnerLabel: r.partner_label ?? '', partnerType: r.partner_type ?? undefined,
  clientName: r.client_name ?? undefined, clientEmail: r.client_email ?? undefined, clientAddress: r.client_address ?? undefined,
  description: r.description ?? undefined, lines: Array.isArray(r.lines) ? r.lines : [], total: Number(r.total) || 0,
  status: r.status ?? 'brouillon', validUntil: r.valid_until ?? undefined, publicToken: r.public_token,
  source: r.source ?? 'admin', invoiceId: r.invoice_id ?? undefined, createdAt: r.created_at ?? undefined,
  revision: Number(r.revision) || 1, revisionNote: r.revision_note ?? undefined, revisedAt: r.revised_at ?? undefined,
  previousLines: Array.isArray(r.previous_lines) ? r.previous_lines : undefined,
  previousTotal: r.previous_total != null ? Number(r.previous_total) : undefined,
});

// ── TARIFS ────────────────────────────────────────────────────────────────────
export async function getTarifsDB(activeOnly = false): Promise<Tarif[]> {
  let q = supabase.from('tarifs').select('*').order('created_at');
  if (activeOnly) q = q.eq('actif', true);
  const { data, error } = await q;
  if (error) { console.error('getTarifsDB:', error.code, error.message); return []; }
  return (data ?? []).map(toTarif);
}
export async function createTarifDB(f: { nom: string; unite: TarifUnite; prix: number; motsCles?: string; prixMin?: number | null; prixMax?: number | null; categorie?: string }) {
  const { error } = await supabase.from('tarifs').insert({
    nom_prestation: f.nom, unite: f.unite, prix_unitaire: f.prix,
    mots_cles: f.motsCles ?? null, prix_min: f.prixMin ?? null, prix_max: f.prixMax ?? null, categorie: f.categorie ?? null,
  });
  return { error: error?.message ?? null };
}
export async function updateTarifDB(id: string, f: { nom?: string; unite?: TarifUnite; prix?: number; actif?: boolean; motsCles?: string | null; prixMin?: number | null; prixMax?: number | null; categorie?: string | null }) {
  const patch: Record<string, unknown> = {};
  if (f.nom !== undefined) patch.nom_prestation = f.nom;
  if (f.unite !== undefined) patch.unite = f.unite;
  if (f.prix !== undefined) patch.prix_unitaire = f.prix;
  if (f.actif !== undefined) patch.actif = f.actif;
  if (f.motsCles !== undefined) patch.mots_cles = f.motsCles;
  if (f.prixMin !== undefined) patch.prix_min = f.prixMin;
  if (f.prixMax !== undefined) patch.prix_max = f.prixMax;
  if (f.categorie !== undefined) patch.categorie = f.categorie;
  const { error } = await supabase.from('tarifs').update(patch).eq('id', id);
  return { error: error?.message ?? null };
}

// Import CSV → grille tarifs. Upsert par NOM (met à jour si le nom existe déjà,
// sinon insère) : ré-importer un fichier corrigé ne crée pas de doublons.
export async function importTarifsDB(rows: {
  nom: string; unite: TarifUnite; prix: number; motsCles?: string; prixMin?: number | null; prixMax?: number | null; categorie?: string;
}[]): Promise<{ error: string | null; inserted: number; updated: number }> {
  const clean = rows.filter(r => r.nom.trim());
  if (clean.length === 0) return { error: 'Aucune ligne valide dans le fichier.', inserted: 0, updated: 0 };
  const { data: existing, error: exErr } = await supabase.from('tarifs').select('id, nom_prestation');
  if (exErr) return { error: exErr.message, inserted: 0, updated: 0 };
  const byName = new Map((existing ?? []).map((r: any) => [String(r.nom_prestation).toLowerCase().trim(), r.id]));
  let inserted = 0, updated = 0;
  for (const r of clean) {
    const id = byName.get(r.nom.toLowerCase().trim());
    if (id) {
      const res = await updateTarifDB(id, { unite: r.unite, prix: r.prix, motsCles: r.motsCles ?? null, prixMin: r.prixMin ?? null, prixMax: r.prixMax ?? null, categorie: r.categorie ?? null, actif: true });
      if (res.error) return { error: res.error, inserted, updated };
      updated++;
    } else {
      const res = await createTarifDB(r);
      if (res.error) return { error: res.error, inserted, updated };
      inserted++;
    }
  }
  return { error: null, inserted, updated };
}
export async function deleteTarifDB(id: string) {
  const { error } = await supabase.from('tarifs').delete().eq('id', id);
  return { error: error?.message ?? null };
}

// Agent d'estimation LOCAL (sans IA externe) — module pur, réexporté ici pour que
// les appelants continuent d'importer depuis '@/lib/devis'.
export { estimateFromDescription, rangeForLines, tarifRange } from './devisEstimate';

// ── DEVIS ─────────────────────────────────────────────────────────────────────
export async function getDevisListDB(): Promise<Devis[]> {
  const { data, error } = await supabase.from('devis').select('*').order('created_at', { ascending: false });
  if (error) { console.error('getDevisListDB:', error.code, error.message); return []; }
  return (data ?? []).map(toDevis);
}
// Demandes de devis reçues et pas encore chiffrées — la pastille de l'entrée
// « Devis » du menu. Les demandes ne passent plus par la cloche : ce compteur est
// ce qui les rend visibles, et il ne retombe que lorsqu'elles sont traitées.
export async function getDevisPendingCountDB(): Promise<number> {
  const { count } = await supabase
    .from('devis')
    .select('id', { count: 'exact', head: true })
    .eq('source', 'public')
    .eq('status', 'brouillon');
  return count ?? 0;
}

export async function getDevisByTokenDB(token: string): Promise<Devis | null> {
  const { data } = await supabase.from('devis').select('*').eq('public_token', token).single();
  return data ? toDevis(data) : null;
}

// Numéro auto DEV-AAAA-0001 (incrément annuel).
export async function nextDevisNumberDB(): Promise<string> {
  const year = new Date().getFullYear();
  const { data } = await supabase.from('devis').select('number').like('number', `DEV-${year}-%`);
  const max = (data ?? []).reduce((m, r: any) => {
    const n = parseInt(String(r.number).split('-')[2] ?? '0', 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `DEV-${year}-${String(max + 1).padStart(4, '0')}`;
}

export async function saveDevisDB(f: {
  number: string; partnerLabel: string; partnerType?: string;
  clientName?: string; clientEmail?: string; clientAddress?: string; description?: string;
  lines: DevisLine[]; total: number; validUntil?: string; status?: DevisStatus; source?: 'admin' | 'public';
}): Promise<{ error: string | null; id: string | null }> {
  const { data, error } = await supabase.from('devis').insert({
    number: f.number, partner_label: f.partnerLabel, partner_type: f.partnerType || null,
    client_name: f.clientName || null, client_email: f.clientEmail || null, client_address: f.clientAddress || null,
    description: f.description || null, lines: f.lines, total: f.total, valid_until: f.validUntil || null,
    status: f.status ?? 'brouillon', source: f.source ?? 'admin',
  }).select('id').single();
  if (error) { console.error('saveDevisDB:', error.code, error.message); return { error: error.message, id: null }; }
  return { error: null, id: data?.id ?? null };
}

// Met à jour le CONTENU d'un devis existant (rouvrir un brouillon → modifier →
// ré-enregistrer le MÊME devis, sans en créer un nouveau). Le numéro ne change pas.
export async function updateDevisDB(id: string, f: {
  clientName?: string; clientEmail?: string; clientAddress?: string; description?: string;
  lines: DevisLine[]; total: number; validUntil?: string; status?: DevisStatus;
}): Promise<{ error: string | null }> {
  const patch: Record<string, unknown> = {
    partner_label: f.clientName || 'Client',
    client_name: f.clientName || null, client_email: f.clientEmail || null, client_address: f.clientAddress || null,
    description: f.description || null, lines: f.lines, total: f.total, valid_until: f.validUntil || null,
  };
  if (f.status) patch.status = f.status;
  const { error } = await supabase.from('devis').update(patch).eq('id', id);
  if (error) console.error('updateDevisDB:', error.code, error.message);
  return { error: error?.message ?? null };
}

// CORRECTION d'un devis DÉJÀ ENVOYÉ (le client s'est trompé de prestation, un
// élément manquait…). On garde le MÊME devis : même numéro, même lien public —
// le client n'a qu'une seule adresse à retenir. On incrémente la version, on
// archive le contenu précédent (pour lui montrer ce qui change) et on enregistre
// le mot d'explication. Une décision déjà prise (accepté/refusé) est annulée :
// le devis repasse en attente, le client doit se prononcer sur la NOUVELLE
// version. Un devis déjà converti en facture n'est plus corrigeable.
export async function reviseDevisDB(id: string, f: {
  clientName?: string; clientEmail?: string; clientAddress?: string; description?: string;
  lines: DevisLine[]; total: number; validUntil?: string; note: string;
}): Promise<{ error: string | null; revision: number | null }> {
  const note = f.note.trim();
  if (!note) return { error: 'Explique au client ce qui change dans ce devis.', revision: null };

  // On relit la ligne pour archiver l'état RÉEL en base (l'écran peut être ouvert
  // depuis un moment) et pour vérifier qu'elle n'est pas déjà facturée.
  const { data: current, error: readErr } = await supabase
    .from('devis').select('lines, total, revision, invoice_id').eq('id', id).single();
  if (readErr) { console.error('reviseDevisDB(read):', readErr.code, readErr.message); return { error: readErr.message, revision: null }; }
  if (current?.invoice_id) return { error: 'Ce devis est déjà converti en facture : créez plutôt un avoir ou un nouveau devis.', revision: null };

  const revision = (Number(current?.revision) || 1) + 1;
  const { error } = await supabase.from('devis').update({
    partner_label: f.clientName || 'Client',
    client_name: f.clientName || null, client_email: f.clientEmail || null, client_address: f.clientAddress || null,
    description: f.description || null, lines: f.lines, total: f.total, valid_until: f.validUntil || null,
    status: 'envoye',
    revision, revision_note: note, revised_at: new Date().toISOString(),
    previous_lines: current?.lines ?? [], previous_total: current?.total ?? 0,
  }).eq('id', id);
  if (error) { console.error('reviseDevisDB:', error.code, error.message); return { error: error.message, revision: null }; }
  return { error: null, revision };
}

export async function setDevisStatusDB(id: string, status: DevisStatus): Promise<{ error: string | null }> {
  const { error } = await supabase.from('devis').update({ status }).eq('id', id);
  return { error: error?.message ?? null };
}
export async function setDevisStatusByTokenDB(token: string, status: DevisStatus): Promise<{ error: string | null }> {
  const { error } = await supabase.from('devis').update({ status }).eq('public_token', token);
  return { error: error?.message ?? null };
}

// Conversion d'un devis ACCEPTÉ en facture (réutilise saveInvoiceDB → table invoices).
export async function convertDevisToInvoiceDB(devis: Devis): Promise<{ error: string | null; number: string | null }> {
  const today = new Date();
  const invoiceNo = `FAC-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}-${(devis.partnerLabel || 'DEVIS').replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'XXXX'}`;
  const dateStr = today.toISOString().split('T')[0];
  const res = await saveInvoiceDB({
    number: invoiceNo,
    partnerLabel: devis.partnerLabel || devis.clientName || 'Client',
    partnerType: devis.partnerType || 'devis',
    periodFrom: dateStr, periodTo: dateStr,
    total: devis.total,
    lines: devis.lines.map(l => ({ date: dateStr, label: l.nom, type: 'devis', amount: l.total, unitPrice: l.prix_unitaire })),
  });
  if (res.error) return { error: res.error, number: null };
  await supabase.from('devis').update({ status: 'accepte' }).eq('id', devis.id);
  return { error: null, number: invoiceNo };
}
