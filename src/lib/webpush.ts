import webpush from 'web-push';
import { supabase } from './supabase';

// Envoi des notifications push (Web Push / VAPID) — côté serveur uniquement.
// Si les clés VAPID ne sont pas configurées, on no-op silencieusement
// (les notifications in-app continuent de fonctionner).

let configured: boolean | null = null;

function ensureConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:contact@moncleanerpro.com';
  if (!pub || !priv) { configured = false; return false; }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured() || !userId) return;

  const { data } = await supabase
    .from('push_subscriptions')
    .select('endpoint, subscription')
    .eq('user_id', userId);

  await Promise.all((data ?? []).map(async (row: { endpoint: string; subscription: unknown }) => {
    try {
      await webpush.sendNotification(row.subscription as webpush.PushSubscription, JSON.stringify(payload));
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      // Abonnement expiré / invalide → on le supprime
      if (code === 404 || code === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', row.endpoint);
      }
    }
  }));
}
