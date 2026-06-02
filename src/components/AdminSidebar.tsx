'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: '/admin', label: 'Tableau de bord', icon: '◈' },
  { href: '/admin/missions', label: 'Missions', icon: '◎' },
  { href: '/admin/cleaners', label: 'Cleaners', icon: '◉' },
  { href: '/admin/airbnb', label: 'Airbnb', icon: '⬡' },
  { href: '/admin/stats', label: 'Statistiques', icon: '◈' },
  { href: '/admin/comptabilite', label: 'Comptabilité', icon: '◇' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 min-h-screen border-r" style={{ backgroundColor: '#FAFAF8', borderColor: '#E5E3DE' }}>
        {/* Logo */}
        <div className="px-6 py-6 border-b" style={{ borderColor: '#E5E3DE' }}>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold" style={{ color: '#C9A84C' }}>✦</span>
            <span className="font-bold text-base" style={{ color: '#1A1A1A' }}>MonCleanerPro</span>
          </div>
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>Administration</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(item => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  backgroundColor: isActive ? '#C9A84C' : 'transparent',
                  color: isActive ? '#1A1A1A' : '#6B7280',
                }}
              >
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User + logout */}
        <div className="px-3 py-4 border-t" style={{ borderColor: '#E5E3DE' }}>
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{user?.name}</p>
            <p className="text-xs" style={{ color: '#9CA3AF' }}>{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all"
            style={{ color: '#6B7280' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#F3F3F0')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <span>↩</span> Déconnexion
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 border-b sticky top-0 z-10" style={{ backgroundColor: '#FAFAF8', borderColor: '#E5E3DE' }}>
        <div className="flex items-center gap-2">
          <span style={{ color: '#C9A84C' }}>✦</span>
          <span className="font-bold text-sm">MonCleanerPro</span>
        </div>
        <button onClick={handleLogout} className="text-sm" style={{ color: '#6B7280' }}>↩</button>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-10 flex border-t" style={{ backgroundColor: '#FAFAF8', borderColor: '#E5E3DE' }}>
        {navItems.slice(0, 5).map(item => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center py-2 text-xs gap-1"
              style={{ color: isActive ? '#C9A84C' : '#9CA3AF' }}
            >
              <span className="text-base">{item.icon}</span>
              <span className="text-[10px]">{item.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
