'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: '/cleaner', label: 'Aujourd\'hui', icon: '◈' },
  { href: '/cleaner/proposees', label: 'Proposées', icon: '◎' },
  { href: '/cleaner/profil', label: 'Profil', icon: '◉' },
];

export default function CleanerNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <>
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-10" style={{ backgroundColor: '#FAFAF8', borderColor: '#E5E3DE' }}>
        <div className="flex items-center gap-2">
          <span style={{ color: '#C9A84C' }}>✦</span>
          <span className="font-bold text-sm" style={{ color: '#1A1A1A' }}>MonCleanerPro</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{user?.name?.split(' ')[0]}</span>
          <button onClick={handleLogout} className="text-xs px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#F3F3F0', color: '#6B7280' }}>
            Sortir
          </button>
        </div>
      </header>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-10 flex border-t" style={{ backgroundColor: '#FAFAF8', borderColor: '#E5E3DE' }}>
        {navItems.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center py-3 gap-1 transition-all"
              style={{ color: isActive ? '#C9A84C' : '#9CA3AF' }}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
