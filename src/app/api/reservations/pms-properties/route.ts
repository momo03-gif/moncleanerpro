import { NextRequest, NextResponse } from 'next/server';
import { exigerAdmin } from '@/lib/apiGuard';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { PMS_LISTERS } from '@/lib/pms/catalog';
import { diagnoseLodgify } from '@/lib/pms/lodgify';

export const runtime = 'nodejs';

// Quel logement du PMS est rattaché à cette connexion ?
//
// Une connexion API pointe un logement par son identifiant CHEZ L'ÉDITEUR, et
// cet identifiant ne ressemble à rien pour un humain. Quand le bien porte un
// nom différent des deux côtés — « Villa Rochetaillée » chez nous, « Maison
// familiale bord de Saône » chez Lodgify — il suffit d'une seconde d'hésitation
// à la connexion pour rattacher le mauvais, et la synchro remonte alors zéro
// réservation sans la moindre erreur. Rien ne permettait de le vérifier après
// coup.
//
// On relit donc la liste des logements de l'éditeur avec la clé DÉJÀ stockée,
// et on désigne celui qui est rattaché. La clé ne quitte jamais le serveur.
//
// Body JSON : { feedId }. Admin uniquement.
export async function POST(req: NextRequest) {
  const { refus } = await exigerAdmin();
  if (refus) return refus;

  let body: { feedId?: string; diagnostic?: boolean } = {};
  try { body = await req.json(); } catch { /* corps vide → refusé plus bas */ }
  const feedId = (body.feedId ?? '').trim();
  if (!feedId) return NextResponse.json({ error: 'Connexion manquante.' }, { status: 400 });

  try {
    const db = getSupabaseAdmin();
    const { data: feed } = await db.from('reservation_feeds')
      .select('platform, api_key, api_secret, external_property_id, connection_kind')
      .eq('id', feedId)
      .single();
    if (!feed) return NextResponse.json({ error: 'Connexion introuvable.' }, { status: 404 });

    if (feed.connection_kind !== 'api' || !feed.api_key) {
      return NextResponse.json({
        error: 'Cette connexion est un lien iCal : elle ne pointe pas un logement du logiciel.',
      }, { status: 400 });
    }

    // ── Diagnostic : ce que l'éditeur a RÉPONDU, sans interprétation ────────
    // Une synchro qui ne remonte rien SANS erreur ne se diagnostique pas depuis
    // l'extérieur : il faut voir combien de lignes l'API a rendues et sous
    // quelle forme. On ne rend jamais les valeurs — une réservation porte le
    // nom et le contact du voyageur de notre client.
    if (body.diagnostic) {
      if (feed.platform !== 'lodgify') {
        return NextResponse.json({ error: `Diagnostic non écrit pour ${feed.platform}.` }, { status: 400 });
      }
      const aujourdhui = new Date().toLocaleDateString('en-CA');
      const dans90 = new Date(Date.now() + 90 * 86400000).toLocaleDateString('en-CA');
      const d = await diagnoseLodgify(
        { apiKey: feed.api_key, apiSecret: feed.api_secret ?? undefined },
        String(feed.external_property_id ?? ''),
        { from: aujourdhui, to: dans90 },
      );
      return NextResponse.json({ ok: true, diagnostic: d });
    }

    const lister = PMS_LISTERS[feed.platform];
    if (!lister) {
      return NextResponse.json({ error: `Pas de liste de logements pour ${feed.platform}.` }, { status: 400 });
    }

    const logements = await lister({ apiKey: feed.api_key, apiSecret: feed.api_secret ?? undefined });
    const rattache = String(feed.external_property_id ?? '');

    return NextResponse.json({
      ok: true,
      rattache,
      // `trouve` à false = l'identifiant enregistré ne correspond à AUCUN
      // logement du compte : la connexion pointe dans le vide, ce qui explique
      // une synchro sans erreur et sans réservation.
      trouve: logements.some(l => String(l.id) === rattache),
      logements: logements.map(l => ({ id: String(l.id), name: l.name })),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('reservations/pms-properties:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
