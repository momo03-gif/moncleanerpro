'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, redirectPathForRole } from '@/contexts/AuthContext';

const inputDark = { backgroundColor: '#1A1A1A', border: '1px solid #2E2E2E', color: '#F5F5F5', outline: 'none' };

export default function LoginPage() {
  const { user, login, isLoading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && user) router.replace(redirectPathForRole(user.role));
  }, [user, isLoading, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const found = await login(email.trim().toLowerCase(), password);
    if (!found) {
      setError('Identifiants incorrects ou compte en attente de validation.');
    }
    setLoading(false);
  }

  return (
    <div className="login-page min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0D0D0D' }}>
      <div className="w-full max-w-sm px-6">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="text-3xl font-bold" style={{ color: '#C9A84C' }}>✦</span>
            <h1 className="text-2xl font-bold tracking-wide" style={{ color: '#F5F5F5' }}>MonCleanerPro</h1>
          </div>
          <p className="text-sm mt-1" style={{ color: '#5A5550' }}>Plateforme professionnelle de nettoyage</p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl p-8" style={{ backgroundColor: '#141414', border: '1px solid #242424' }}>
          <h2 className="text-lg font-semibold mb-6" style={{ color: '#F5F5F5' }}>Connexion</h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#6A6058' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="votre@email.com" className="w-full px-4 py-3 rounded-xl text-sm transition-all"
                style={inputDark}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
                onBlur={e => (e.currentTarget.style.borderColor = '#2E2E2E')} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#6A6058' }}>Mot de passe</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••" className="w-full px-4 py-3 rounded-xl text-sm transition-all"
                style={inputDark}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
                onBlur={e => (e.currentTarget.style.borderColor = '#2E2E2E')} />
            </div>

            {error && (
              <p className="text-xs text-center py-2 px-3 rounded-lg" style={{ backgroundColor: '#3A1A1A', color: '#F87171' }}>{error}</p>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all mt-2 disabled:opacity-50"
              style={{ backgroundColor: '#C9A84C', color: '#0D0D0D' }}
              onMouseEnter={e => !loading && (e.currentTarget.style.backgroundColor = '#D4B86A')}
              onMouseLeave={e => !loading && (e.currentTarget.style.backgroundColor = '#C9A84C')}>
              {loading ? 'Connexion...' : 'Se connecter'}
            </button>
          </form>
        </div>

        {/* Register hotel CTA */}
        <div className="mt-4">
          <button onClick={() => router.push('/register')}
            className="w-full py-3 rounded-xl text-sm font-medium border transition-all"
            style={{ borderColor: '#2E2E2E', color: '#C9A84C', backgroundColor: 'transparent' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#C9A84C'; e.currentTarget.style.backgroundColor = '#C9A84C10'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2E2E2E'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
            Créer un compte partenaire
          </button>
        </div>

      </div>
    </div>
  );
}
