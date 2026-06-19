import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { sendPushToUser } from '@/lib/webpush';
import { deleteExpiredMissionPhotosDB } from '@/lib/missionPhotos';

export const runtime = 'nodejs';

// Rappels automatiques (Vercel Cron) :
//   /api/cron/reminders?when=today    → missions du jour
//   /api/cron/reminders?when=tomorrow → missions de demain
// Protégé par CRON_SECRET (Vercel envoie « Authorization: Bearer <CRON_SECRET> »).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    const key = new URL(req.url).searchParams.get('key');
    if (auth !== `Bearer ${secret}` && key !== secret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }

  const when = new URL(req.url).searchParams.get('when') === 'tomorrow' ? 'tomorrow' : 'today';

  // Date cible au fuseau Europe/Paris (au format YYYY-MM-DD)
  const parisDate = (offsetDays: number) => {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  };
  const date = when === 'tomorrow' ? parisDate(1) : parisDate(0);

  // Missions de ce jour, assignées à un cleaner, ni annulées ni terminées
  const { data: missions } = await supabase
    .from('missions')
    .select('cleaner_id, status')
    .eq('date_from', date)
    .not('cleaner_id', 'is', null)
    .not('status', 'in', '(cancelled,done)');

  const counts: Record<string, number> = {};
  (missions ?? []).forEach((m: { cleaner_id: string }) => {
    counts[m.cleaner_id] = (counts[m.cleaner_id] ?? 0) + 1;
  });

  const title = when === 'tomorrow' ? 'Missions de demain' : 'Missions du jour';
  const results: { cleaner: string | null; count: number }[] = [];

  for (const cleanerId of Object.keys(counts)) {
    const n = counts[cleanerId];
    const { data: c } = await supabase.from('cleaners').select('user_id, name').eq('id', cleanerId).single();
    if (!c?.user_id) continue;

    const message = when === 'tomorrow'
      ? `Vous avez ${n} mission${n > 1 ? 's' : ''} prévue${n > 1 ? 's' : ''} demain.`
      : `Vous avez ${n} mission${n > 1 ? 's' : ''} aujourd'hui.`;

    await supabase.from('notifications').insert({
      user_id: c.user_id, role: 'cleaner', title, message,
      type: when === 'tomorrow' ? 'reminder_tomorrow' : 'reminder_today',
    });
    await sendPushToUser(c.user_id, { title, body: message, url: '/cleaner' });
    results.push({ cleaner: c.name, count: n });
  }

  // Purge quotidienne des photos expirées, branchée sur le run « today » pour
  // rester dans la limite de 2 crons de l'offre gratuite Vercel. Best-effort :
  // un échec de purge ne doit pas casser l'envoi des rappels.
  let photosDeleted = 0;
  if (when === 'today') {
    try { photosDeleted = (await deleteExpiredMissionPhotosDB()).deleted; }
    catch (e) { console.error('cleanup photos (piggyback):', e); }
  }

  return NextResponse.json({ ok: true, when, date, notified: results.length, results, photosDeleted });
}
