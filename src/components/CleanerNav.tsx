'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const navItems = [
  { href: '/cleaner', label: "Aujourd'hui", icon: '◈' },
  { href: '/cleaner/proposees', label: 'Proposées', icon: '◎' },
  { href: '/cleaner/profil', label: 'Profil', icon: '◉' },
];

export default function CleanerNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  function handleLogout() { logout(); router.push('/login'); }

  return (
    <>
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-20" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
        <div className="flex items-center gap-2">
          <span className="text-lg" style={{ color: '#C9A84C' }}>✦</span>
          <span className="font-bold text-sm" style={{ color: '#1A1A1A' }}>MonCleanerPro</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{user?.name?.split(' ')[0]}</span>
          <button onClick={handleLogout} className="text-xs px-3 py-2 rounded-xl min-h-[36px]" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>
            Sortir
          </button>
        </div>
      </header>

      {/* Bottom nav — grande pour les doigts */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {navItems.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
              style={{ color: isActive ? '#C9A84C' : '#A8A09A', minHeight: '60px', padding: '10px 0' }}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
