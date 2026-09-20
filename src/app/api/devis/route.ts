import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// ── Devis : lecture et écriture, réservées à l'administration ────────────────
//
// POURQUOI UNE ROUTE : un devis porte le nom, l'e-mail, le téléphone et
// l'ADRESSE du prospect, plus le détail chiffré de ce qu'on lui propose. Tant
// que la table était lue et écrite depuis le navigateur, c'était avec la clé
// publique : le fichier prospects complet, et la possibilité de modifier un
// montant ou un statut.
//
// Le parcours PUBLIC (le client ouvre son devis par un lien et répond) a sa
// propre route, /api/devis/public : là, c'est le jeton du lien qui fait foi, et
// seul le devis correspondant est renvoyé.

const refus = (message: string, code = 403) => NextResponse.json({ error: message }, { status: code });

async function exigerAdmin() {
  const session = await getSessionUser();
  if (!session) return { erreur: refus('Non authentifié.', 401), session: null };
  if (session.role !== 'admin') return { erreur: refus('Réservé à l’administration.'), session: null };
  return { erreur: null, session };
}

// ── Lecture : la liste, et le compteur du menu ───────────────────────────────
export async function GET(req: NextRequest) {
  const { erreur } = await exigerAdmin();
  if (erreur) return erreur;

  const db = getSupabaseAdmin();
  const type = new URL(req.url).searchParams.get('type');

  if (type === 'pending') {
    // Demandes reçues et pas encore chiffrées : la pastille du menu « Devis ».
    const { count } = await db.from('devis')
      .select('id', { count: 'exact', head: true })
      .eq('source', 'public').eq('status', 'brouillon');
    return NextResponse.json({ count: count ?? 0 });
  }

  if (type === 'next-number') {
    // Le numéro suivant : calculé ici, puisque la table n'est plus lisible depuis
    // le navigateur. Incrément annuel, comme avant.
    const year = new Date().getFullYear();
    const { data } = await db.from('devis').select('number').like('number', `DEV-${year}-%`);
    const max = (data ?? []).reduce((m: number, r: { number: string }) => {
      const n = parseInt(String(r.number).split('-')[2] ?? '0', 10);
      return Number.isFinite(n) && n > m ? n : m;
    }, 0);
    return NextResponse.json({ number: `DEV-${year}-${String(max + 1).padStart(4, '0')}` });
  }

  const { data, error } = await db.from('devis').select('*').order('created_at', { ascending: false });
  if (error) { console.error('devis/list:', error.message); return refus('Lecture impossible.', 500); }
  return NextResponse.json({ devis: data ?? [] });
}

interface Body {
  action?: 'save' | 'update' | 'revise' | 'status';
  id?: string;
  status?: string;
  fields?: Record<string, unknown>;
  note?: string;
}

export async function POST(req: NextRequest) {
  const { erreur } = await exigerAdmin();
  if (erreur) return erreur;

  let b: Body = {};
  try { b = await req.json(); } catch { return refus('Requête invalide.', 400); }
  const db = getSupabaseAdmin();
  const f = b.fields ?? {};

  // Le contenu chiffré d'un devis, dans la forme de la table.
  const contenu = () => ({
    partner_label: (f.clientName as string) || 'Client',
    client_name: (f.clientName as string) || null,
    client_email: (f.clientEmail as string) || null,
    client_phone: (f.clientPhone as string) || null,
    client_address: (f.clientAddress as string) || null,
    description: (f.description as string) || null,
    lines: f.lines ?? [],
    total: Number(f.total) || 0,
    valid_until: (f.validUntil as string) || null,
  });

  switch (b.action) {
    case 'save': {
      const { data, error } = await db.from('devis').insert({
        ...contenu(),
        number: f.number as string,
        partner_label: (f.partnerLabel as string) || (f.clientName as string) || 'Client',
        partner_type: (f.partnerType as string) || null,
        status: (f.status as string) ?? 'brouillon',
        source: (f.source as string) ?? 'admin',
      }).select('id').single();
      if (error) { console.error('devis/save:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true, id: data?.id ?? null });
    }

    case 'update': {
      if (!b.id) return refus('Devis manquant.', 400);
      const patch: Record<string, unknown> = contenu();
      if (f.status) patch.status = f.status;
      const { error } = await db.from('devis').update(patch).eq('id', b.id);
      if (error) { console.error('devis/update:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    case 'revise': {
      if (!b.id) return refus('Devis manquant.', 400);
      const note = (b.note ?? '').trim();
      if (!note) return refus('Explique au client ce qui change dans ce devis.', 400);

      // On relit l'état RÉEL en base : l'écran peut être ouvert depuis un moment,
      // et un devis déjà facturé ne se corrige plus.
      const { data: actuel, error: lecture } = await db.from('devis')
        .select('lines, total, revision, invoice_id').eq('id', b.id).single();
      if (lecture) { console.error('devis/revise(read):', lecture.message); return refus('Lecture impossible.', 500); }
      if (actuel?.invoice_id) {
        return refus('Ce devis est déjà converti en facture : créez plutôt un avoir ou un nouveau devis.', 400);
      }

      const revision = (Number(actuel?.revision) || 1) + 1;
      const { error } = await db.from('devis').update({
        ...contenu(),
        status: 'envoye',
        revision, revision_note: note, revised_at: new Date().toISOString(),
        previous_lines: actuel?.lines ?? [], previous_total: actuel?.total ?? 0,
      }).eq('id', b.id);
      if (error) { console.error('devis/revise:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true, revision });
    }

    case 'status': {
      if (!b.id || !b.status) return refus('Devis ou statut manquant.', 400);
      const { error } = await db.from('devis').update({ status: b.status }).eq('id', b.id);
      if (error) { console.error('devis/status:', error.message); return refus('Enregistrement impossible.', 500); }
      return NextResponse.json({ ok: true });
    }

    default:
      return refus('Action inconnue.', 400);
  }
}
