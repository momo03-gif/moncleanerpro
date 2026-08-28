'use client';

import { useState, useEffect, useCallback, useRef, useId } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedback } from '@/contexts/FeedbackContext';
import type { AppNotification } from '@/lib/types';
import Icon, { type IconName } from '@/components/Icon';
import { alertUser } from '@/lib/alert';

// Perf : la couche données (supabase + fonctions notifications) est importée en
// DIFFÉRÉ (dynamic import après le montage). La cloche est rendue dans la nav de
// toutes les pages connectées ; en la chargeant à la demande, on sort le client
// supabase (~222 Ko) du chemin critique de chaque page. Le temps réel reste
// intact — il est juste branché une fois la page interactive.
const loadNotifApi = () => import('@/lib/notifications');
const loadSupabase = () => import('@/lib/supabase');

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

const TYPE_ICON: Record<string, IconName> = {
  mission_created: 'request', mission_new: 'missions', mission_modified: 'missions',
  mission_cancelled: 'close', mission_completed: 'check', mission_withdrawn: 'cleaners',
  reminder_today: 'today', reminder_tomorrow: 'today',
  extra_time_requested: 'history', extra_time_resolved: 'check',
  devis_request: 'invoice', appointment_booked: 'today',
};

// Destination d'une notification quand on clique dessus. Le TYPE prime (une
// demande de devis ouvre l'écran Devis), sinon on route selon le RÔLE du
// destinataire. Aligné sur urlForRole() côté serveur (push).
// Note : les demandes de devis ne s'affichent plus dans cette cloche (voir
// BELL_HIDDEN_TYPES) ; la règle reste ici pour le push, qui ouvre la même page.
function hrefForNotif(type: string, role: string): string {
  if (type === 'devis_request') return '/admin/devis';
  if (type === 'appointment_booked') return '/admin/rendez-vous';
  switch (role) {
    case 'admin': return '/admin/missions';
    case 'cleaner': return '/cleaner';
    case 'airbnb':
    case 'partner': return '/airbnb/missions';
    case 'hotel': return '/hotel/historique';
    default: return '/';
  }
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `il y a ${d} j`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

function urlB64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function deviceType(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
}

// `align` = côté d'ouverture du panneau. Par défaut 'right' (cloche en haut à
// droite d'une barre). Passer 'left' quand la cloche est à GAUCHE de l'écran
// (sidebar admin) : sinon le panneau s'étend vers la gauche et sort de l'écran.
export default function NotificationBell({ light = false, align = 'right' }: { light?: boolean; align?: 'left' | 'right' }) {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [pushBusy, setPushBusy] = useState(false);
  const firstLoad = useRef(true);
  // Identifiant unique par instance : évite la collision de canaux temps réel
  // quand la cloche est rendue plusieurs fois (ex. sidebar admin desktop + mobile).
  // useId() est stable, unique et SSR-safe (pas d'impureté au render, pas de
  // divergence d'hydratation contrairement à Math.random()).
  const channelId = useRef(useId().replace(/:/g, ''));

  const load = useCallback(async () => {
    if (!user) return;
    const { getNotificationsDB, getUnreadCountDB } = await loadNotifApi();
    const [list, count] = await Promise.all([getNotificationsDB(user.id), getUnreadCountDB(user.id)]);
    setItems(list);
    setUnread(count);
  }, [user]);

  useEffect(() => {
    if (typeof Notification !== 'undefined') setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    // Abonnement temps réel branché en différé (après chargement du client supabase).
    let cleanup = () => {};
    (async () => {
      try {
        const { supabase } = await loadSupabase();
        const ch = supabase
          .channel(`notif-${user.id}-${channelId.current}`)
          .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
            () => {
              if (!firstLoad.current) alertUser();
              load();
            })
          .subscribe();
        cleanup = () => { try { supabase.removeChannel(ch); } catch { /* ignore */ } };
      } catch (e) {
        console.error('notif realtime:', e);
      }
    })();
    firstLoad.current = false;
    return () => cleanup();
  }, [user, load]);

  async function handleOpen() {
    setOpen(o => !o);
  }

  async function markRead(n: AppNotification) {
    if (n.read) return;
    setItems(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
    setUnread(u => Math.max(0, u - 1));
    const { markNotificationReadDB } = await loadNotifApi();
    await markNotificationReadDB(n.id);
  }

  // Clic sur une notification : marque lue, ferme le panneau et ouvre la page liée.
  function openNotif(n: AppNotification) {
    markRead(n);
    setOpen(false);
    router.push(hrefForNotif(n.type, n.role || user?.role || ''));
  }

  async function markAll() {
    if (!user) return;
    setItems(prev => prev.map(x => ({ ...x, read: true })));
    setUnread(0);
    const { markAllNotificationsReadDB } = await loadNotifApi();
    await markAllNotificationsReadDB(user.id);
  }

  async function enablePush() {
    if (!user) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !VAPID) {
      toast("Notifications push indisponibles sur cet appareil.", 'error');
      return;
    }
    setPushBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === 'granted') {
        const reg = await navigator.serviceWorker.ready;
        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(VAPID) as BufferSource,
          });
        }
        const { savePushSubscriptionDB } = await loadNotifApi();
        await savePushSubscriptionDB(user.id, user.role, sub.toJSON(), deviceType());
      }
    } catch (e) {
      console.error('enablePush:', e);
    }
    setPushBusy(false);
  }

  if (!user) return null;

  const bellColor = light ? '#FFFFFF' : '#1A1A1A';

  return (
    <div className="relative">
      <button onClick={handleOpen} aria-label="Notifications"
        className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-all active:scale-95"
        style={{ backgroundColor: open ? '#C9A84C18' : 'transparent', color: bellColor }}>
        <Icon name="bell" size={19} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
            style={{ backgroundColor: '#E5484D', color: '#FFFFFF' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`fixed sm:absolute top-16 sm:top-12 z-50 w-[360px] max-w-[92vw] rounded-2xl border shadow-2xl overflow-hidden ${align === 'left' ? 'left-2 sm:left-0' : 'right-2 sm:right-0'}`}
            style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
            {/* En-tête du panneau */}
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#F2EFE9' }}>
              <span className="text-sm font-bold" style={{ color: '#1A1A1A' }}>Notifications</span>
              {unread > 0 && (
                <button onClick={markAll} className="text-xs font-medium" style={{ color: '#C9A84C' }}>Tout marquer comme lu</button>
              )}
            </div>

            {/* Activation push */}
            {permission !== 'granted' && (
              <button onClick={enablePush} disabled={pushBusy}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-left border-b transition-colors"
                style={{ borderColor: '#F2EFE9', backgroundColor: '#FAF8F3' }}>
                <span style={{ color: '#C9A84C' }} className="flex items-center shrink-0"><Icon name="bell" size={16} /></span>
                <span className="text-xs font-medium" style={{ color: '#7A7068' }}>
                  {pushBusy ? 'Activation…' : permission === 'denied'
                    ? 'Notifications bloquées — autorisez-les dans les réglages du navigateur'
                    : 'Activer les notifications sur cet appareil'}
                </span>
              </button>
            )}

            {/* Liste */}
            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-4 py-10 flex flex-col items-center text-center">
                  <span className="mb-2" style={{ color: '#D4CEC4' }}><Icon name="bell" size={26} /></span>
                  <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune notification</p>
                </div>
              ) : (
                items.map(n => (
                  <button key={n.id} onClick={() => openNotif(n)}
                    className="w-full text-left flex gap-3 px-4 py-3 border-b transition-colors hover:brightness-95"
                    style={{ borderColor: '#F4F1EB', backgroundColor: n.read ? '#FFFFFF' : '#FBF7EC' }}>
                    <span className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>
                      <Icon name={TYPE_ICON[n.type] ?? 'bell'} size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{n.title}</p>
                        {!n.read && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#C9A84C' }} />}
                      </div>
                      <p className="text-xs mt-0.5 leading-snug" style={{ color: '#7A7068' }}>{n.message}</p>
                      <p className="text-[11px] mt-1" style={{ color: '#B0A795' }}>{timeAgo(n.createdAt)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
