import { NextRequest, NextResponse } from 'next/server';
import { sendPushToUser } from '@/lib/webpush';

export const runtime = 'nodejs';

// Reçoit une liste d'items {userId, title, body, url, tag} et envoie un push
// à chaque destinataire (tous ses appareils abonnés).
export async function POST(req: NextRequest) {
  try {
    const { items } = await req.json();
    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'items requis' }, { status: 400 });
    }
    await Promise.all(items.map((it: { userId: string; title: string; body: string; url?: string; tag?: string }) =>
      sendPushToUser(it.userId, { title: it.title, body: it.body, url: it.url, tag: it.tag }),
    ));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error)?.message ?? 'Erreur push' }, { status: 500 });
  }
}
