// Façade CLIENT des dépenses (LOT 4) → routes serveur service_role.
// L'upload du reçu reste direct (bucket Storage, policies anon).
import type { Depense } from './depenses';

export { uploadReceiptDB, DEPENSE_CATEGORIES, CATEGORIE_LABEL } from './depenses';
export type { Depense, DepenseCategorie } from './depenses';

async function call<T>(op: string, args?: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/admin/depenses', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ op, args: args ?? {} }),
  });
  return res.json() as Promise<T>;
}

export const getDepensesDB = () => call<Depense[]>('list');
export const createDepenseDB = (fields: {
  categorie: string; fournisseur?: string; montantHt: number; tvaMontant: number; montantTtc: number;
  date: string; note?: string; justificatifUrl?: string;
}) => call<{ error: string | null }>('create', fields as any);
export const deleteDepenseDB = (id: string) => call<{ error: string | null }>('delete', { id });
