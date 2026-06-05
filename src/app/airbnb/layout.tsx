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
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <AirbnbNav />
      <main className="pb-24 max-w-lg mx-auto">
        {children}
      </main>
    </div>
  );
}
