import { supabase } from './supabase';
import type { AppNotification } from './types';

// ════════════════════════════════════════════════════════════════════════════
//  Système de notifications — création automatique dans la logique métier
//  (db.ts) + lecture pour la cloche in-app + déclenchement des push.
//  Toutes les fonctions d'événement avalent leurs erreurs : une notification
//  qui échoue ne doit JAMAIS casser l'action métier (création/màj de mission).
// ════════════════════════════════════════════════════════════════════════════

type Recipient = { userId: string; role: 'admin' | 'cleaner' | 'partner' };
type NotifInput = Recipient & { title: string; message: string; type: string; missionId?: string | null };

function fmtDate(d: string): string {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function trimTime(t?: string | null): string {
  return (t ?? '').substring(0, 5);
}
function urlForRole(role: string): string {
  switch (role) {
    case 'admin': return '/admin/missions';
    case 'cleaner': return '/cleaner';
    case 'airbnb': return '/airbnb/missions';
    case 'hotel': return '/hotel/historique';
    default: return '/';
  }
}

// ── Résolution des destinataires ───────────────────────────────────────────────
async function adminUserIds(): Promise<string[]> {
  const { data } = await supabase.from('users').select('id').eq('role', 'admin');
  return (data ?? []).map((u: { id: string }) => u.id);
}

interface MissionContext {
  place: string;
  date: string;
  time: string;
  cleanerUserId: string | null;
  cleanerName: string | null;
  createdBy: string | null;
  createdByRole: string | null;
}

async function loadMissionContext(missionId: string): Promise<MissionContext | null> {
  const { data, error } = await supabase
    .from('missions')
    .select('id, date_from, time_from, property_name, client_name, cleaner_id, cleaner_name, created_by, created_by_role, airbnbs(name)')
    .eq('id', missionId)
    .single();
  if (error || !data) return null;

  const apt = (data as { airbnbs?: { name?: string } | null }).airbnbs;
  const place = apt?.name || data.property_name || data.client_name || 'Mission';

  let cleanerUserId: string | null = null;
  if (data.cleaner_id) {
    const { data: c } = await supabase.from('cleaners').select('user_id').eq('id', data.cleaner_id).single();
    cleanerUserId = c?.user_id ?? null;
  }
  return {
    place, date: data.date_from ?? '', time: trimTime(data.time_from),
    cleanerUserId, cleanerName: data.cleaner_name ?? null,
    createdBy: data.created_by ?? null, createdByRole: data.created_by_role ?? null,
  };
}

// ── Insertion + déclenchement push ─────────────────────────────────────────────
async function dispatch(rows: NotifInput[]) {
  if (rows.length === 0) return;
  try {
    await supabase.from('notifications').insert(rows.map(r => ({
      user_id: r.userId, role: r.role, title: r.title, message: r.message,
      type: r.type, mission_id: r.missionId ?? null,
    })));
  } catch (e) {
    console.error('notifications insert error:', e);
  }
  // Push (best-effort, côté client uniquement)
  if (typeof window !== 'undefined') {
    try {
      fetch('/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: rows.map(r => ({
            userId: r.userId, title: r.title, body: r.message,
            url: urlForRole(r.role),
            tag: `${r.type}-${r.missionId ?? ''}`,
          })),
        }),
      }).catch(() => {});
    } catch { /* ignore */ }
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  ÉVÉNEMENTS MÉTIER (appelés depuis db.ts)
// ════════════════════════════════════════════════════════════════════════════

// A. Un partenaire (hôtel / Airbnb) crée une mission → admin
export async function notifyPartnerCreatedMission(partnerName: string, date: string, time: string, missionId?: string | null) {
  try {
    const admins = await adminUserIds();
    await dispatch(admins.map(id => ({
      userId: id, role: 'admin' as const,
      title: 'Nouvelle mission',
      message: `${partnerName} a créé une mission pour le ${fmtDate(date)} à ${trimTime(time)}.`,
      type: 'mission_created', missionId: missionId ?? null,
    })));
  } catch (e) { console.error('notifyPartnerCreatedMission:', e); }
}

// A bis. Alerte de SYNCHRONISATION → admins (changement de date sur mission assignée,
// flux en panne, réservation annulée alors que la mission est assignée).
export async function notifyAdminsSync(title: string, message: string, missionId?: string | null) {
  try {
    const admins = await adminUserIds();
    await dispatch(admins.map(id => ({
      userId: id, role: 'admin' as const, title, message, type: 'sync', missionId: missionId ?? null,
    })));
  } catch (e) { console.error('notifyAdminsSync:', e); }
}

// B. Nouvelle mission pour un cleaner (assignation) → cleaner
export async function notifyCleanerNewMission(missionId: string) {
  try {
    const ctx = await loadMissionContext(missionId);
    if (!ctx || !ctx.cleanerUserId) return;
    await dispatch([{
      userId: ctx.cleanerUserId, role: 'cleaner',
      title: 'Nouvelle mission',
      message: `Vous avez une mission le ${fmtDate(ctx.date)} à ${ctx.time} pour ${ctx.place}.`,
      type: 'mission_new', missionId,
    }]);
  } catch (e) { console.error('notifyCleanerNewMission:', e); }
}

