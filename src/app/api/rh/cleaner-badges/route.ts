import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { computeBadges, computeLevel, type BadgeStats } from '@/lib/badges';

// ══════════════════════════════════════════════════════════════════════════════
//  Badges cleaner (LOT 6) calculés CÔTÉ SERVEUR (LOT 4).
//  Le cleaner ne lit JAMAIS les tables RH : cette route lit en service_role et ne
//  renvoie que des données NON sensibles (badges débloqués, niveau, classement par
//  nombre de missions). Aucun montant, aucune prime, aucun score brut exposé.
// ══════════════════════════════════════════════════════════════════════════════

export const runtime = 'nodejs';

function period() { return new Date().toISOString().slice(0, 7); }
function monthBounds(p: string) {
  const [y, m] = p.split('-').map(Number);
  return { start: `${p}-01`, nextStart: m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01` };
}

export async function POST(req: Request) {
  let userId = '';
  try { userId = String((await req.json())?.userId ?? ''); } catch { /* noop */ }
  if (!userId) return NextResponse.json({ error: 'userId requis.' }, { status: 400 });

  let supabaseAdmin;
  try { supabaseAdmin = getSupabaseAdmin(); }
  catch { return NextResponse.json({ badges: [], level: null, podium: [], rankText: '' }); }

  // Résolution users.id → cleaners.id (service_role).
  const { data: cleaner } = await supabaseAdmin.from('cleaners').select('id').eq('user_id', userId).single();
  const cleanerId = cleaner?.id;
  if (!cleanerId) return NextResponse.json({ badges: [], level: null, podium: [], rankText: '' });

  const p = period();
  const { start, nextStart } = monthBounds(p);

  // Missions terminées du cleaner (aucune colonne montant sélectionnée).
  const [{ data: myMissions }, { data: monthIncidents }, { data: lastIncident }, { data: ranking }] = await Promise.all([
    supabaseAdmin.from('missions').select('date_from, time_from, status').eq('cleaner_id', cleanerId).eq('status', 'done'),
    supabaseAdmin.from('rh_incidents').select('id').eq('cleaner_id', cleanerId).gte('date', start).lt('date', nextStart),
    supabaseAdmin.from('rh_incidents').select('date').eq('cleaner_id', cleanerId).order('date', { ascending: false }).limit(1),
    supabaseAdmin.from('missions').select('cleaner_id, cleaners(name)').eq('status', 'done').like('date_from', `${p}%`),
  ]);

  const completed = myMissions ?? [];
  const completedTotal = completed.length;
  const morningCount = completed.filter((m: any) => (m.time_from ?? '').slice(0, 5) < '09:00' && (m.time_from ?? '').length >= 5).length;
  const incidentsThisMonth = (monthIncidents ?? []).length;
  const lastDate: string | null = lastIncident?.[0]?.date ?? null;

  let daysSinceLastIncident = 9999;
  if (lastDate) daysSinceLastIncident = Math.max(0, Math.floor((Date.now() - new Date(lastDate + 'T00:00:00').getTime()) / 86400000));
  else if (completedTotal > 0) {
    const first = completed.map((m: any) => m.date_from).filter(Boolean).sort()[0];
    if (first) daysSinceLastIncident = Math.max(0, Math.floor((Date.now() - new Date(first + 'T00:00:00').getTime()) / 86400000));
  }

  const stats: BadgeStats = { completedTotal, morningCount, incidentsThisMonth, daysSinceLastIncident };
  const badges = computeBadges(stats);
  const level = computeLevel(completedTotal);

  // Classement (nombre de missions) — agrégat sans montant.
  const counts = new Map<string, { name: string; count: number }>();
  (ranking ?? []).forEach((r: any) => {
    if (!r.cleaner_id) return;
    const e = counts.get(r.cleaner_id) ?? { name: r.cleaners?.name ?? 'Cleaner', count: 0 };
    e.count += 1; counts.set(r.cleaner_id, e);
  });
  const sorted = Array.from(counts.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.count - a.count);
  const podium = sorted.slice(0, 3).map(r => ({ name: r.name, count: r.count }));
  const myIndex = sorted.findIndex(r => r.id === cleanerId);

  let rankText: string;
  if (myIndex >= 3) {
    const toTop3 = sorted[2].count - sorted[myIndex].count + 1;
    rankText = `${myIndex + 1}e ce mois — ${toTop3} mission${toTop3 > 1 ? 's' : ''} pour le top 3`;
  } else if (myIndex >= 0) rankText = `${myIndex + 1}e ce mois — dans le top 3, continue !`;
  else rankText = 'Termine ta première mission du mois pour entrer au classement.';

  return NextResponse.json({ badges, level, podium, rankText });
}
