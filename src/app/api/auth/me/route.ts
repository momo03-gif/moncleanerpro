// ── GET /api/auth/me ──────────────────────────────────────────────────────────────
// Renvoie l'utilisateur de la session courante (ou null). Sert à hydrater le
// contexte d'auth côté client au chargement.

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/session';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });
  return NextResponse.json({ user: { ...user, password: '' } });
}
