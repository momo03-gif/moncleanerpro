import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import type { SupabaseClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Suivi des prospects. La table contient des données personnelles de gens qui ne
// sont pas encore clients : elle est fermée à la clé publique (RLS sans policy)
// et tout transite par ici, après vérification de la session.

async function requireAdmin() {
  const s = await getSessionUser();
  return s && s.role === 'admin' ? s : null;
}

// Le téléphone a maintenant sa propre colonne (`devis.client_phone`). Mais les
// demandes reçues AVANT ce changement l'avaient dans l'adresse, sous la forme
// « 12 rue X — Tél : 06 12 34 56 78 » : on continue de le récupérer là quand la
// colonne est vide, plutôt que de perdre le numéro d'un ancien prospect.
function splitAddress(raw: string | null): { adresse: string; telephone: string } {
  if (!raw) return { adresse: '', telephone: '' };
  const m = /T[ée]l\s*:\s*([+\d][\d\s.\-()]{6,})/i.exec(raw);
  return {
    telephone: m ? m[1].trim() : '',
    adresse: raw.replace(/\s*[—-]?\s*T[ée]l\s*:.*$/i, '').trim(),
  };
}

// Nature devinée d'après ce que le demandeur a écrit. Approximatif par nature —
// c'est un point de départ que l'équipe corrige, pas une vérité.
function guessNature(text: string): string {
  const n = text.toLowerCase();
  if (/h[oô]tel|h[ôo]telier/.test(n)) return 'hotellerie';
  if (/ehpad|r[ée]sidence|maison de retraite/.test(n)) return 'ehpad';
  if (/airbnb|conciergerie|courte dur[ée]e|voyageur|location saisonni/.test(n)) return 'conciergerie';
  if (/chantier|apr[èe]s travaux|fin de chantier/.test(n)) return 'chantier';
  if (/bureau|commerce|boutique|entrep[ôo]t|local/.test(n)) return 'bureaux';
  if (/particulier|appartement|maison|domicile/.test(n)) return 'particulier';
  return 'autre';
}

/**
 * Crée les fiches manquantes à partir des devis. Idempotent : `devis_id` est
 * unique, un devis déjà suivi n'est jamais dupliqué. C'est ce qui fait que les
 * demandes déjà en base apparaissent sans aucune ressaisie.
 */
async function syncFromDevis(db: SupabaseClient): Promise<number> {
  const [{ data: devis }, { data: existing }] = await Promise.all([
    db.from('devis').select('id, number, client_name, client_email, client_phone, client_address, description, total, status, created_at')
      .order('created_at', { ascending: false }).limit(500),
    db.from('prospects').select('devis_id').not('devis_id', 'is', null),
  ]);

  const known = new Set((existing ?? []).map(r => r.devis_id as string));
  const missing = (devis ?? []).filter(d => !known.has(d.id as string));
  if (missing.length === 0) return 0;

  const rows = missing.map(d => {
    const { adresse, telephone } = splitAddress(d.client_address as string | null);
    // La colonne fait foi ; l'extraction depuis l'adresse ne sert plus qu'aux
    // demandes antérieures à la séparation des deux champs.
    const tel = ((d.client_phone as string | null) ?? '').trim() || telephone;
    const description = (d.description as string) ?? '';
    return {
      nom: (d.client_name as string)?.trim() || 'Demande sans nom',
      entreprise: null,
      email: (d.client_email as string) || null,
      telephone: tel || null,
      nature: guessNature(`${description} ${adresse}`),
      // Le statut du devis fait foi au moment de la création de la fiche.
      statut: d.status === 'envoye' ? 'envoye' : d.status === 'accepte' ? 'accepte' : d.status === 'refuse' ? 'refuse' : 'attente',
      montant: d.total != null ? Number(d.total) : null,
      relance: null,
      notes: [d.number ? `Devis ${d.number}` : null, adresse || null, description || null]
        .filter(Boolean).join(' — ') || null,
      devis_id: d.id,
      source: 'devis',
      created_at: d.created_at,
    };
  });

  const { error } = await db.from('prospects').insert(rows);
  if (error) { console.error('syncFromDevis:', error.message); return 0; }
  return rows.length;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Réservé à l’administration.' }, { status: 403 });

  const db = getSupabaseAdmin();
  const imported = await syncFromDevis(db);

  const { data, error } = await db
    .from('prospects')
    .select('*, devis(number)')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('admin/prospects GET:', error.message);
    return NextResponse.json({ error: 'Lecture impossible.' }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    imported,
    prospects: (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      nom: r.nom,
      entreprise: r.entreprise ?? undefined,
      email: r.email ?? undefined,
      telephone: r.telephone ?? undefined,
      nature: r.nature,
      statut: r.statut,
      montant: r.montant == null ? null : Number(r.montant),
      relance: r.relance ?? null,
      notes: r.notes ?? undefined,
      devisId: r.devis_id ?? undefined,
      devisNumber: (r.devis as { number?: string } | null)?.number ?? undefined,
      source: r.source,
      createdAt: r.created_at,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Réservé à l’administration.' }, { status: 403 });

  let body: {
    action?: 'save' | 'delete' | 'patch';
    id?: string;
    prospect?: Record<string, unknown>;
    patch?: Record<string, unknown>;
  } = {};
  try { body = await req.json(); } catch { /* corps vide → refusé plus bas */ }

  const db = getSupabaseAdmin();

  try {
    if (body.action === 'save') {
      const p = body.prospect ?? {};
      const nom = String(p.nom ?? '').trim();
      if (!nom) return NextResponse.json({ error: 'Le nom est requis.' }, { status: 400 });

      const row = {
        nom,
        entreprise: (p.entreprise as string)?.trim() || null,
        email: (p.email as string)?.trim() || null,
        telephone: (p.telephone as string)?.trim() || null,
        nature: (p.nature as string) || 'autre',
        statut: (p.statut as string) || 'attente',
        montant: p.montant === '' || p.montant == null ? null : Number(p.montant),
        relance: (p.relance as string) || null,
        notes: (p.notes as string)?.trim() || null,
        updated_at: new Date().toISOString(),
      };

      const { error } = body.id
        ? await db.from('prospects').update(row).eq('id', body.id)
        : await db.from('prospects').insert({ ...row, source: 'manuel' });
      if (error) throw error;

    } else if (body.action === 'patch') {
      // Modification d'un seul champ depuis la liste (statut, date de relance).
      if (!body.id) return NextResponse.json({ error: 'Identifiant requis.' }, { status: 400 });
      const allowed = ['statut', 'relance', 'montant', 'nature'];
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const k of allowed) if (body.patch && k in body.patch) patch[k] = body.patch[k];
      const { error } = await db.from('prospects').update(patch).eq('id', body.id);
      if (error) throw error;

    } else if (body.action === 'delete') {
      if (!body.id) return NextResponse.json({ error: 'Identifiant requis.' }, { status: 400 });
      const { error } = await db.from('prospects').delete().eq('id', body.id);
      if (error) throw error;

    } else {
      return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
    }
  } catch (e) {
    console.error('admin/prospects POST:', (e as Error)?.message);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
