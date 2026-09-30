import { NextRequest, NextResponse } from 'next/server';
import { exigerAdmin } from '@/lib/apiGuard';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { listSuperhoteProperties, fetchSuperhoteReservations } from '@/lib/pms/superhote';

export const runtime = 'nodejs';

// Brancher plusieurs logements SuperHote d'un coup.
//
// POURQUOI EN LOT
// Une conciergerie a quatorze biens chez nous et soixante-quinze dans son
// logiciel. Les connecter un par un, c'est quatorze fois le même écran — et
// c'est l'exploitant qui le fait, parce que la conciergerie ne sait pas aller
// chercher ses identifiants. Autant lui montrer la liste et lui laisser cocher.
//
// SuperHote ne rend pas le NOM de ses logements : seulement des numéros. On
// joint donc à chacun sa prochaine période occupée, qui est ce qui permet de le
// reconnaître — « celui qui est pris du 12 au 15 », c'est identifiable ; un
// numéro seul ne l'est pas.
//
// Body JSON : { action: 'lister' | 'connecter', partnerId, apiKey, choix? }
export async function POST(req: NextRequest) {
  const { refus } = await exigerAdmin();
  if (refus) return refus;

  let body: {
    action?: 'lister' | 'connecter';
    partnerId?: string;
    apiKey?: string;
    choix?: { rentalId: string; nom: string }[];
  } = {};
  try { body = await req.json(); } catch { /* corps vide → refusé plus bas */ }

  const apiKey = (body.apiKey ?? '').trim();
  const partnerId = (body.partnerId ?? '').trim();
  if (!apiKey) return NextResponse.json({ error: 'Clé manquante.' }, { status: 400 });
  if (!partnerId) return NextResponse.json({ error: 'Conciergerie manquante.' }, { status: 400 });

  const db = getSupabaseAdmin();

  try {
    // ── Lister, avec de quoi reconnaître chaque logement ──────────────────
    if ((body.action ?? 'lister') === 'lister') {
      const logements = await listSuperhoteProperties({ apiKey });
      const aujourdhui = new Date().toLocaleDateString('en-CA');
      const horizon = new Date(Date.now() + 120 * 86400000).toLocaleDateString('en-CA');

      // Déjà branchés : on ne les repropose pas comme s'ils étaient neufs.
      const { data: feeds } = await db.from('reservation_feeds')
        .select('external_property_id')
        .eq('partner_id', partnerId).eq('platform', 'superhote');
      const deja = new Set((feeds ?? []).map(f => String(f.external_property_id ?? '')));

      // La prochaine période occupée de chacun. Séquentiel à dessein : on ne
      // bombarde pas l'API d'un éditeur avec soixante-quinze appels simultanés.
      const enrichis = [];
      for (const l of logements) {
        let prochaine: string | null = null;
        try {
          const sejours = await fetchSuperhoteReservations({ apiKey }, l.id, { from: aujourdhui, to: horizon });
          const suivant = sejours.sort((a, b) => a.start.localeCompare(b.start))[0];
          if (suivant) prochaine = `${suivant.start} → ${suivant.end}`;
        } catch { /* un logement muet reste listé, sans repère */ }
        enrichis.push({ ...l, prochaine, dejaConnecte: deja.has(l.id) });
      }

      return NextResponse.json({ ok: true, logements: enrichis });
    }

    // ── Connecter les logements cochés ────────────────────────────────────
    const choix = body.choix ?? [];
    if (choix.length === 0) return NextResponse.json({ error: 'Aucun logement sélectionné.' }, { status: 400 });

    const { data: partenaire } = await db.from('users')
      .select('id, name').eq('id', partnerId).maybeSingle();

    const faits: string[] = [];
    // Clé sans accent : elle voyage en JSON et se lit côté écran.
    const rates: string[] = [];

    for (const c of choix) {
      const rentalId = String(c.rentalId);
      const nom = (c.nom || `Logement SuperHote nº ${rentalId}`).trim();

      // Le même logement SuperHote ne se branche pas deux fois : sa
      // réservation arriverait en double dans le tableau du partenaire.
      const { data: existant } = await db.from('reservation_feeds')
        .select('id').eq('partner_id', partnerId).eq('platform', 'superhote')
        .eq('external_property_id', rentalId).maybeSingle();
      if (existant) { rates.push(`${nom} : déjà connecté`); continue; }

      const { data: apt, error: errApt } = await db.from('airbnbs').insert({
        name: nom,
        address: '',
        partner_id: partnerId,
        partner_name: partenaire?.name ?? null,
      }).select('id').single();
      if (errApt || !apt) { rates.push(`${nom} : ${errApt?.message ?? 'création impossible'}`); continue; }

      const { error: errFeed } = await db.from('reservation_feeds').insert({
        airbnb_id: apt.id,
        partner_id: partnerId,
        platform: 'superhote',
        connection_kind: 'api',
        api_key: apiKey,
        api_secret: null,
        external_property_id: rentalId,
        ical_url: null,
      });
      if (errFeed) { rates.push(`${nom} : ${errFeed.message}`); continue; }

      faits.push(nom);
    }

    return NextResponse.json({ ok: true, connectes: faits, rates });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('reservations/superhote-bulk:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
