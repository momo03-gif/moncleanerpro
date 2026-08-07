import { supabase } from './supabase';
import type { AppNotification } from './types';

// ════════════════════════════════════════════════════════════════════════════
//  Système de notifications — création automatique dans la logique métier
//  (db.ts) + lecture pour la cloche in-app + déclenchement des push.
//  Toutes les fonctions d'événement avalent leurs erreurs : une notification
//  qui échoue ne doit JAMAIS casser l'action métier (création/màj de mission).
// ════════════════════════════════════════════════════════════════════════════

type Recipient = { userId: string; role: 'admin' | 'cleaner' | 'partner' | 'hotel' | 'airbnb' };

// Libellés des prestations hôtel (pour les messages de notification).
const HOTEL_TYPE_LABEL: Record<string, string> = {
  menage: 'Ménage courant', grand_menage: 'Grand ménage', checkin: 'Check-in', checkout: 'Check-out',
};
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
  partnerId: string | null;
}

async function loadMissionContext(missionId: string): Promise<MissionContext | null> {
  const { data, error } = await supabase
    .from('missions')
    .select('id, date_from, time_from, property_name, client_name, cleaner_id, cleaner_name, created_by, created_by_role, partner_id, airbnbs(name)')
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
    partnerId: (data as { partner_id?: string | null }).partner_id ?? null,
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

// A ter. Décision de l'équipe sur une demande hôtel → l'hôtel est prévenu
// (acceptée ou refusée). Évite qu'il ait à vérifier son suivi manuellement.
export async function notifyHotelRequestDecision(hotelUserId: string, accepted: boolean, typePrestation: string, date: string) {
  if (!hotelUserId) return;
  try {
    const label = HOTEL_TYPE_LABEL[typePrestation] ?? 'Ménage';
    await dispatch([{
      userId: hotelUserId, role: 'hotel',
      title: accepted ? 'Demande acceptée' : 'Demande refusée',
      message: accepted
        ? `Votre demande « ${label} » du ${fmtDate(date)} a été acceptée. Un agent va intervenir.`
        : `Votre demande « ${label} » du ${fmtDate(date)} a été refusée. Contactez l'équipe si besoin.`,
      type: accepted ? 'request_accepted' : 'request_refused',
    }]);
  } catch (e) { console.error('notifyHotelRequestDecision:', e); }
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

// A bis. Un cleaner DEMANDE une mission → admins. Il ne se l'assigne pas lui-même :
// tant que l'admin n'a pas validé, la mission reste à pourvoir.
export async function notifyAdminsMissionRequested(missionId: string, cleanerName: string) {
  try {
    const ctx = await loadMissionContext(missionId);
    const admins = await adminUserIds();
    const quand = ctx ? ` du ${fmtDate(ctx.date)} à ${ctx.time} (${ctx.place})` : '';
    await dispatch(admins.map(id => ({
      userId: id, role: 'admin' as const,
      title: 'Demande de mission',
      message: `${cleanerName} demande la mission${quand}. À valider ou refuser.`,
      type: 'mission_requested', missionId,
    })));
  } catch (e) { console.error('notifyAdminsMissionRequested:', e); }
}

// A ter. Décision de l'admin sur une demande → le cleaner concerné.
export async function notifyCleanerRequestDecision(missionId: string, cleanerId: string, approved: boolean) {
  try {
    const ctx = await loadMissionContext(missionId);
    const { data: c } = await supabase.from('cleaners').select('user_id').eq('id', cleanerId).single();
    if (!c?.user_id) return;
    const quand = ctx ? ` du ${fmtDate(ctx.date)} à ${ctx.time} (${ctx.place})` : '';
    await dispatch([{
      userId: c.user_id, role: 'cleaner',
      title: approved ? 'Mission validée' : 'Demande refusée',
      message: approved
        ? `Votre demande pour la mission${quand} est validée. Elle est dans votre planning.`
        : `Votre demande pour la mission${quand} n'a pas été retenue.`,
      type: approved ? 'mission_new' : 'mission_request_refused', missionId,
    }]);
  } catch (e) { console.error('notifyCleanerRequestDecision:', e); }
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

// D bis. Désistement d'un cleaner → admin uniquement.
// La mission n'est pas annulée : elle est retombée dans le pool non assigné et
// attend une réattribution. Le message doit donc appeler à l'action, pas annoncer
// une annulation. `cleanerName` est passé par l'appelant car la mission vient
// justement d'être détachée du cleaner.
export async function notifyMissionWithdrawn(missionId: string, cleanerName: string | null) {
  try {
    const ctx = await loadMissionContext(missionId);
    if (!ctx) return;
    const admins = await adminUserIds();
    const who = cleanerName ?? 'Un cleaner';
    const message = `${who} s'est désisté de la mission ${ctx.place} du ${fmtDate(ctx.date)}. Elle est à réattribuer.`;
    await dispatch(admins.map(id => ({
      userId: id, role: 'admin' as const, title: 'Désistement cleaner',
      message, type: 'mission_withdrawn', missionId,
    })));
  } catch (e) { console.error('notifyMissionWithdrawn:', e); }
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
    // Le partenaire est identifié par partner_id (autoritaire, y compris pour les
    // ménages AUTO-synchronisés dont created_by est null), sinon par le créateur.
    // Message orienté « compte-rendu » : on l'invite à consulter photos + rapport.
    const partnerRecipient = ctx.partnerId ?? ctx.createdBy;
    if (partnerRecipient) {
      const partnerMsg = `Ménage terminé à ${ctx.place}. Compte-rendu disponible : photos avant/après et rapport.`;
      rows.push({ userId: partnerRecipient, role: 'partner', title: 'Ménage terminé — compte-rendu prêt', message: partnerMsg, type: 'mission_completed', missionId });
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
