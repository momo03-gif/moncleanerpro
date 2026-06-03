'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, redirectPathForRole } from '@/contexts/AuthContext';
import { findUser, registerHotel } from '@/lib/mockData';

const inputDark = {
  backgroundColor: '#1A1A1A',
  border: '1px solid #2E2E2E',
  color: '#F5F5F5',
  outline: 'none',
};

const inputLight = {
  backgroundColor: '#F8F6F2',
  border: '1px solid #2E2E2E',
  color: '#F5F5F5',
  outline: 'none',
};

export default function LoginPage() {
  const { user, login, isLoading } = useAuth();
  const router = useRouter();

  const [view, setView] = useState<'login' | 'register'>('login');

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Register state
  const [reg, setReg] = useState({ name: '', address: '', email: '', phone: '', password: '', confirm: '' });
  const [regError, setRegError] = useState('');
  const [regDone, setRegDone] = useState(false);

  useEffect(() => {
    if (!isLoading && user) router.replace(redirectPathForRole(user.role));
  }, [user, isLoading, router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    const found = findUser(email.trim().toLowerCase(), password);
    if (found) {
      login(found);
      router.replace(redirectPathForRole(found.role));
    } else {
      // Check if it's a pending/refused account
      setError('Email ou mot de passe incorrect, ou compte en attente de validation.');
    }
    setLoading(false);
  }

  function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError('');
    if (reg.password !== reg.confirm) { setRegError('Les mots de passe ne correspondent pas.'); return; }
    if (reg.password.length < 6) { setRegError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    registerHotel({ name: reg.name, address: reg.address, email: reg.email.trim().toLowerCase(), phone: reg.phone, password: reg.password });
    setRegDone(true);
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

        {/* ── LOGIN VIEW ── */}
        {view === 'login' && (
          <>
            <div className="rounded-2xl p-8" style={{ backgroundColor: '#141414', border: '1px solid #242424' }}>
              <h2 className="text-lg font-semibold mb-6" style={{ color: '#F5F5F5' }}>Connexion</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#6A6058' }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="votre@email.com"
                    className="w-full px-4 py-3 rounded-xl text-sm transition-all" style={inputDark}
                    onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#2E2E2E')} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#6A6058' }}>Mot de passe</label>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl text-sm transition-all" style={inputDark}
                    onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#2E2E2E')} />
                </div>
                {error && <p className="text-xs text-center py-2 px-3 rounded-lg" style={{ backgroundColor: '#3A1A1A', color: '#F87171' }}>{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all mt-2 disabled:opacity-50"
                  style={{ backgroundColor: '#C9A84C', color: '#0D0D0D' }}
                  onMouseEnter={e => !loading && (e.currentTarget.style.backgroundColor = '#D4B86A')}
                  onMouseLeave={e => !loading && (e.currentTarget.style.backgroundColor = '#C9A84C')}>
                  {loading ? 'Connexion...' : 'Se connecter'}
                </button>
              </form>
            </div>

            {/* Demo buttons */}
            <div className="mt-4 space-y-2">
              <p className="text-xs text-center" style={{ color: '#3A3530' }}>Comptes de démonstration</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Admin', email: 'admin@moncleanerpro.com', pass: 'admin123' },
                  { label: 'Cleaner', email: 'sophie@cleaner.com', pass: 'cleaner123' },
                  { label: 'Hôtel', email: 'contact@lumiere.com', pass: 'hotel123' },
                ].map(d => (
                  <button key={d.label} onClick={() => { setEmail(d.email); setPassword(d.pass); }}
                    className="px-2 py-2.5 rounded-xl text-xs font-medium transition-all"
                    style={{ backgroundColor: '#161616', border: '1px solid #242424', color: '#6A6058' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#C9A84C50'; e.currentTarget.style.color = '#C9A84C'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#242424'; e.currentTarget.style.color = '#6A6058'; }}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Register CTA */}
            <div className="mt-6">
              <button onClick={() => setView('register')}
                className="w-full py-3 rounded-xl text-sm font-medium border transition-all"
                style={{ borderColor: '#2E2E2E', color: '#C9A84C', backgroundColor: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#C9A84C'; e.currentTarget.style.backgroundColor = '#C9A84C10'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2E2E2E'; e.currentTarget.style.backgroundColor = 'transparent'; }}>
                Créer un compte partenaire hôtel
              </button>
            </div>
          </>
        )}

        {/* ── REGISTER VIEW ── */}
        {view === 'register' && (
          <>
            {regDone ? (
              <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: '#141414', border: '1px solid #242424' }}>
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>
                  <span className="text-xl">✦</span>
                </div>
                <h2 className="text-lg font-semibold mb-2" style={{ color: '#F5F5F5' }}>Demande envoyée</h2>
                <p className="text-sm mb-6" style={{ color: '#6A6058' }}>
                  Votre compte est en attente de validation par notre équipe. Vous recevrez une confirmation sous 24h.
                </p>
                <button onClick={() => { setView('login'); setRegDone(false); setReg({ name: '', address: '', email: '', phone: '', password: '', confirm: '' }); }}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ backgroundColor: '#C9A84C', color: '#0D0D0D' }}>
                  Retour à la connexion
                </button>
              </div>
            ) : (
              <div className="rounded-2xl p-8" style={{ backgroundColor: '#141414', border: '1px solid #242424' }}>
                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => setView('login')} className="text-lg" style={{ color: '#6A6058' }}>←</button>
                  <h2 className="text-lg font-semibold" style={{ color: '#F5F5F5' }}>Compte partenaire hôtel</h2>
                </div>

                <form onSubmit={handleRegister} className="space-y-3">
                  {[
                    { label: "Nom de l'hôtel", key: 'name', type: 'text', placeholder: 'Hôtel Lumière', required: true },
                    { label: 'Adresse', key: 'address', type: 'text', placeholder: '15 Avenue Victor Hugo, Paris', required: true },
                    { label: 'Email', key: 'email', type: 'email', placeholder: 'contact@hotel.com', required: true },
                    { label: 'Téléphone', key: 'phone', type: 'tel', placeholder: '01 23 45 67 89', required: false },
                    { label: 'Mot de passe', key: 'password', type: 'password', placeholder: '••••••••', required: true },
                    { label: 'Confirmer le mot de passe', key: 'confirm', type: 'password', placeholder: '••••••••', required: true },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: '#6A6058' }}>{f.label}</label>
                      <input required={f.required} type={f.type} value={(reg as any)[f.key]}
                        onChange={e => setReg(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        className="w-full px-4 py-2.5 rounded-xl text-sm transition-all" style={inputDark}
                        onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
                        onBlur={e => (e.currentTarget.style.borderColor = '#2E2E2E')} />
                    </div>
                  ))}

                  {regError && <p className="text-xs text-center py-2 px-3 rounded-lg" style={{ backgroundColor: '#3A1A1A', color: '#F87171' }}>{regError}</p>}

                  <button type="submit" className="w-full py-3.5 rounded-xl font-semibold text-sm mt-2" style={{ backgroundColor: '#C9A84C', color: '#0D0D0D' }}>
                    Envoyer la demande
                  </button>
                  <p className="text-xs text-center" style={{ color: '#4A4540' }}>
                    Votre compte sera activé après validation par notre équipe
                  </p>
                </form>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
