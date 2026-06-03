'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role } from '@/lib/types';
import { loginUser } from '@/lib/db';

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: async () => null,
  logout: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('mcp_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { localStorage.removeItem('mcp_user'); }
    }
    setIsLoading(false);
  }, []);

  async function login(email: string, password: string): Promise<User | null> {
    const found = await loginUser(email, password);
    if (found) {
      const safe = { ...found, password: '' };
      localStorage.setItem('mcp_user', JSON.stringify(safe));
      setUser(safe);
    }
    return found;
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

export function useAuth() { return useContext(AuthContext); }

export function redirectPathForRole(role: Role): string {
  return role === 'admin' ? '/admin' : role === 'cleaner' ? '/cleaner' : '/hotel';
}
