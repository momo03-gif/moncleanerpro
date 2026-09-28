import { NextRequest, NextResponse } from 'next/server';
import { classifyEvent, parseICal } from '@/lib/ical';
import { normalizeIcalUrl, detectPlatform } from '@/lib/icalUrl';

export const runtime = 'nodejs';

// Vérification d'un lien iCal AVANT de le connecter. Hostaway/Hostify font
// enregistrer le lien puis découvrir l'échec à la première synchro ; ici on
// télécharge le calendrier tout de suite et on renvoie ce qu'on y a vu
// (« 12 réservations, prochain départ le 18 août »), ce qui rassure et évite
// les flux morts.
//
// Body JSON : { url }
export async function POST(req: NextRequest) {
  let body: { url?: string } = {};
  try { body = await req.json(); } catch { /* corps vide → erreur plus bas */ }

  const url = normalizeIcalUrl(body.url ?? '');
  if (!url) return NextResponse.json({ ok: false, error: 'Lien manquant.' }, { status: 400 });

  let parsed: URL;
  try { parsed = new URL(url); } catch {
    return NextResponse.json({ ok: false, error: 'Ce lien n’est pas une adresse valide.' }, { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return NextResponse.json({ ok: false, error: 'Le lien doit commencer par https://' }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'MonCleanerPro/1.0' } });
    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        error: res.status === 404
          ? 'Calendrier introuvable — le lien a peut-être expiré, régénérez-le sur la plateforme.'
          : `La plateforme a répondu ${res.status}.`,
      });
    }

    const text = await res.text();
    if (!text.includes('BEGIN:VCALENDAR')) {
      return NextResponse.json({
        ok: false,
        error: 'Ce lien ne renvoie pas un calendrier. Vérifiez d’avoir copié le lien d’EXPORT (.ics), pas l’adresse de l’annonce.',
      });
    }

    // On classe EXACTEMENT comme la synchro le fera. Ce contrôle comptait
    // auparavant tous les évènements sans les trier : un calendrier dont la
    // synchro allait tout écarter s'affichait « 12 réservations à venir ✓ », et
    // le partenaire découvrait des semaines plus tard qu'aucun ménage n'avait
    // été créé. Un contrôle qui ne dit pas la même chose que le traitement réel
    // est pire que pas de contrôle du tout.
    const platform = detectPlatform(url);
    const events = parseICal(text);
    const today = new Date().toLocaleDateString('en-CA');
    const classified = events.map(e => ({ ev: e, status: classifyEvent(e, false, platform) }));
    const reservations = classified.filter(c => c.status === 'confirmed').map(c => c.ev);
    const blocked = classified.filter(c => c.status === 'blocked').length;
    const upcoming = reservations.filter(e => e.end >= today).sort((a, b) => a.end.localeCompare(b.end));

    return NextResponse.json({
      ok: true,
      platform,
      total: events.length,
      // Ce que la synchro retiendra vraiment, et ce qu'elle écartera.
      reservations: reservations.length,
      blocked,
      upcoming: upcoming.length,
      nextCheckOut: upcoming[0]?.end ?? null,
    });
  } catch (e: unknown) {
    const aborted = e instanceof Error && e.name === 'AbortError';
    return NextResponse.json({
      ok: false,
      error: aborted
        ? 'La plateforme n’a pas répondu à temps. Réessayez dans un instant.'
        : 'Impossible de joindre ce lien. Vérifiez qu’il est complet et public.',
    });
  } finally {
    clearTimeout(timer);
  }
}
