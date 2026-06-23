'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from '@/components/NotificationBell';
import Icon, { type IconName } from '@/components/Icon';
import Logo from '@/components/Logo';

const navItems: { href: string; label: string; icon: IconName }[] = [
  { href: '/hotel', label: 'Demande', icon: 'request' },
  { href: '/hotel/historique', label: 'Historique', icon: 'history' },
];

export default function HotelNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() { await logout(); router.push('/login'); }

  return (
    <>
      <header className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-20" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
        <Logo size={28} />
        <div className="flex items-center gap-2">
          <NotificationBell />
          <span className="text-sm font-medium truncate max-w-24" style={{ color: '#1A1A1A' }}>{user?.name}</span>
          <button onClick={handleLogout} aria-label="Déconnexion"
            className="w-9 h-9 flex items-center justify-center rounded-xl shrink-0" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>
            <Icon name="logout" size={18} />
          </button>
        </div>
      </header>

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
              <Icon name={item.icon} size={22} />
              <span className="text-xs font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
