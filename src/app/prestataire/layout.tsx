'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import PrestataireNav from '@/components/PrestataireNav';

export default function PrestataireLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'prestataire') { router.replace('/login'); }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== 'prestataire') return null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <PrestataireNav />
      <main className="pb-24 max-w-2xl mx-auto">
        {children}
      </main>
    </div>
  );
}
