'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from '@/components/NotificationBell';

const navItems = [
  { href: '/admin', label: 'Tableau de bord', icon: '◈' },
  { href: '/admin/missions', label: 'Missions', icon: '◎' },
  { href: '/admin/cleaners', label: 'Cleaners', icon: '◉' },
  { href: '/admin/airbnb', label: 'Airbnb', icon: '⬡' },
  { href: '/admin/comptes', label: 'Comptes', icon: '◻' },
  { href: '/admin/facturation', label: 'Facturation', icon: '▤' },
  { href: '/admin/stats', label: 'Statistiques', icon: '◈' },
  { href: '/admin/comptabilite', label: 'Comptabilité', icon: '◇' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Ferme le menu lors d'un changement de route
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Empêche le scroll du body quand menu ouvert
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  function handleLogout() {
    logout();
    router.push('/login');
  }

  const NavLink = ({ item }: { item: typeof navItems[0] }) => {
    const isActive = pathname === item.href;
    return (
      <Link
        href={item.href}
        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-medium transition-all active:scale-95"
        style={{
          backgroundColor: isActive ? '#C9A84C' : 'transparent',
          color: isActive ? '#1A1A1A' : '#7A7068',
          minHeight: '48px',
        }}
      >
        <span className="text-lg w-6 text-center">{item.icon}</span>
        {item.label}
      </Link>
    );
  };

  return (
    <>
      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex flex-col w-64 min-h-screen border-r shrink-0" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
        <div className="px-6 py-6 border-b" style={{ borderColor: '#E8E4DC' }}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold" style={{ color: '#C9A84C' }}>✦</span>
              <span className="font-bold text-base" style={{ color: '#1A1A1A' }}>MonCleanerPro</span>
            </div>
            <NotificationBell />
          </div>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Administration</p>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {navItems.map(item => <NavLink key={item.href} item={item} />)}
        </nav>

        <div className="px-3 py-4 border-t" style={{ borderColor: '#E8E4DC' }}>
          <div className="px-4 py-2 mb-1">
            <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{user?.name}</p>
            <p className="text-xs truncate" style={{ color: '#A8A09A' }}>{user?.email}</p>
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition-all" style={{ color: '#7A7068' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F5F3EF')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
            <span>↩</span> Déconnexion
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 border-b" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC', height: '60px' }}>
        <div className="flex items-center gap-2">
          <span style={{ color: '#C9A84C' }}>✦</span>
          <span className="font-bold text-sm" style={{ color: '#1A1A1A' }}>MonCleanerPro</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell />
          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen(o => !o)}
            className="w-10 h-10 flex items-center justify-center rounded-xl transition-all"
            style={{ backgroundColor: mobileOpen ? '#C9A84C12' : 'transparent' }}
            aria-label="Menu"
          >
            <div className="space-y-1.5">
              <span className="block w-5 h-0.5 rounded transition-all" style={{ backgroundColor: '#1A1A1A', transform: mobileOpen ? 'rotate(45deg) translate(2px, 2px)' : 'none' }} />
              <span className="block w-5 h-0.5 rounded transition-all" style={{ backgroundColor: '#1A1A1A', opacity: mobileOpen ? 0 : 1 }} />
              <span className="block w-5 h-0.5 rounded transition-all" style={{ backgroundColor: '#1A1A1A', transform: mobileOpen ? 'rotate(-45deg) translate(2px, -2px)' : 'none' }} />
            </div>
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
            <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
              {navItems.map(item => <NavLink key={item.href} item={item} />)}
            </nav>

            {/* Logout */}
            <div className="px-3 py-4 border-t" style={{ borderColor: '#E8E4DC' }}>
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-medium transition-all active:scale-95" style={{ color: '#B85A50', backgroundColor: '#B85A5008', minHeight: '48px' }}>
                <span>↩</span> Déconnexion
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
