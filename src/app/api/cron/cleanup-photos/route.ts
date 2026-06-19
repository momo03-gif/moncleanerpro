import { NextRequest, NextResponse } from 'next/server';
import { deleteExpiredMissionPhotosDB, PHOTO_RETENTION_DAYS } from '@/lib/missionPhotos';

export const runtime = 'nodejs';

// Purge automatique des photos de mission expirées (Vercel Cron) :
//   /api/cron/cleanup-photos
// Supprime du bucket Storage ET de la table les photos de plus de
// PHOTO_RETENTION_DAYS jours. Protégé par CRON_SECRET (header Bearer ou ?key=).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    const key = new URL(req.url).searchParams.get('key');
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const { deleted, error } = await deleteExpiredMissionPhotosDB();
  if (error) return NextResponse.json({ ok: false, error }, { status: 500 });

  return NextResponse.json({ ok: true, deleted, retentionDays: PHOTO_RETENTION_DAYS });
}
