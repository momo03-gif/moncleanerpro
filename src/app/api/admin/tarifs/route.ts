import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Écriture de la grille de prestations (`tarifs`). Elle était modifiable avec la
// clé publique, celle qui part dans le navigateur : n'importe qui pouvait changer
// les prix du site. Tout passe désormais par ici, après vérification de la
// session admin. La lecture, elle, reste publique — la page de devis en a besoin.

interface TarifInput {
  id?: string;
  nom?: string;
  unite?: string;
  prix?: number;
  prixMin?: number | null;
  prixMax?: number | null;
  motsCles?: string | null;
  categorie?: string | null;
  actif?: boolean;
}

function toRow(t: TarifInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (t.nom !== undefined) row.nom_prestation = t.nom.trim();
  if (t.unite !== undefined) row.unite = t.unite;
  if (t.prix !== undefined) row.prix_unitaire = Number(t.prix) || 0;
  if (t.prixMin !== undefined) row.prix_min = t.prixMin == null ? null : Number(t.prixMin);
  if (t.prixMax !== undefined) row.prix_max = t.prixMax == null ? null : Number(t.prixMax);
  if (t.motsCles !== undefined) row.mots_cles = t.motsCles || null;
  if (t.categorie !== undefined) row.categorie = t.categorie || null;
  if (t.actif !== undefined) row.actif = t.actif;
  return row;
}

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé à l’administration.' }, { status: 403 });
  }

  let body: { action?: string; tarif?: TarifInput; id?: string; rows?: TarifInput[] } = {};
  try { body = await req.json(); } catch { /* corps vide → refusé plus bas */ }

  const db = getSupabaseAdmin();

  try {
    if (body.action === 'save') {
      const t = body.tarif ?? {};
      if (!t.id && !t.nom?.trim()) {
        return NextResponse.json({ error: 'Nom de prestation requis.' }, { status: 400 });
      }
      const { error } = t.id
        ? await db.from('tarifs').update(toRow(t)).eq('id', t.id)
        : await db.from('tarifs').insert({ actif: true, ...toRow(t) });
      if (error) throw error;

    } else if (body.action === 'delete') {
      if (!body.id) return NextResponse.json({ error: 'Identifiant requis.' }, { status: 400 });
      const { error } = await db.from('tarifs').delete().eq('id', body.id);
      if (error) throw error;

    } else if (body.action === 'import') {
      // Import CSV : mise à jour par NOM, jamais de doublon. Ré-importer une
      // grille corrigée doit corriger, pas empiler.
      const rows = (body.rows ?? []).filter(r => r.nom?.trim());
      if (rows.length === 0) return NextResponse.json({ error: 'Aucune ligne valide.' }, { status: 400 });

      const { data: existing, error: exErr } = await db.from('tarifs').select('id, nom_prestation');
      if (exErr) throw exErr;
      const byName = new Map((existing ?? []).map(r => [String(r.nom_prestation).toLowerCase().trim(), r.id as string]));

      let inserted = 0, updated = 0;
      for (const r of rows) {
        const id = byName.get(r.nom!.toLowerCase().trim());
        const { error } = id
          ? await db.from('tarifs').update(toRow({ ...r, actif: true })).eq('id', id)
          : await db.from('tarifs').insert({ actif: true, ...toRow(r) });
        if (error) throw error;
        if (id) updated++; else inserted++;
      }
      return NextResponse.json({ ok: true, inserted, updated });

    } else {
      return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
    }
  } catch (e) {
    console.error('admin/tarifs:', (e as Error)?.message);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
