import { supabase } from './supabase';
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
const BELL_HIDDEN_TYPES = ['devis_request'];
const HIDDEN_FILTER = `type.is.null,type.not.in.(${BELL_HIDDEN_TYPES.join(',')})`;

export async function getNotificationsDB(userId: string, limit = 40): Promise<AppNotification[]> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .or(HIDDEN_FILTER)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map(rowToNotif);
}

export async function getUnreadCountDB(userId: string): Promise<number> {
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)
    .or(HIDDEN_FILTER);
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
