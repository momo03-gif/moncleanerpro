import { NextRequest, NextResponse } from 'next/server';
import { exigerAdmin } from '@/lib/apiGuard';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// D'où vient cette ligne, exactement ?
//
// Une réservation qui paraît fausse — une arrivée qui n'existe pas, un départ
// décalé d'un jour — ne se diagnostique qu'en regardant ce que la plateforme a
// réellement envoyé. L'évènement brut est stocké depuis toujours (colonne
// `raw`) et n'était affiché nulle part : on relisait donc le code au lieu de
// lire la donnée.
//
// CE QU'ON NE REND PAS : la DESCRIPTION de l'évènement, ni le téléphone du
// voyageur. Un calendrier Airbnb y met les quatre derniers chiffres du numéro
// et le lien de réservation ; ce sont les données des clients de nos clients,
// elles n'ont rien à faire dans un écran de diagnostic. On rend l'identifiant,
// l'intitulé et les bornes — ce qui suffit à comprendre, et rien de plus.
//
// Admin uniquement.
export async function GET(req: NextRequest) {
  const { refus } = await exigerAdmin();
  if (refus) return refus;

  const id = (req.nextUrl.searchParams.get('id') ?? '').trim();
  if (!id) return NextResponse.json({ error: 'Réservation manquante.' }, { status: 400 });

  try {
    const db = getSupabaseAdmin();
    const { data: brut } = await db.from('reservations')
      .select('id, platform, status, check_in, check_out, check_in_time, check_out_time, '
        + 'external_uid, raw, feed_id, reservation_feeds(label, platform, ical_url)')
      .eq('id', id)
      .single();
    if (!brut) return NextResponse.json({ error: 'Réservation introuvable.' }, { status: 404 });

    // Le client Supabase ne sait pas typer un select avec jointure : on décrit
    // la forme attendue plutôt que de la deviner à chaque accès.
    const data = brut as unknown as {
      platform: string | null; status: string | null;
      check_in: string; check_out: string;
      check_in_time: string | null; check_out_time: string | null;
      external_uid: string | null;
      raw: Record<string, unknown> | null;
      reservation_feeds: { label?: string; platform?: string; ical_url?: string } | null;
    };

    const raw = (data.raw ?? {}) as Record<string, unknown>;
    const feed = (data.reservation_feeds ?? null) as
      { label?: string; platform?: string; ical_url?: string } | null;

    // Du lien on ne garde que l'hôte : le reste porte un jeton d'accès au
    // calendrier de notre client.
    let hote: string | null = null;
    try { hote = feed?.ical_url ? new URL(feed.ical_url).hostname : null; } catch { hote = null; }

    return NextResponse.json({
      ok: true,
      reservation: {
        platform: data.platform,
        status: data.status,
        checkIn: data.check_in, checkOut: data.check_out,
        checkInTime: data.check_in_time, checkOutTime: data.check_out_time,
      },
      calendrier: { label: feed?.label ?? null, platform: feed?.platform ?? null, hote },
      evenement: {
        uid: data.external_uid ?? (raw.uid as string) ?? null,
        summary: (raw.summary as string) ?? null,
        start: (raw.start as string) ?? null,
        end: (raw.end as string) ?? null,
        startTime: (raw.startTime as string) ?? null,
        endTime: (raw.endTime as string) ?? null,
        status: (raw.status as string) ?? null,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error('reservations/detail:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
