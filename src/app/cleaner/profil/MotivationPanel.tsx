'use client';

import { useState, useEffect } from 'react';
import { computeBadges, type Badge, type Level } from '@/lib/badges';
import Icon from '@/components/Icon';

// ── Badges, niveau et classement sain (LOT 6). Aucun montant/prime affiché. ─────
// LOT 4 : les données RH (incidents) ne sont PLUS lues côté client. Tout est calculé
// par la route serveur /api/rh/cleaner-badges (service_role), qui ne renvoie que des
// éléments d'affichage non sensibles (badges, niveau, classement par missions).

export default function MotivationPanel({ userId, userName }: { userId: string; userName: string }) {
  const [badges, setBadges] = useState<Badge[]>([]);
  const [level, setLevel] = useState<Level | null>(null);
  const [rankText, setRankText] = useState('');
  const [podium, setPodium] = useState<{ name: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/rh/cleaner-badges', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const data = await res.json();
        setBadges(Array.isArray(data.badges) ? data.badges : computeBadges({ completedTotal: 0, morningCount: 0, incidentsThisMonth: 0, daysSinceLastIncident: 9999 }));
        setLevel(data.level ?? null);
        setPodium(Array.isArray(data.podium) ? data.podium : []);
        setRankText(data.rankText ?? '');
      } catch {
        setLevel(null);
      }
      setLoading(false);
    })();
  }, [userId]);

  if (loading || !level) return null;

  return (
    <div className="space-y-4 mb-4">
      {/* Niveau + progression */}
      <div className="rounded-2xl p-5 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold" style={{ color: '#1A1A1A' }}>Niveau</h3>
          <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ backgroundColor: `${level.color}18`, color: level.color }}>{level.name}</span>
        </div>
        <div className="h-2 rounded-full" style={{ backgroundColor: '#F2EFE9' }}>
          <div className="h-2 rounded-full transition-all" style={{ backgroundColor: level.color, width: `${Math.round(level.progress * 100)}%` }} />
        </div>
        <p className="text-xs mt-2" style={{ color: '#A8A09A' }}>
          {level.next != null ? `Encore un peu pour le niveau suivant` : 'Niveau maximum atteint — bravo !'}
        </p>
      </div>

      {/* Badges */}
      <div className="rounded-2xl p-5 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <h3 className="font-semibold mb-4" style={{ color: '#1A1A1A' }}>Mes badges</h3>
        <div className="grid grid-cols-4 gap-3">
          {badges.map(b => (
            <div key={b.id} title={b.hint} className="flex flex-col items-center text-center transition-all"
              style={{ opacity: b.earned ? 1 : 0.35, transform: b.earned ? 'scale(1)' : 'scale(0.96)' }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mb-1.5"
                style={{ backgroundColor: b.earned ? (b.gold ? '#C9A84C' : '#5A8A6A15') : '#F5F3EF', color: b.earned ? (b.gold ? '#1A1A1A' : '#5A8A6A') : '#A8A09A' }}>
                <Icon name={b.earned ? 'award' : 'award'} size={20} />
              </div>
              <span className="text-[10px] leading-tight font-medium" style={{ color: b.earned ? '#1A1A1A' : '#A8A09A' }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Classement sain */}
      <div className="rounded-2xl p-5 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <h3 className="font-semibold mb-4" style={{ color: '#1A1A1A' }}>Classement du mois</h3>
        {podium.length === 0 ? (
          <p className="text-sm" style={{ color: '#A8A09A' }}>Pas encore de classement ce mois.</p>
        ) : (
          <div className="flex items-end justify-center gap-3 mb-4">
            {[1, 0, 2].map(pos => {
              const p = podium[pos];
              if (!p) return <div key={pos} className="flex-1" />;
              const heights = ['h-16', 'h-20', 'h-12'];
              const medals = ['#9AA0A6', '#C9A84C', '#B08D57'];
              return (
                <div key={pos} className="flex-1 flex flex-col items-center">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold mb-1" style={{ backgroundColor: `${medals[pos]}18`, color: medals[pos] }}>{p.name.charAt(0)}</div>
                  <p className="text-xs font-medium truncate max-w-full" style={{ color: '#1A1A1A' }}>{p.name.split(' ')[0]}</p>
                  <div className={`w-full ${heights[pos]} rounded-t-xl mt-1 flex items-start justify-center pt-1`} style={{ backgroundColor: `${medals[pos]}20` }}>
                    <span className="text-xs font-bold" style={{ color: medals[pos] }}>{p.count}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-sm px-3 py-2.5 rounded-xl text-center font-medium" style={{ backgroundColor: '#C9A84C12', color: '#C48A2A' }}>{rankText}</p>
      </div>
    </div>
  );
}
