'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: () => {},
  logout: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('mcp_user');
    if (stored) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem('mcp_user');
      }
    }
    setIsLoading(false);
  }, []);

  function login(u: User) {
    const { password: _, ...safeUser } = u as User & { password?: string };
    localStorage.setItem('mcp_user', JSON.stringify(safeUser));
    setUser(safeUser as User);
  }

  function logout() {
    localStorage.removeItem('mcp_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function redirectPathForRole(role: Role): string {
  switch (role) {
    case 'admin': return '/admin';
    case 'cleaner': return '/cleaner';
    case 'hotel': return '/hotel';
  }
}
