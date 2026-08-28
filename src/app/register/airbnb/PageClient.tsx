'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { registerAirbnbPartnerDB } from '@/lib/db';
import Logo from '@/components/Logo';
import Icon from '@/components/Icon';

const inputDark = { backgroundColor: '#1A1A1A', border: '1px solid #2E2E2E', color: '#F5F5F5', outline: 'none' };

export default function RegisterAirbnbPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (form.password.length < 6) { setError('Mot de passe minimum 6 caractères.'); return; }

    setLoading(true);
    try {
      await registerAirbnbPartnerDB({ name: form.name, email: form.email, phone: form.phone, password: form.password });
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? 'Une erreur est survenue.');
    }
    setLoading(false);
  }

  if (done) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0D0D0D' }}>
      <div className="w-full max-w-sm px-6 text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>
          <Icon name="check" size={24} />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: '#F5F5F5' }}>Demande envoyée</h2>
        <p className="text-sm mb-6" style={{ color: '#6A6058' }}>Votre compte est en attente de validation. Vous serez notifié une fois activé.</p>
        <button onClick={() => router.push('/login')} className="px-6 py-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#0D0D0D' }}>
          Retour à la connexion
        </button>
      </div>
    </div>
  );

  return (
    <div className="login-page min-h-screen flex items-center justify-center py-10" style={{ backgroundColor: '#0D0D0D' }}>
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3"><Logo size={36} tone="dark" showWordmark={false} /></div>
          <h1 className="text-xl font-bold tracking-wide" style={{ color: '#F5F5F5' }}>Compte Airbnb / Conciergerie</h1>
          <p className="text-sm mt-1" style={{ color: '#5A5550' }}>Votre compte sera activé après validation</p>
        </div>

        <div className="rounded-2xl p-8" style={{ backgroundColor: '#141414', border: '1px solid #242424' }}>
          <form onSubmit={handleSubmit} className="space-y-3">
            {[
              { label: 'Nom du partenaire / conciergerie', key: 'name', type: 'text', placeholder: 'Hosting Services Lyon', required: true },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'contact@conciergerie.com', required: true },
              { label: 'Téléphone', key: 'phone', type: 'tel', placeholder: '06 12 34 56 78', required: true },
              { label: 'Mot de passe', key: 'password', type: 'password', placeholder: '••••••••', required: true },
              { label: 'Confirmer', key: 'confirm', type: 'password', placeholder: '••••••••', required: true },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: '#6A6058' }}>{f.label}</label>
                <input required={f.required} type={f.type} value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-4 py-2.5 rounded-xl text-sm transition-all" style={inputDark}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#2E2E2E')} />
              </div>
            ))}

            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#1A1A1A', color: '#6A6058' }}>
              Pas besoin d'adresse fixe : vous ajouterez vos appartements (à plusieurs adresses) une fois connecté.
            </p>

            {error && <p className="text-xs text-center py-2 px-3 rounded-lg" style={{ backgroundColor: '#3A1A1A', color: '#F87171' }}>{error}</p>}

            <button type="submit" disabled={loading} className="w-full py-3.5 rounded-xl font-semibold text-sm mt-2 disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#0D0D0D' }}>
              {loading ? 'Envoi...' : 'Envoyer la demande'}
            </button>
          </form>
        </div>

        <button onClick={() => router.push('/register')} className="w-full mt-4 py-2.5 text-sm" style={{ color: '#4A4540' }}>
          ← Choisir un autre type
        </button>
      </div>
    </div>
  );
}
