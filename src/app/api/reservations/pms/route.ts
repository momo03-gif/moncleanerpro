import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { listSmoobuApartments } from '@/lib/pms/smoobu';

export const runtime = 'nodejs';

// Connexion d'un logement à l'API du PMS de la conciergerie.
//
// Deux temps, pour que personne ne colle une clé « dans le vide » :
//   action=test    → on interroge le PMS et on renvoie SES logements ;
//                    la conciergerie choisit lequel correspond au nôtre.
//   action=connect → on enregistre la connexion (clé + secret + logement choisi).
//
// La clé et le secret ne repassent jamais par le navigateur ensuite : la table
// n'est plus lue avec `select *` côté client (cf. FEED_SELECT).
//
// Sécurité : l'identité vient de la session signée, et on vérifie que le
// logement appartient bien à ce partenaire avant d'écrire quoi que ce soit.

export async function POST(req: NextRequest) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 });

  let body: {
    action?: 'test' | 'connect';
    platform?: string;
    apiKey?: string;
    apiSecret?: string;
    airbnbId?: string;
    externalPropertyId?: string;
  } = {};
  try { body = await req.json(); } catch { /* corps vide → refusé plus bas */ }

  const platform = body.platform ?? 'smoobu';
  const apiKey = body.apiKey?.trim();
  const apiSecret = body.apiSecret?.trim();

  if (platform !== 'smoobu') {
    return NextResponse.json({ error: 'Seul Smoobu est pris en charge par API pour le moment.' }, { status: 400 });
  }
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Clé et secret requis.' }, { status: 400 });
  }

  // ── Test : on liste les logements du compte ────────────────────────────────
  if (body.action === 'test') {
    try {
      const apartments = await listSmoobuApartments({ apiKey, apiSecret });
      return NextResponse.json({ ok: true, apartments });
    } catch (e) {
      return NextResponse.json({ ok: false, error: (e as Error)?.message ?? 'Connexion refusée.' });
    }
  }

  // ── Connexion : on enregistre ──────────────────────────────────────────────
  if (!body.airbnbId || !body.externalPropertyId) {
    return NextResponse.json({ error: 'Logement et identifiant PMS requis.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  // Le logement doit appartenir à ce partenaire — sinon on écrirait des
  // identifiants sur le logement de quelqu'un d'autre.
  const { data: apt } = await admin
    .from('airbnbs').select('id, partner_id').eq('id', body.airbnbId).maybeSingle();
  if (!apt || (apt.partner_id !== session.id && session.role !== 'admin')) {
    return NextResponse.json({ error: 'Logement introuvable.' }, { status: 404 });
  }

  const { error } = await admin.from('reservation_feeds').insert({
    airbnb_id: body.airbnbId,
    partner_id: apt.partner_id,
    platform,
    connection_kind: 'api',
    api_key: apiKey,
    api_secret: apiSecret,
    external_property_id: String(body.externalPropertyId),
    ical_url: null,
  });

  if (error) {
    console.error('reservations/pms:', error.message);
    return NextResponse.json({ error: 'Enregistrement impossible.' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
