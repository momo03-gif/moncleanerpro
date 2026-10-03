import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { FEED_SELECT, RESERVATION_SELECT } from '@/lib/db/reservations';
import { logementsDuPartenaire } from '@/lib/missionRead';

export const runtime = 'nodejs';

// ── Lecture des réservations et des flux de synchronisation ──────────────────
//
// Ces tables étaient lisibles avec la clé publique : les 257 séjours, et surtout
// les liens iCal des calendriers de nos clients (un lien iCal ouvre le calendrier
// à qui le détient). Lecture par le serveur désormais :
//   · l'admin voit tout ;
//   · une conciergerie voit ce qui lui est rattaché OU ce qui est sur ses
//     logements — c'est le logement qui fait foi, comme pour les missions.

const ko = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: NextRequest) {
  const s = await getSessionUser();
  if (!s) return ko('Non authentifié.', 401);
  if (s.role !== 'admin' && s.role !== 'airbnb') return ko('Accès refusé.', 403);
  let b: { op?: string; feedId?: string; depuis?: string } = {};
  try { b = await req.json(); } catch { return ko('Requête invalide.'); }

  const db = getSupabaseAdmin();
  const admin = s.role === 'admin';
  const filtre = admin ? null : await (async () => {
    const ids = await logementsDuPartenaire(db, s.id);
    return ids.length ? `partner_id.eq.${s.id},airbnb_id.in.(${ids.join(',')})` : `partner_id.eq.${s.id}`;
  })();
  const repondre = (data: unknown, error: { message: string } | null) => {
    if (error) { console.error(`reservations/lire/${b.op}:`, error.message); return ko('Lecture impossible.', 500); }
    return NextResponse.json({ data }, { headers: { 'Cache-Control': 'no-store' } });
  };

  switch (b.op) {
    case 'feeds': {
      let q = db.from('reservation_feeds').select(FEED_SELECT).order('created_at');
      if (filtre) q = q.or(filtre);
      const { data, error } = await q;
      return repondre(data ?? [], error);
    }
    case 'reservations': {
      let q = db.from('reservations').select(RESERVATION_SELECT).order('check_out', { ascending: false });
      if (filtre) q = q.or(filtre);
      if (b.depuis && /^\d{4}-\d{2}-\d{2}$/.test(b.depuis)) q = q.gte('check_out', b.depuis);
      // Pas de troncature silencieuse à 1000 lignes : on pagine.
      const out: unknown[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await q.range(from, from + 999);
        if (error) return repondre(null, error);
        out.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return repondre(out, null);
    }
    case 'count-feed': {
      if (!b.feedId) return ko('Flux manquant.');
      if (filtre) {
        const { data: f } = await db.from('reservation_feeds').select('id').eq('id', b.feedId).or(filtre).maybeSingle();
        if (!f) return ko('Accès refusé.', 403);
      }
      const { count, error } = await db.from('reservations').select('id', { count: 'exact', head: true }).eq('feed_id', b.feedId);
      return repondre(count ?? 0, error);
    }
    default:
      return ko('Opération inconnue.');
  }
}
