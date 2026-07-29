'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from '@/components/NotificationBell';
import Icon, { type IconName } from '@/components/Icon';
import Logo from '@/components/Logo';
import { IconButton } from '@/components/ui';

// `match` : quelles routes allument l'onglet. Une égalité stricte laissait la
// barre entièrement éteinte sur les pages de détail (`/airbnb/logement/<id>`,
// `/airbnb/mission/<id>`) — on ne savait plus où on se trouvait. On ne peut pas
// se contenter d'un préfixe non plus : `/airbnb` préfixe toutes les autres.
const navItems: { href: string; label: string; icon: IconName; match: (p: string) => boolean }[] = [
  { href: '/airbnb/accueil', label: 'Accueil', icon: 'today', match: p => p === '/airbnb/accueil' },
  { href: '/airbnb', label: 'Logements', icon: 'building', match: p => p === '/airbnb' || p.startsWith('/airbnb/logement') },
  { href: '/airbnb/missions', label: 'Planning', icon: 'missions', match: p => p.startsWith('/airbnb/mission') },
  { href: '/airbnb/reparations', label: 'Réparations', icon: 'wrench', match: p => p.startsWith('/airbnb/reparations') },
  { href: '/airbnb/sync', label: 'Synchro', icon: 'sync', match: p => p.startsWith('/airbnb/sync') },
];

export default function AirbnbNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() { await logout(); router.push('/login'); }

  return (
    <>
      {/* Hauteur fixée par `--header-h` : les titres de jour `sticky` s'y
          accrochent. Avant, ils utilisaient un `top-16` (64px) codé en dur,
          plus court que l'en-tête réel — ils passaient dessous au défilement. */}
      <header
        className="h-[var(--header-h)] flex items-center justify-between px-5 border-b sticky top-0 z-20 bg-cream border-line"
      >
        <Logo size={28} />
        <div className="flex items-center gap-2">
          <NotificationBell />
          <span className="text-sm font-medium truncate max-w-24 text-ink">{user?.name}</span>
          <IconButton icon="logout" label="Déconnexion" onClick={handleLogout} />
        </div>
      </header>

      <nav
        aria-label="Navigation principale"
        className="fixed bottom-0 left-0 right-0 z-20 flex border-t bg-cream border-line"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {navItems.map(item => {
          const isActive = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`relative flex-1 flex flex-col items-center justify-center gap-1 min-h-[60px] py-2.5 transition-all active:scale-95 ${
                isActive ? 'text-gold' : 'text-muted'
              }`}
            >
              {/* L'onglet actif se distinguait par la seule couleur (or sur gris) :
                  insuffisant pour un daltonisme, et discret sur petit écran.
                  Un liseré supérieur double l'information. */}
              <span
                aria-hidden="true"
                className={`absolute top-0 h-0.5 w-8 rounded-full ${isActive ? 'bg-gold' : 'bg-transparent'}`}
              />
              <Icon name={item.icon} size={22} />
              <span className="text-[11px] font-medium leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
