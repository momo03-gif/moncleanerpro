import { getServerDb } from './serverDb';

// service_role côté serveur (routes admin), anon côté client. Table `depenses`
// protégée par RLS (LOT 4) ; le bucket Storage `receipts` reste accessible (upload).
const supabase = getServerDb();

// ══════════════════════════════════════════════════════════════════════════════
//  Module Dépenses & TVA (assistant comptable) — couche d'accès données.
//  ADMIN UNIQUEMENT. Tous les calculs restent vérifiables/exportables.
// ══════════════════════════════════════════════════════════════════════════════

export const DEPENSE_CATEGORIES = [
  'essence', 'loyer', 'materiel', 'produits', 'assurance', 'abonnements', 'autre',
] as const;
export type DepenseCategorie = typeof DEPENSE_CATEGORIES[number];

export const CATEGORIE_LABEL: Record<string, string> = {
  essence: 'Essence / carburant', loyer: 'Loyer local', materiel: 'Matériel',
  produits: 'Produits ménagers', assurance: 'Assurance', abonnements: 'Abonnements', autre: 'Autre',
};

export interface Depense {
  id: string; categorie: string; fournisseur?: string;
  montantHt: number; tvaMontant: number; montantTtc: number;
  date: string; note?: string; justificatifUrl?: string;
}

const toDepense = (r: any): Depense => ({
  id: r.id, categorie: r.categorie, fournisseur: r.fournisseur ?? undefined,
  montantHt: Number(r.montant_ht) || 0, tvaMontant: Number(r.tva_montant) || 0, montantTtc: Number(r.montant_ttc) || 0,
  date: r.date, note: r.note ?? undefined, justificatifUrl: r.justificatif_url ?? undefined,
});

export async function getDepensesDB(): Promise<Depense[]> {
  const { data, error } = await supabase.from('depenses').select('*').order('date', { ascending: false });
  if (error) { console.error('getDepensesDB:', error.code, error.message); return []; }
  return (data ?? []).map(toDepense);
}

export async function createDepenseDB(f: {
  categorie: string; fournisseur?: string; montantHt: number; tvaMontant: number; montantTtc: number;
  date: string; note?: string; justificatifUrl?: string;
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('depenses').insert({
    categorie: f.categorie, fournisseur: f.fournisseur || null,
    montant_ht: f.montantHt, tva_montant: f.tvaMontant, montant_ttc: f.montantTtc,
    date: f.date, note: f.note || null, justificatif_url: f.justificatifUrl || null,
  });
  if (error) console.error('createDepenseDB:', error.code, error.message);
  return { error: error?.message ?? null };
}

export async function deleteDepenseDB(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('depenses').delete().eq('id', id);
  return { error: error?.message ?? null };
}

// Upload d'un reçu dans le bucket Storage 'receipts' → URL publique.
export async function uploadReceiptDB(file: File): Promise<{ url: string | null; error: string | null }> {
  const ext = file.name.split('.').pop() || 'jpg';
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('receipts').upload(path, file, { upsert: false });
  if (error) { console.error('uploadReceiptDB:', error.message); return { url: null, error: error.message }; }
  const { data } = supabase.storage.from('receipts').getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}
