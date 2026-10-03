import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// ── Formations : par le serveur ──────────────────────────────────────────────
//
// Les tables de formation étaient lisibles ET modifiables avec la clé publique :
// n'importe qui pouvait effacer une vidéo, ou marquer « terminée » la formation
// obligatoire d'un cleaner — celle qui le bloque tant qu'il ne l'a pas suivie.
//
//   · le contenu (catégories, vidéos) se lit avec n'importe quelle session ;
//   · le gérer et l'assigner est réservé à l'administration ;
//   · un cleaner ne lit et ne valide que SES assignations.

const ko = (error: string, status = 400) => NextResponse.json({ error }, { status });
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v : undefined);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export async function POST(req: NextRequest) {
  const s = await getSessionUser();
  if (!s) return ko('Non authentifié.', 401);
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { return ko('Requête invalide.'); }

  const db = getSupabaseAdmin();
  const admin = s.role === 'admin';
  const resultat = (error: { message: string } | null, data: unknown = undefined) => {
    if (error) { console.error(`formation/${String(b.op)}:`, error.message); return ko('Opération impossible.', 500); }
    return NextResponse.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  };

  /** cleaners.id de la session (cleaner), pour borner ses assignations. */
  const monIdCleaner = async () => {
    const { data } = await db.from('cleaners').select('id').eq('user_id', s.id).maybeSingle();
    return (data?.id as string | undefined) ?? null;
  };

  switch (b.op) {
    // ── Lecture du contenu ──
    case 'categories': {
      const { data, error } = await db.from('formation_categories').select('*').order('ordre');
      return resultat(error, data ?? []);
    }
    case 'formations': {
      let q = db.from('formations').select('*').order('ordre');
      if (str(b.categorieId)) q = q.eq('categorie_id', str(b.categorieId)!);
      const { data, error } = await q;
      return resultat(error, data ?? []);
    }

    // ── Assignations d'un cleaner : l'admin, ou le cleaner lui-même ──
    case 'assignments':
    case 'blocking': {
      let cleanerId = str(b.cleanerId);
      if (!admin) {
        if (s.role !== 'cleaner') return ko('Accès refusé.', 403);
        cleanerId = (await monIdCleaner()) ?? undefined;
      }
      if (!cleanerId) return resultat(null, []);
      let q = db.from('formation_assignments').select('*').eq('cleaner_id', cleanerId);
      q = b.op === 'blocking'
        ? q.eq('obligatoire', true).eq('statut', 'a_faire')
        : q.order('date_assignation', { ascending: false });
      const { data, error } = await q;
      return resultat(error, data ?? []);
    }

    // Le cleaner valide UNE de ses formations.
    case 'complete': {
      const id = str(b.id);
      if (!id) return ko('Formation manquante.');
      let q = db.from('formation_assignments')
        .update({ statut: 'terminee', date_completion: new Date().toISOString() }).eq('id', id);
      if (!admin) {
        const cid = s.role === 'cleaner' ? await monIdCleaner() : null;
        if (!cid) return ko('Accès refusé.', 403);
        q = q.eq('cleaner_id', cid);
      }
      const { data, error } = await q.select('id');
      if (!error && (!data || data.length === 0)) return ko('Formation introuvable.', 404);
      return resultat(error);
    }
  }

  // ── Gestion : administration uniquement ──
  if (!admin) return ko('Réservé à l’administration.', 403);

  switch (b.op) {
    case 'category-create': {
      const titre = str(b.titre);
      if (!titre) return ko('Titre requis.');
      const { error } = await db.from('formation_categories').insert({
        titre, description: str(b.description) ?? null, icone: str(b.icone) ?? 'book', ordre: num(b.ordre) ?? 0,
      });
      return resultat(error);
    }
    case 'category-update': {
      const id = str(b.id);
      if (!id) return ko('Catégorie manquante.');
      const patch: Record<string, unknown> = {};
      if ('titre' in b) patch.titre = str(b.titre);
      if ('description' in b) patch.description = str(b.description) ?? null;
      if ('icone' in b) patch.icone = str(b.icone);
      if ('ordre' in b) patch.ordre = num(b.ordre);
      const { error } = await db.from('formation_categories').update(patch).eq('id', id);
      return resultat(error);
    }
    case 'category-delete': {
      const { error } = await db.from('formation_categories').delete().eq('id', str(b.id) ?? '');
      return resultat(error);
    }
    case 'formation-create': {
      const categorieId = str(b.categorieId), titre = str(b.titre);
      if (!categorieId || !titre) return ko('Catégorie et titre requis.');
      const { error } = await db.from('formations').insert({
        categorie_id: categorieId, titre, description: str(b.description) ?? null,
        video_url: str(b.videoUrl) ?? null, ordre: num(b.ordre) ?? 0, obligatoire: b.obligatoire === true,
      });
      return resultat(error);
    }
    case 'formation-update': {
      const id = str(b.id);
      if (!id) return ko('Formation manquante.');
      const patch: Record<string, unknown> = {};
      if ('titre' in b) patch.titre = str(b.titre);
      if ('description' in b) patch.description = str(b.description) ?? null;
      if ('videoUrl' in b) patch.video_url = str(b.videoUrl) ?? null;
      if ('ordre' in b) patch.ordre = num(b.ordre);
      if ('obligatoire' in b) patch.obligatoire = b.obligatoire === true;
      const { error } = await db.from('formations').update(patch).eq('id', id);
      return resultat(error);
    }
    case 'formation-delete': {
      const { error } = await db.from('formations').delete().eq('id', str(b.id) ?? '');
      return resultat(error);
    }
    case 'assign': {
      const ids = (Array.isArray(b.cleanerIds) ? b.cleanerIds : []).filter((x): x is string => typeof x === 'string');
      const formationId = str(b.formationId), categorieId = str(b.categorieId);
      if (ids.length === 0) return ko('Aucun cleaner sélectionné.');
      if (!formationId && !categorieId) return ko('Choisir une vidéo ou une catégorie.');
      const { data, error } = await db.from('formation_assignments').insert(ids.map(cid => ({
        cleaner_id: cid, formation_id: formationId ?? null, categorie_id: categorieId ?? null,
        obligatoire: b.obligatoire === true, statut: 'a_faire',
      }))).select('id');
      return resultat(error, { count: data?.length ?? 0 });
    }
    case 'assignment-delete': {
      const { error } = await db.from('formation_assignments').delete().eq('id', str(b.id) ?? '');
      return resultat(error);
    }
    default:
      return ko('Opération inconnue.');
  }
}
