'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from '@/components/NotificationBell';
import Icon, { type IconName } from '@/components/Icon';
import Logo from '@/components/Logo';
import { DEVIS_PENDING_EVENT } from '@/lib/events';
import { alertUser } from '@/lib/alert';

// ── Navigation groupée par MOMENT D'USAGE ─────────────────────────────────────
//
// Seize entrées à plat, on ne trouvait plus rien. Le classement suit ce qu'on
// vient faire, pas la parenté technique des écrans :
//
//   Au quotidien — ce qu'on ouvre chaque matin
//   Clients      — le cycle complet, du prospect au logement entretenu
//   Équipe       — les intervenants et ce qui les encadre
//   Gestion      — l'argent et les chiffres, consultés par périodes
//
// Ajouter un écran : le placer dans le groupe correspondant à SON MOMENT, pas
// à sa proximité de code.
interface NavItem { href: string; label: string; icon: IconName; badge?: 'devis' }
interface NavGroup { title: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    title: 'Au quotidien',
    items: [
      { href: '/admin', label: 'Tableau de bord', icon: 'dashboard' },
      { href: '/admin/missions', label: 'Missions', icon: 'missions' },
      { href: '/admin/rendez-vous', label: 'Rendez-vous', icon: 'today' },
      { href: '/admin/carte', label: 'Carte des tournées', icon: 'map' },
    ],
  },
  {
    // L'ordre suit le cycle de vie : on est prospect avant d'être partenaire,
    // partenaire avant d'avoir des sites, et les réservations arrivent ensuite.
    title: 'Clients',
    items: [
      { href: '/admin/prospects', label: 'Prospects', icon: 'request' },
      { href: '/admin/comptes', label: 'Partenaires', icon: 'accounts' },
      { href: '/admin/airbnb', label: 'Sites', icon: 'building' },
      { href: '/admin/reservations', label: 'Réservations', icon: 'sync' },
    ],
  },
  {
    title: 'Équipe',
    items: [
      { href: '/admin/cleaners', label: 'Cleaners', icon: 'cleaners' },
      { href: '/admin/rh', label: 'Règles RH', icon: 'award' },
      { href: '/admin/formation', label: 'Formation', icon: 'book' },
    ],
  },
  {
    title: 'Gestion',
    items: [
      // Les devis ont leur propre écran : ils vivent avant la facture (demande →
      // chiffrage → envoi → acceptation), et leurs demandes entrantes s'affichent
      // ici en pastille plutôt que dans la cloche générale.
      { href: '/admin/devis', label: 'Devis', icon: 'request', badge: 'devis' },
      { href: '/admin/facturation', label: 'Facturation', icon: 'invoice' },
      { href: '/admin/tarification', label: 'Tarification', icon: 'invoice' },
      { href: '/admin/comptabilite', label: 'Comptabilité', icon: 'wallet' },
      { href: '/admin/parking', label: 'Parking', icon: 'parking' },
      { href: '/admin/stats', label: 'Statistiques', icon: 'stats' },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Demandes de devis en attente → pastille sur l'entrée « Devis ». Chargée en
  // DIFFÉRÉ (comme la cloche) pour garder supabase hors du chemin critique, et
  // rafraîchie à chaque changement de page : traiter une demande la fait retomber.
  const [devisPending, setDevisPending] = useState(0);

  // Ferme le menu lors d'un changement de route
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    let alive = true;
    import('@/lib/devis')
      .then(({ getDevisPendingCountDB }) => getDevisPendingCountDB())
      .then(n => { if (alive) setDevisPending(n); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.role, pathname]);

  // L'écran Devis annonce lui-même sa file d'attente : une demande traitée fait
  // retomber la pastille tout de suite, sans attendre un changement de page.
  useEffect(() => {
    const onChange = (e: Event) => setDevisPending(Number((e as CustomEvent).detail) || 0);
    window.addEventListener(DEVIS_PENDING_EVENT, onChange);
    return () => window.removeEventListener(DEVIS_PENDING_EVENT, onChange);
  }, []);

  // TEMPS RÉEL, comme la cloche : une nouvelle demande de devis fait monter le
  // compteur sur l'entrée du menu sans recharger la page, avec le même signal
  // sonore. On écoute la table `notifications` (déjà publiée en temps réel) et on
  // ne réagit qu'aux demandes de devis — inutile de publier une table de plus.
  useEffect(() => {
    if (user?.role !== 'admin' || !user.id) return;
    const userId = user.id;
    let cleanup = () => {};
    (async () => {
      try {
        const [{ supabase }, { getDevisPendingCountDB }] = await Promise.all([
          import('@/lib/supabase'), import('@/lib/devis'),
        ]);
        const ch = supabase
          .channel(`devis-pending-${userId}`)
          .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
            payload => {
              if ((payload.new as { type?: string })?.type !== 'devis_request') return;
              alertUser();
              getDevisPendingCountDB().then(setDevisPending).catch(() => {});
            })
          .subscribe();
        cleanup = () => { try { supabase.removeChannel(ch); } catch { /* ignore */ } };
      } catch (e) {
        console.error('devis pending realtime:', e);
      }
    })();
    return () => cleanup();
  }, [user?.role, user?.id]);

  // Empêche le scroll du body quand menu ouvert
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  const NavLink = ({ item }: { item: NavItem }) => {
    const isActive = pathname === item.href;
    const count = item.badge === 'devis' ? devisPending : 0;
    return (
      <Link
        href={item.href}
        className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all active:scale-[0.98]"
        style={{
          backgroundColor: isActive ? '#C9A84C' : 'transparent',
          color: isActive ? '#1A1A1A' : '#7A7068',
          minHeight: '44px',
        }}
      >
        <span className="w-5 flex items-center justify-center shrink-0"><Icon name={item.icon} /></span>
        {item.label}
        {count > 0 && (
          <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center"
            style={{ backgroundColor: isActive ? '#1A1A1A' : '#E5484D', color: '#FFFFFF' }}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="print-hidden hidden md:flex flex-col w-64 min-h-screen border-r shrink-0" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
        <div className="px-5 py-5 border-b" style={{ borderColor: '#E8E4DC' }}>
          <div className="flex items-center justify-between gap-2">
            <Logo subtitle="Administration" />
            <NotificationBell align="left" />
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {navGroups.map((group, i) => (
            <div key={group.title} className={i > 0 ? 'mt-5' : ''}>
              <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#A8A09A' }}>
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => <NavLink key={item.href} item={item} />)}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-3 py-4 border-t" style={{ borderColor: '#E8E4DC' }}>
          <div className="px-4 py-2 mb-1">
            <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{user?.name}</p>
            <p className="text-xs truncate" style={{ color: '#A8A09A' }}>{user?.email}</p>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all" style={{ color: '#7A7068' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F3EF')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
            <span className="w-5 flex items-center justify-center shrink-0"><Icon name="logout" /></span> Déconnexion
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ── */}
      <div className="print-hidden md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 border-b" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC', height: '60px' }}>
        <Logo size={28} />
        <div className="flex items-center gap-1">
          <NotificationBell />
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="w-10 h-10 flex items-center justify-center rounded-xl transition-all"
            style={{ backgroundColor: mobileOpen ? '#C9A84C12' : 'transparent', color: '#1A1A1A' }}
            aria-label="Menu"
          >
            <Icon name={mobileOpen ? 'close' : 'menu'} size={22} />
          </button>
        </div>
      </div>

      {/* ── MOBILE DRAWER OVERLAY ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex" style={{ top: '60px' }}>
          {/* Backdrop */}
          <div className="absolute inset-0" style={{ backgroundColor: 'rgba(26,26,26,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setMobileOpen(false)} />

          {/* Drawer */}
          <div className="relative w-72 max-w-[85vw] h-full flex flex-col shadow-2xl" style={{ backgroundColor: '#FAFAF8' }}>
            {/* User info */}
            <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: '#E8E4DC' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-base shrink-0" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>
                  {user?.name?.charAt(0)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{user?.name}</p>
                  <p className="text-xs truncate" style={{ color: '#A8A09A' }}>{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 py-3 overflow-y-auto">
              {navGroups.map((group, i) => (
                <div key={group.title} className={i > 0 ? 'mt-5' : ''}>
                  <p className="px-4 mb-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#A8A09A' }}>
                    {group.title}
                  </p>
                  <div className="space-y-0.5">
                    {group.items.map(item => <NavLink key={item.href} item={item} />)}
                  </div>
                </div>
              ))}
            </nav>

            {/* Logout */}
            <div className="px-3 py-4 border-t" style={{ borderColor: '#E8E4DC' }}>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-all active:scale-[0.98]" style={{ color: '#B85A50', backgroundColor: '#B85A5008', minHeight: '48px' }}>
                <span className="w-5 flex items-center justify-center shrink-0"><Icon name="logout" /></span> Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
