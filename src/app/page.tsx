'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, redirectPathForRole } from '@/contexts/AuthContext';

export default function HomePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (user) {
      router.replace(redirectPathForRole(user.role));
    } else {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  return null;
}
