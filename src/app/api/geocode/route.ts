import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Géocode une adresse via Nominatim (OpenStreetMap), gratuit et sans clé.
// Passe par le serveur pour : (1) éviter le CORS, (2) imposer le User-Agent
// exigé par la politique d'usage de Nominatim.
// GET /api/geocode?q=<adresse>  →  { lat, lon } | null
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim();
  if (!q) return NextResponse.json({ error: 'q requis' }, { status: 400 });

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'MonCleanerPro/1.0 (contact@moncleanerpro.fr)',
        'Accept-Language': 'fr',
      },
    });
    if (!res.ok) return NextResponse.json(null);

    const data = await res.json();
    const first = Array.isArray(data) ? data[0] : null;
    if (!first?.lat || !first?.lon) return NextResponse.json(null);

    return NextResponse.json({ lat: Number(first.lat), lon: Number(first.lon) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message ?? 'Erreur géocodage' }, { status: 500 });
  }
}
