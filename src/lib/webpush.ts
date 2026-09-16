import webpush from 'web-push';
import { supabase } from './supabase';
import { getSupabaseAdmin } from './supabaseAdmin';
import { isApnsConfigured, sendApns, type ApnsEnvironment } from './apns';

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

// Envoi vers TOUS les appareils de l'utilisateur, quel que soit le canal :
//   • web  → navigateurs, PWA installée, application Android (TWA, moteur Chrome)
//   • natif → application iOS de l'App Store (APNs — voir apns.ts)
// Un utilisateur qui a l'app sur iPhone et le site sur son ordinateur reçoit
// donc la notification aux deux endroits, sans double configuration.
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!userId) return;
  await Promise.all([sendWebPush(userId, payload), sendNativePush(userId, payload)]);
}

async function sendWebPush(userId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;

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

async function sendNativePush(userId: string, payload: PushPayload): Promise<void> {
  if (!isApnsConfigured()) return;

  try {
    const db = getSupabaseAdmin();
    const { data } = await db
      .from('native_push_tokens')
      .select('token, environment')
      .eq('user_id', userId);

    const tokens = (data ?? []) as { token: string; environment: ApnsEnvironment | null }[];
    if (tokens.length === 0) return;

    const results = await sendApns(
      tokens.map(t => ({ token: t.token, environment: t.environment ?? undefined })),
      payload,
    );

    // Apple nous dit quels appareils n'existent plus (app désinstallée, jeton
    // périmé) : on nettoie, sinon la table gonfle et chaque envoi ralentit.
    const dead = results.filter(r => r.gone).map(r => r.token);
    if (dead.length > 0) {
      await db.from('native_push_tokens').delete().in('token', dead);
    }
  } catch {
    // Une panne du canal iOS ne doit jamais faire échouer l'action métier
    // (création de mission, validation…) qui a déclenché la notification.
  }
}
