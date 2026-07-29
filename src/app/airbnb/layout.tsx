'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AirbnbNav from '@/components/AirbnbNav';

export default function AirbnbLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'airbnb') { router.replace('/login'); }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== 'airbnb') return null;

  return (
    <div className="min-h-screen bg-cream">
      <AirbnbNav />
      {/* Réserve la hauteur de la barre du bas *plus* la zone sûre (barre
          d'accueil iPhone) : le `pb-24` fixe laissait le dernier élément de
          liste sous la barre sur les écrans à encoche. */}
      <main className="max-w-lg mx-auto pb-[calc(6rem+env(safe-area-inset-bottom))]">
        {children}
      </main>
    </div>
  );
}
