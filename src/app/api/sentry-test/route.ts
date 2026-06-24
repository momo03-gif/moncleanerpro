// Route TEMPORAIRE de vérification Sentry : envoie une erreur de test au dashboard.
// À supprimer après confirmation.
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const eventId = Sentry.captureException(new Error('Test Sentry MonCleanerPro — route de vérification'));
  await Sentry.flush(3000);
  return NextResponse.json({ ok: true, eventId });
}
