import { annexe } from './db/shared';
import type { AppNotification } from './types';

// ════════════════════════════════════════════════════════════════════════════
//  Notifications — cloche in-app (lecture, statut lu) et abonnements push.
//  Les notifications d'ÉVÉNEMENTS (mission créée, terminée…) sont envoyées
//  par le serveur : cf. notificationEvents.ts.
// ════════════════════════════════════════════════════════════════════════════

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

// Types qui NE passent PAS par la cloche : ils ont un écran dédié où le travail
// se fait, et la cloche les noyait au milieu des missions et des rappels. Une
// demande de devis reste visible dans « Devis > Demandes à traiter » tant qu'elle
// n'est pas chiffrée — une notification, elle, disparaît dès qu'on la lit, traitée
// ou non. Le push, lui, continue de partir : c'est ce qui prévient hors de l'app.
// `type` est nullable en base : un simple NOT IN écarterait aussi les lignes sans
// type (en SQL, NULL NOT IN (...) vaut NULL, donc faux). On garde explicitement
// les types absents, sinon d'anciennes notifications disparaîtraient de la cloche.
// Filtre appliqué côté serveur (cf. lib/annexes.ts, FILTRE_CLOCHE).

export async function getNotificationsDB(_userId: string, limit = 40): Promise<AppNotification[]> {
  // Uniquement les notifications de l'utilisateur connecté (session, côté serveur).
  try { return ((await annexe('notifs', { limit })).data ?? []).map(rowToNotif); }
  catch { return []; }
}

export async function getUnreadCountDB(_userId: string): Promise<number> {
  try { return Number((await annexe('notifs-unread')).count) || 0; }
  catch { return 0; }
}

export async function markNotificationReadDB(id: string) {
  try { await annexe('notif-read', { id }); } catch { /* sans gravité */ }
}

export async function markAllNotificationsReadDB(_userId: string) {
  try { await annexe('notifs-read-all'); } catch { /* sans gravité */ }
}

// ════════════════════════════════════════════════════════════════════════════
//  ABONNEMENTS PUSH
// ════════════════════════════════════════════════════════════════════════════

export async function savePushSubscriptionDB(_userId: string, _role: string, sub: PushSubscriptionJSON, deviceType: string) {
  if (!sub.endpoint) return;
  // Rattaché à l'utilisateur de la SESSION : on ne peut plus abonner le
  // téléphone de quelqu'un d'autre à ses notifications.
  try { await annexe('push-save', { subscription: sub, deviceType }); }
  catch (e) { console.error('savePushSubscriptionDB:', e); }
}

export async function deletePushSubscriptionDB(endpoint: string) {
  try { await annexe('push-delete', { endpoint }); } catch { /* sans gravité */ }
}
