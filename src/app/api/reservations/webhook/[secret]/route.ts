import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { lireReservationRecue } from '@/lib/webhookReservation';
import { materializeMissions } from '@/lib/reservationSync';

export const runtime = 'nodejs';

// ══════════════════════════════════════════════════════════════════════════════
//  Réception d'une réservation poussée par le logiciel d'une conciergerie.
//
//  POURQUOI CETTE VOIE EST MEILLEURE QUE L'ICAL
//  Un lien iCal se relit deux fois par jour et ne dit jamais si une période est
//  un séjour vendu ou une date fermée — c'est toute la difficulté de Booking.
//  Un webhook arrive à la seconde où le voyageur réserve, et il ANNONCE ce
//  qu'il est. Il ne demande aucune clé : c'est le logiciel du client qui nous
//  appelle, l'URL secrète tient lieu d'authentification.
//
//  ON RÉPOND TOUJOURS 200, SAUF SI LE SECRET EST FAUX.
//  Un éditeur désactive un webhook qui échoue de façon répétée, et le client
//  perd alors sa synchronisation sans que personne ne s'en aperçoive. Un corps
//  qu'on ne sait pas lire est donc ACCEPTÉ et conservé : on le montre à
//  l'administration, on complète le lecteur, et l'abonnement reste vivant.
// ══════════════════════════════════════════════════════════════════════════════

/** Trace ce qu'on a reçu — y compris, et surtout, ce qu'on n'a pas compris. */
async function tracer(
  db: ReturnType<typeof getSupabaseAdmin>,
  champs: {
    partnerId: string | null; source: string; payload: unknown;
    resultat: 'recu' | 'rattache' | 'illisible' | 'logement_inconnu' | 'ignore';
    reservationId?: string | null; note?: string;
  },
) {
  try {
    await db.from('webhook_events').insert({
      partner_id: champs.partnerId,
      source: champs.source,
      payload: champs.payload as Record<string, unknown>,
      resultat: champs.resultat,
      reservation_id: champs.reservationId ?? null,
      note: champs.note ?? null,
    });
  } catch (e) {
    // La table n'existe pas encore (migration non jouée) : on ne fait pas
    // échouer la réception pour autant — le séjour compte plus que sa trace.
    console.warn('webhook: trace impossible', (e as Error)?.message);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  const db = getSupabaseAdmin();

  const { data: abo } = await db.from('webhook_subscriptions')
    .select('id, partner_id, source, active')
    .eq('secret', secret)
    .maybeSingle();

  // Le secret est la seule barrière : un secret inconnu ou désactivé ne doit
  // rien apprendre à celui qui l'essaie.
  if (!abo || !abo.active) {
    return NextResponse.json({ error: 'Abonnement inconnu.' }, { status: 404 });
  }

  let payload: unknown = null;
  try { payload = await req.json(); } catch { payload = null; }
  if (payload === null) {
    await tracer(db, { partnerId: abo.partner_id, source: abo.source, payload: {}, resultat: 'ignore', note: 'Corps vide ou illisible.' });
    return NextResponse.json({ ok: true });
  }

  await db.from('webhook_subscriptions')
    .update({ last_seen_at: new Date().toISOString() }).eq('id', abo.id);

  // ── 1. Lire, sans jamais deviner ──────────────────────────────────────────
  const lue = lireReservationRecue(payload);
  if (!lue) {
    await tracer(db, {
      partnerId: abo.partner_id, source: abo.source, payload, resultat: 'illisible',
      note: 'Aucune date de séjour reconnue — voir la forme de l’évènement pour compléter le lecteur.',
    });
    return NextResponse.json({ ok: true, lu: false });
  }

  // ── 2. De quel logement parle-t-on ? ──────────────────────────────────────
  // On s'appuie sur les calendriers déjà connectés de ce partenaire : leur
  // `external_property_id` porte l'identifiant du logement chez l'éditeur.
  const { data: feeds } = await db.from('reservation_feeds')
    .select('id, airbnb_id, external_property_id, airbnbs(name)')
    .eq('partner_id', abo.partner_id)
    .eq('active', true);

  type Feed = { id: string; airbnb_id: string; external_property_id: string | null; airbnbs: { name?: string } | null };
  const liste = (feeds ?? []) as unknown as Feed[];

  const normal = (v?: string | null) => (v ?? '').trim().toLowerCase();
  const feed = liste.find(f => lue.propertyRef && normal(f.external_property_id) === normal(lue.propertyRef))
    ?? liste.find(f => lue.propertyName && normal(f.airbnbs?.name) === normal(lue.propertyName));

  if (!feed) {
    await tracer(db, {
      partnerId: abo.partner_id, source: abo.source, payload, resultat: 'logement_inconnu',
      note: `Logement non rattaché (référence « ${lue.propertyRef ?? lue.propertyName ?? 'absente'} »). `
        + 'Renseignez cet identifiant sur le calendrier du logement concerné.',
    });
    return NextResponse.json({ ok: true, lu: true, rattache: false });
  }

  // ── 3. Enregistrer le séjour, puis créer le ménage ────────────────────────
  // Même clé d'unicité que la synchro iCal : le même évènement reçu deux fois
  // met à jour la réservation au lieu d'en créer une seconde.
  const { data: resa } = await db.from('reservations').upsert({
    feed_id: feed.id,
    airbnb_id: feed.airbnb_id,
    partner_id: abo.partner_id,
    platform: abo.source,
    external_uid: lue.externalUid,
    status: lue.status,
    check_in: lue.checkIn,
    check_out: lue.checkOut,
    raw: payload as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'feed_id,external_uid' }).select('id').single();

  // La matérialisation est idempotente : elle ne crée un ménage que pour un
  // départ confirmé qui n'en a pas encore.
  let creees = 0;
  if (lue.status === 'confirmed') {
    try { creees = (await materializeMissions()).created; }
    catch (e) { console.error('webhook: materialize', (e as Error)?.message); }
  }

  await tracer(db, {
    partnerId: abo.partner_id, source: abo.source, payload, resultat: 'rattache',
    reservationId: resa?.id ?? null,
    note: `${lue.status} · ${lue.checkIn} → ${lue.checkOut}${creees ? ` · ${creees} ménage(s) créé(s)` : ''}`,
  });

  return NextResponse.json({ ok: true, lu: true, rattache: true });
}

// Certains éditeurs vérifient l'URL en GET avant de l'accepter.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params;
  const db = getSupabaseAdmin();
  const { data } = await db.from('webhook_subscriptions')
    .select('id').eq('secret', secret).eq('active', true).maybeSingle();
  return data
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: 'Abonnement inconnu.' }, { status: 404 });
}
