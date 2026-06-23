// ── POST /api/auth/logout ─────────────────────────────────────────────────────────
// Supprime le cookie de session.

import { NextResponse } from 'next/server';
import { deleteSession } from '@/lib/session';

export const runtime = 'nodejs';

export async function POST() {
  await deleteSession();
  return NextResponse.json({ ok: true });
}