// C. Mission modifiée → admin + cleaner (si assignée)
export async function notifyMissionModified(missionId: string, actorRole: string, actorId: string) {
  try {
    const ctx = await loadMissionContext(missionId);
    if (!ctx) return;
    const admins = await adminUserIds();
    const message = `La mission ${ctx.place} du ${fmtDate(ctx.date)} a été modifiée.`;
    const rows: NotifInput[] = [];
    admins.forEach(id => {
      if (actorRole === 'admin' && id === actorId) return; // pas d'auto-notif
      rows.push({ userId: id, role: 'admin', title: 'Mission modifiée', message, type: 'mission_modified', missionId });
    });
    if (ctx.cleanerUserId && ctx.cleanerUserId !== actorId) {
      rows.push({ userId: ctx.cleanerUserId, role: 'cleaner', title: 'Mission modifiée', message, type: 'mission_modified', missionId });
    }
    await dispatch(rows);
  } catch (e) { console.error('notifyMissionModified:', e); }
}

// D. Mission annulée → admin + cleaner (si assignée). À appeler AVANT suppression.
export async function notifyMissionCancelled(missionId: string, actorRole: string, actorId: string) {
  try {
    const ctx = await loadMissionContext(missionId);
    if (!ctx) return;
    const admins = await adminUserIds();
    const message = `La mission ${ctx.place} du ${fmtDate(ctx.date)} a été annulée.`;
    const rows: NotifInput[] = [];
    admins.forEach(id => {
      if (actorRole === 'admin' && id === actorId) return;
      rows.push({ userId: id, role: 'admin', title: 'Mission annulée', message, type: 'mission_cancelled', missionId });
    });
    if (ctx.cleanerUserId && ctx.cleanerUserId !== actorId) {
      rows.push({ userId: ctx.cleanerUserId, role: 'cleaner', title: 'Mission annulée', message, type: 'mission_cancelled', missionId });
    }
    await dispatch(rows);
  } catch (e) { console.error('notifyMissionCancelled:', e); }
}

// E. Mission terminée → admin + partenaire/client créateur
export async function notifyMissionCompleted(missionId: string) {
  try {
    const ctx = await loadMissionContext(missionId);
    if (!ctx) return;
    const admins = await adminUserIds();
    const message = `La mission ${ctx.place} a été terminée par ${ctx.cleanerName ?? 'le cleaner'}.`;
    const rows: NotifInput[] = admins.map(id => ({
      userId: id, role: 'admin' as const, title: 'Mission terminée', message, type: 'mission_completed', missionId,
    }));
    if (ctx.createdBy) {
      rows.push({ userId: ctx.createdBy, role: 'partner', title: 'Mission terminée', message, type: 'mission_completed', missionId });
    }
    await dispatch(rows);
  } catch (e) { console.error('notifyMissionCompleted:', e); }
}

// F. Le cleaner demande du temps supplémentaire → admin
export async function notifyExtraTimeRequested(missionId: string, minutes: number) {
  try {
    const ctx = await loadMissionContext(missionId);
    if (!ctx) return;
    const admins = await adminUserIds();
    const message = `${ctx.cleanerName ?? 'Un cleaner'} demande +${minutes} min pour ${ctx.place} (${fmtDate(ctx.date)}).`;
    await dispatch(admins.map(id => ({
      userId: id, role: 'admin' as const,
      title: 'Demande de temps', message, type: 'extra_time_requested', missionId,
    })));
  } catch (e) { console.error('notifyExtraTimeRequested:', e); }
}

// G. L'admin approuve / refuse la demande → cleaner
export async function notifyExtraTimeResolved(missionId: string, approved: boolean) {
  try {
    const ctx = await loadMissionContext(missionId);
    if (!ctx || !ctx.cleanerUserId) return;
    const message = approved
      ? `Votre demande de temps supplémentaire pour ${ctx.place} a été acceptée.`
      : `Votre demande de temps supplémentaire pour ${ctx.place} a été refusée.`;
    await dispatch([{
      userId: ctx.cleanerUserId, role: 'cleaner',
      title: approved ? 'Temps accordé' : 'Temps refusé',
      message, type: 'extra_time_resolved', missionId,
    }]);
  } catch (e) { console.error('notifyExtraTimeResolved:', e); }
}

// ════════════════════════════════════════════════════════════════════════════
//  CLOCHE IN-APP (lecture / statut lu)
// ════════════════════════════════════════════════════════════════════════════

function rowToNotif(r: Record<string, unknown>): AppNotification {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    role: (r.role as string) ?? '',
    title: r.title as string,
    message: r.message as string,
    type: (r.type as string) ?? '',
    missionId: (r.mission_id as string) ?? undefined,
    read: !!r.read,
    createdAt: (r.created_at as string) ?? '',
  };
}

export async function getNotificationsDB(userId: string, limit = 40): Promise<AppNotification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map(rowToNotif);
}

export async function getUnreadCountDB(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);
  return count ?? 0;
}

export async function markNotificationReadDB(id: string) {
  await supabase.from('notifications').update({ read: true }).eq('id', id);
}

export async function markAllNotificationsReadDB(userId: string) {
  await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
}

// ════════════════════════════════════════════════════════════════════════════
//  ABONNEMENTS PUSH
// ════════════════════════════════════════════════════════════════════════════

export async function savePushSubscriptionDB(userId: string, role: string, sub: PushSubscriptionJSON, deviceType: string) {
  if (!sub.endpoint) return;
  await supabase.from('push_subscriptions').upsert({
    user_id: userId,
    role,
    endpoint: sub.endpoint,
    subscription: sub,
    device_type: deviceType,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'endpoint' });
}

export async function deletePushSubscriptionDB(endpoint: string) {
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}
