'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import Icon from '@/components/Icon';
import { SPECIALITES } from '@/lib/prestataireRegles';

// Inscription PUBLIQUE d'un prestataire (sous-traitant). Le compte reste en
// attente : l'admin le valide et fixe alors le taux horaire.

const inputDark = { backgroundColor: '#1A1A1A', border: '1px solid #2E2E2E', color: '#F5F5F5', outline: 'none' };

const CHAMPS: { label: string; key: keyof typeof VIDE; type: string; placeholder: string; required: boolean }[] = [
  { label: 'Nom ou raison sociale', key: 'name', type: 'text', placeholder: 'Votre entreprise ou votre nom', required: true },
  { label: 'Nom du contact', key: 'contactName', type: 'text', placeholder: 'Prénom Nom', required: true },
  { label: 'Email', key: 'email', type: 'email', placeholder: 'contact@entreprise.fr', required: true },
  { label: 'Téléphone', key: 'phone', type: 'tel', placeholder: '06 12 34 56 78', required: true },
  { label: 'SIRET', key: 'siret', type: 'text', placeholder: '14 chiffres', required: true },
  { label: 'Mot de passe', key: 'password', type: 'password', placeholder: '••••••••', required: true },
  { label: 'Confirmer', key: 'confirm', type: 'password', placeholder: '••••••••', required: true },
];
const VIDE = { name: '', contactName: '', email: '', phone: '', siret: '', password: '', confirm: '' };

export default function RegisterPrestatairePage() {
  const router = useRouter();
  const [form, setForm] = useState(VIDE);
  const [specialites, setSpecialites] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (form.password.length < 6) { setError('Mot de passe minimum 6 caractères.'); return; }
    if (form.siret.replace(/\s/g, '').length !== 14) { setError('Le SIRET compte 14 chiffres.'); return; }
    if (!specialites.length) { setError('Choisissez au moins une spécialité.'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'prestataire', name: form.name.trim(), contactName: form.contactName.trim(),
          email: form.email, phone: form.phone.trim(), siret: form.siret.replace(/\s/g, ''), specialites, password: form.password,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setError(data.error ?? 'Une erreur est survenue.');
      else setDone(true);
    } catch {
      setError('Connexion impossible. Réessayez.');
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
        <p className="text-sm mb-6" style={{ color: '#6A6058' }}>
          Nous étudions votre demande et revenons vers vous rapidement. Vous pourrez vous connecter dès que votre compte sera validé.
        </p>
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
          <h1 className="text-xl font-bold tracking-wide" style={{ color: '#F5F5F5' }}>Prestataire / indépendant</h1>
          <p className="text-sm mt-1" style={{ color: '#5A5550' }}>Votre compte sera activé après validation</p>
        </div>

        <div className="rounded-2xl p-8" style={{ backgroundColor: '#141414', border: '1px solid #242424' }}>
          <form onSubmit={handleSubmit} className="space-y-3">
            {CHAMPS.map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: '#6A6058' }}>{f.label}</label>
                <input required={f.required} type={f.type} value={form[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full px-4 py-2.5 rounded-xl text-sm transition-all" style={inputDark}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
                  onBlur={e => (e.currentTarget.style.borderColor = '#2E2E2E')} />
              </div>
            ))}

            <div>
              <p className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: '#6A6058' }}>Vos spécialités</p>
              <div className="flex flex-wrap gap-2">
                {SPECIALITES.map(sp => {
                  const choisi = specialites.includes(sp.key);
                  return (
                    <button key={sp.key} type="button" aria-pressed={choisi}
                      onClick={() => setSpecialites(l => (choisi ? l.filter(k => k !== sp.key) : [...l, sp.key]))}
                      className="px-3 py-1.5 rounded-full text-xs transition-all"
                      style={choisi
                        ? { backgroundColor: '#C9A84C', color: '#0D0D0D', border: '1px solid #C9A84C' }
                        : { backgroundColor: '#1A1A1A', color: '#A8A09A', border: '1px solid #2E2E2E' }}>
                      {sp.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#1A1A1A', color: '#6A6058' }}>
              Une fois votre compte validé, nous vous confions des prestations. Si vous avez une équipe, vous ajoutez vos agents : chacun reçoit ses identifiants pour l’application terrain.
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
