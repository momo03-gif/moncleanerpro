import { NextRequest, NextResponse } from 'next/server';
import { parseICal } from '@/lib/ical';
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

    const events = parseICal(text);
    const today = new Date().toLocaleDateString('en-CA');
    const upcoming = events.filter(e => e.end >= today).sort((a, b) => a.end.localeCompare(b.end));

    return NextResponse.json({
      ok: true,
      platform: detectPlatform(url),
      total: events.length,
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
