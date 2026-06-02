'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import CleanerNav from '@/components/CleanerNav';

export default function CleanerLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'cleaner') { router.replace('/login'); }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== 'cleaner') return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <CleanerNav />
      <main className="pb-24 max-w-lg mx-auto">
        {children}
      </main>
    </div>
  );
}
