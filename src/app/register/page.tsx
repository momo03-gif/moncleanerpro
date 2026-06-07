'use client';

import { useRouter } from 'next/navigation';

const OPTIONS = [
  {
    type: 'hotel',
    icon: '◫',
    title: 'Hôtel',
    desc: 'Résidence ou hôtel — déposez vos demandes de ménage.',
    href: '/register/hotel',
  },
  {
    type: 'airbnb',
    icon: '⬡',
    title: 'Airbnb / Conciergerie',
    desc: 'Gérez vos appartements et créez vos missions de nettoyage.',
    href: '/register/airbnb',
  },
];

export default function RegisterChoicePage() {
  const router = useRouter();

  return (
    <div className="login-page min-h-screen flex items-center justify-center py-10" style={{ backgroundColor: '#0D0D0D' }}>
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <span className="text-3xl font-bold" style={{ color: '#C9A84C' }}>✦</span>
          <h1 className="text-xl font-bold mt-2 tracking-wide" style={{ color: '#F5F5F5' }}>Créer un compte partenaire</h1>
          <p className="text-sm mt-1" style={{ color: '#5A5550' }}>Quel type de partenaire êtes-vous ?</p>
        </div>

        <div className="space-y-3">
          {OPTIONS.map(o => (
            <button key={o.type} onClick={() => router.push(o.href)}
              className="w-full text-left rounded-2xl p-5 border transition-all"
              style={{ backgroundColor: '#141414', borderColor: '#242424' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#C9A84C')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#242424')}>
              <div className="flex items-center gap-4">
                <span className="text-2xl">{o.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#F5F5F5' }}>{o.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#6A6058' }}>{o.desc}</p>
                </div>
                <span className="text-lg" style={{ color: '#C9A84C' }}>→</span>
              </div>
            </button>
          ))}
        </div>

        <button onClick={() => router.push('/login')} className="w-full mt-6 py-2.5 text-sm" style={{ color: '#4A4540' }}>
          ← Retour à la connexion
        </button>
      </div>
    </div>
  );
}
