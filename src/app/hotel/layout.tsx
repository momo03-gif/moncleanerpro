'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import HotelNav from '@/components/HotelNav';

export default function HotelLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'hotel') { router.replace('/login'); }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== 'hotel') return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <HotelNav />
      <main className="pb-24 max-w-lg mx-auto">
        {children}
      </main>
    </div>
  );
}
