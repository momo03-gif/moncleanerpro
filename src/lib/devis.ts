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
  clientName?: string; clientEmail?: string; clientPhone?: string; clientAddress?: string; description?: string;
  lines: DevisLine[]; total: number; status: DevisStatus; validUntil?: string;
  publicToken: string; source: 'admin' | 'public'; invoiceId?: string; createdAt?: string;
  /** Page ou canal d'où vient la demande (voir src/lib/origin.ts). */
  origine?: string;
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
  clientName: r.client_name ?? undefined, clientEmail: r.client_email ?? undefined,
  clientPhone: r.client_phone ?? undefined, clientAddress: r.client_address ?? undefined,
  description: r.description ?? undefined, lines: Array.isArray(r.lines) ? r.lines : [], total: Number(r.total) || 0,
  status: r.status ?? 'brouillon', validUntil: r.valid_until ?? undefined, publicToken: r.public_token,
  source: r.source ?? 'admin', invoiceId: r.invoice_id ?? undefined, createdAt: r.created_at ?? undefined,
  origine: r.origine ?? undefined,
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
// L'ÉCRITURE de la grille passe par /api/admin/tarifs (session admin vérifiée,
// service_role). Elle se faisait avec la clé publique : n'importe qui pouvait
// changer les prix du site. La LECTURE reste publique — la page de devis en a
// besoin sans compte.
async function posterTarif(corps: Record<string, unknown>): Promise<{ error: string | null; data?: any }> {
  try {
    const res = await fetch('/api/admin/tarifs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return { error: d.error ?? 'Enregistrement impossible.' };
    return { error: null, data: d };
  } catch {
    return { error: 'Enregistrement impossible pour le moment.' };
  }
}

export async function createTarifDB(f: { nom: string; unite: TarifUnite; prix: number; motsCles?: string; prixMin?: number | null; prixMax?: number | null; categorie?: string }) {
  const { error } = await posterTarif({ action: 'save', tarif: { ...f } });
  return { error };
}

export async function updateTarifDB(id: string, f: { nom?: string; unite?: TarifUnite; prix?: number; actif?: boolean; motsCles?: string | null; prixMin?: number | null; prixMax?: number | null; categorie?: string | null }) {
  const { error } = await posterTarif({ action: 'save', tarif: { id, ...f } });
  return { error };
}

// Import CSV → grille tarifs. Upsert par NOM côté serveur (met à jour si le nom
// existe déjà, sinon insère) : ré-importer un fichier corrigé ne crée pas de
// doublons, et la boucle ne fait plus un aller-retour réseau par ligne.
export async function importTarifsDB(rows: {
  nom: string; unite: TarifUnite; prix: number; motsCles?: string; prixMin?: number | null; prixMax?: number | null; categorie?: string;
}[]): Promise<{ error: string | null; inserted: number; updated: number }> {
  const clean = rows.filter(r => r.nom.trim());
  if (clean.length === 0) return { error: 'Aucune ligne valide dans le fichier.', inserted: 0, updated: 0 };
  const { error, data } = await posterTarif({ action: 'import', rows: clean });
  if (error) return { error, inserted: 0, updated: 0 };
  return { error: null, inserted: data?.inserted ?? 0, updated: data?.updated ?? 0 };
}

export async function deleteTarifDB(id: string) {
  const { error } = await posterTarif({ action: 'delete', id });
  return { error };
}

// Agent d'estimation LOCAL (sans IA externe) — module pur, réexporté ici pour que
// les appelants continuent d'importer depuis '@/lib/devis'.
export { estimateFromDescription, rangeForLines, tarifRange } from './devisEstimate';

// ── DEVIS ─────────────────────────────────────────────────────────────────────
// ── Devis : tout passe par le serveur ────────────────────────────────────────
// Un devis porte le nom, l'e-mail, le téléphone et l'ADRESSE du prospect, plus
// le détail chiffré de l'offre. Lue depuis le navigateur, la table livrait le
// fichier prospects complet à la clé publique, et laissait modifier un montant
// ou un statut. Lecture et écriture passent donc par /api/devis (administration)
// et /api/devis/public (le client, par le jeton de son lien).
async function devisServeur(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch('/api/devis', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(data.error ?? 'Enregistrement impossible.'));
  return data;
}

export async function getDevisListDB(): Promise<Devis[]> {
  try {
    const res = await fetch('/api/devis');
    if (!res.ok) return [];
    const data = await res.json();
    return (data.devis ?? []).map(toDevis);
  } catch (e) { console.error('getDevisListDB:', e); return []; }
}

// Demandes de devis reçues et pas encore chiffrées — la pastille de l'entrée
// « Devis » du menu. Les demandes ne passent plus par la cloche : ce compteur est
// ce qui les rend visibles, et il ne retombe que lorsqu'elles sont traitées.
export async function getDevisPendingCountDB(): Promise<number> {
  try {
    const res = await fetch('/api/devis?type=pending');
    if (!res.ok) return 0;
    return Number((await res.json()).count) || 0;
  } catch { return 0; }
}

/** Le devis que le client ouvre depuis son lien. Le jeton fait office de clé. */
export async function getDevisByTokenDB(token: string): Promise<Devis | null> {
  try {
    const res = await fetch(`/api/devis/public?token=${encodeURIComponent(token)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.devis ? toDevis(data.devis) : null;
  } catch { return null; }
}

export async function nextDevisNumberDB(): Promise<string> {
  const annee = new Date().getFullYear();
  try {
    const res = await fetch('/api/devis?type=next-number');
    if (res.ok) return String((await res.json()).number ?? `DEV-${annee}-0001`);
  } catch { /* repli ci-dessous */ }
  return `DEV-${annee}-0001`;
}

export async function saveDevisDB(f: {
  number: string; partnerLabel: string; partnerType?: string;
  clientName?: string; clientEmail?: string; clientPhone?: string; clientAddress?: string; description?: string;
  lines: DevisLine[]; total: number; validUntil?: string; status?: DevisStatus; source?: 'admin' | 'public';
}): Promise<{ error: string | null; id: string | null }> {
  try {
    const d = await devisServeur({ action: 'save', fields: f });
    return { error: null, id: (d.id as string) ?? null };
  } catch (e) { return { error: (e as Error).message, id: null }; }
}

// Met à jour le CONTENU d'un devis existant (rouvrir un brouillon → modifier →
// ré-enregistrer le MÊME devis, sans en créer un nouveau). Le numéro ne change pas.
export async function updateDevisDB(id: string, f: {
  clientName?: string; clientEmail?: string; clientPhone?: string; clientAddress?: string; description?: string;
  lines: DevisLine[]; total: number; validUntil?: string; status?: DevisStatus;
}): Promise<{ error: string | null }> {
  try { await devisServeur({ action: 'update', id, fields: f }); return { error: null }; }
  catch (e) { return { error: (e as Error).message }; }
}

// CORRECTION d'un devis DÉJÀ ENVOYÉ (le client s'est trompé de prestation, un
// élément manquait…). Même numéro, même lien public — le client n'a qu'une seule
// adresse à retenir. La version est incrémentée, le contenu précédent archivé,
// et le mot d'explication enregistré. Une décision déjà prise est annulée : le
// client doit se prononcer sur la NOUVELLE version. Un devis déjà converti en
// facture n'est plus corrigeable (vérifié côté serveur).
export async function reviseDevisDB(id: string, f: {
  clientName?: string; clientEmail?: string; clientPhone?: string; clientAddress?: string; description?: string;
  lines: DevisLine[]; total: number; validUntil?: string; note: string;
}): Promise<{ error: string | null; revision: number | null }> {
  const note = f.note.trim();
  if (!note) return { error: 'Explique au client ce qui change dans ce devis.', revision: null };
  try {
    const d = await devisServeur({ action: 'revise', id, note, fields: f });
    return { error: null, revision: Number(d.revision) || null };
  } catch (e) { return { error: (e as Error).message, revision: null }; }
}

export async function setDevisStatusDB(id: string, status: DevisStatus): Promise<{ error: string | null }> {
  try { await devisServeur({ action: 'status', id, status }); return { error: null }; }
  catch (e) { return { error: (e as Error).message }; }
}

/** Réponse du client depuis son lien : accepté ou refusé, rien d'autre. */
export async function setDevisStatusByTokenDB(token: string, status: DevisStatus): Promise<{ error: string | null }> {
  try {
    const res = await fetch('/api/devis/public', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, status }),
    });
    const data = await res.json().catch(() => ({}));
    return { error: res.ok ? null : String(data.error ?? 'Enregistrement impossible.') };
  } catch { return { error: 'Connexion impossible. Réessayez.' }; }
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
  await setDevisStatusDB(devis.id, 'accepte');
  return { error: null, number: invoiceNo };
}
