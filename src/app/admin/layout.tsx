'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AdminSidebar from '@/components/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'admin') { router.replace('/login'); }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== 'admin') return null;

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: '#FAFAF8' }}>
      <AdminSidebar />
      <main className="flex-1 overflow-x-hidden pb-4 md:pb-0">
        {children}
      </main>
    </div>
  );
}
