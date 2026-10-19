'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from '@/components/NotificationBell';
import Icon, { type IconName } from '@/components/Icon';
import Logo from '@/components/Logo';

const navItems: { href: string; label: string; icon: IconName }[] = [
  { href: '/cleaner', label: "Aujourd'hui", icon: 'today' },
  { href: '/cleaner/proposees', label: 'Proposées', icon: 'inbox' },
  { href: '/cleaner/formation', label: 'Formation', icon: 'play' },
  { href: '/cleaner/profil', label: 'Profil', icon: 'user' },
];

export default function CleanerNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  // Des actions (photos, fin de ménage…) attendent encore le réseau : on tente
  // de les envoyer ; s'il en reste, le cleaner décide — sinon elles seraient
  // perdues en silence.
  async function handleLogout() {
    try {
      const { syncQueue, queueSummary } = await import('@/lib/offline/queue');
      await syncQueue();
      const { pending } = await queueSummary();
      if (pending > 0) {
        const ok = window.confirm(`${pending} action${pending > 1 ? 's' : ''} (photos, fin de ménage…) n'${pending > 1 ? 'ont' : 'a'} pas encore pu être envoyée${pending > 1 ? 's' : ''}, faute de réseau.\n\nSi vous vous déconnectez maintenant, elle${pending > 1 ? 's seront perdues' : ' sera perdue'}. Se déconnecter quand même ?`);
        if (!ok) return;
      }
      const { effacerDonneesHorsLigne } = await import('@/lib/offline/store');
      await effacerDonneesHorsLigne({ file: true });
    } catch { /* best-effort */ }
    await logout();
    router.push('/login');
  }

  return (
    <>
      {/* Top bar */}
      <header className="flex items-center justify-between px-5 py-4 border-b sticky top-0 z-20" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
        <Logo size={28} />
        <div className="flex items-center gap-2">
          <NotificationBell />
          <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{user?.name?.split(' ')[0]}</span>
          <button onClick={handleLogout} aria-label="Déconnexion"
            className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>
            <Icon name="logout" size={18} />
          </button>
        </div>
      </header>

      {/* Bottom nav — grande pour les doigts */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex border-t" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {navItems.filter(item => !(user?.agent && item.href === '/cleaner/proposees')).map(item => {
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
