'use client';

import { useState, useEffect } from 'react';
import { getMissionsDB, getCleaners } from '@/lib/db';
import { getDepensesDB, type Depense } from '@/lib/depensesApi';
import type { Mission } from '@/lib/types';
import { formatDuration } from '@/lib/format';
import RhPerfPanel from './RhPerfPanel';

export default function StatsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [cleaners, setCleaners] = useState<any[]>([]);
  const [depenses, setDepenses] = useState<Depense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMissionsDB(), getCleaners(), getDepensesDB()]).then(([m, c, d]) => {
      setMissions(m); setCleaners(c); setDepenses(d); setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-4 md:p-6 text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  const total = missions.length;
  const completed = missions.filter(m => m.status === 'completed').length;
  const pending = missions.filter(m => m.status === 'pending').length;
  const revenue = missions.filter(m => m.status === 'completed').reduce((s, m) => s + m.price, 0);
  const avgPrice = total > 0 ? Math.round(missions.reduce((s, m) => s + m.price, 0) / total) : 0;

  // Bénéfice net tout compris = revenus − salaires cleaners − dépenses (TTC).
  const salariesAll = missions.filter(m => m.status === 'completed').reduce((s, m) => s + (m.cleanerGain ?? 0), 0);
  const depensesAll = depenses.reduce((s, d) => s + d.montantTtc, 0);
  const netAllIn = Math.round((revenue - salariesAll - depensesAll) * 100) / 100;

  const byType: Record<string, number> = {};
  missions.forEach(m => { byType[m.type] = (byType[m.type] ?? 0) + 1; });

  const typeLabel: Record<string, string> = {
    checkout: 'Check-out', checkin: 'Check-in', deep_clean: 'Grand ménage',
    regular: 'Régulier', menage: 'Ménage', grand_menage: 'Grand ménage',
  };

  // ── Pointage : temps réel vs prévu ──────────────────────────────────────────
  const tracked = missions.filter(m => m.actualDurationMinutes != null);
  const sumReal = tracked.reduce((s, m) => s + (m.actualDurationMinutes ?? 0), 0);
  const sumPlanned = tracked.reduce((s, m) => s + (m.missionDurationMinutes ?? 0), 0);
  const avgReal = tracked.length > 0 ? Math.round(sumReal / tracked.length) : 0;
  const avgPlanned = tracked.length > 0 ? Math.round(sumPlanned / tracked.length) : 0;

  // Moyenne réelle par appartement (nom de propriété).
  const byApt = new Map<string, { sum: number; n: number }>();
  tracked.forEach(m => {
    const key = m.property || 'Sans nom';
    const e = byApt.get(key) ?? { sum: 0, n: 0 };
    e.sum += m.actualDurationMinutes ?? 0; e.n += 1;
    byApt.set(key, e);
  });
  const aptAverages = Array.from(byApt.entries())
    .map(([name, e]) => ({ name, avg: Math.round(e.sum / e.n), n: e.n }))
    .sort((a, b) => b.n - a.n).slice(0, 8);

  // Moyenne réelle par cleaner.
  const cleanerAverages = cleaners.map(c => {
    const ms = tracked.filter(m => m.cleanerId === c.id);
    const sum = ms.reduce((s, m) => s + (m.actualDurationMinutes ?? 0), 0);
    return { name: c.name, avg: ms.length > 0 ? Math.round(sum / ms.length) : 0, n: ms.length };
  }).filter(c => c.n > 0).sort((a, b) => b.n - a.n);

  const topCleaner = cleaners.length > 0 ? cleaners.reduce((best, c) => {
    const count = missions.filter(m => m.cleanerId === c.id && m.status === 'completed').length;
    const bestCount = missions.filter(m => m.cleanerId === best.id && m.status === 'completed').length;
    return count > bestCount ? c : best;
  }, cleaners[0]) : null;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Statistiques</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Vue d'ensemble des performances</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total missions', value: total, icon: '◎' },
          { label: 'Taux de completion', value: total > 0 ? `${Math.round((completed / total) * 100)}%` : '0%', icon: '◈' },
          { label: 'Revenus générés', value: `${revenue}€`, icon: '◇', accent: true },
          { label: 'Prix moyen', value: `${avgPrice}€`, icon: '◉' },
        ].map(kpi => (
          <div key={kpi.label} className="rounded-2xl p-5 border" style={{ backgroundColor: kpi.accent ? '#C9A84C' : '#FFFFFF', borderColor: kpi.accent ? '#C9A84C' : '#E8E4DC' }}>
            <span className="text-2xl mb-3 block" style={{ color: kpi.accent ? '#7A6030' : '#C9A84C' }}>{kpi.icon}</span>
            <p className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>{kpi.value}</p>
            <p className="text-xs mt-1" style={{ color: kpi.accent ? '#7A6030' : '#A8A09A' }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Bénéfice net tout compris (revenus − salaires − dépenses) */}
      <div className="rounded-2xl p-5 border mb-8 flex flex-wrap items-center justify-between gap-3" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
        <div>
          <p className="text-xs uppercase tracking-wider" style={{ color: '#7A7068' }}>Bénéfice net (tout compris)</p>
          <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>Revenus {revenue}€ − salaires {Math.round(salariesAll)}€ − dépenses {Math.round(depensesAll)}€</p>
        </div>
        <p className="text-3xl font-bold" style={{ color: netAllIn >= 0 ? '#5A8A6A' : '#B85A50' }}>{netAllIn}€</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-2xl p-6 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <h2 className="font-semibold mb-5" style={{ color: '#1A1A1A' }}>Répartition par type</h2>
          {Object.keys(byType).length === 0 ? (
            <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune donnée</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(byType).map(([type, count]) => (
                <div key={type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm" style={{ color: '#7A7068' }}>{typeLabel[type] ?? type}</span>
                    <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full" style={{ backgroundColor: '#F2EFE9' }}>
                    <div className="h-1.5 rounded-full" style={{ backgroundColor: '#C9A84C', width: `${(count / total) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {topCleaner && (
            <div className="rounded-2xl p-6 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
              <h2 className="font-semibold mb-4" style={{ color: '#1A1A1A' }}>Meilleur cleaner</h2>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>
                  {topCleaner.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold" style={{ color: '#1A1A1A' }}>{topCleaner.name}</p>
                  <p className="text-sm" style={{ color: '#A8A09A' }}>
                    {missions.filter(m => m.cleanerId === topCleaner.id && m.status === 'completed').length} missions terminées
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl p-6 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
            <h2 className="font-semibold mb-4" style={{ color: '#1A1A1A' }}>Statuts</h2>
            <div className="space-y-3">
              {[
                { label: 'Terminées', count: completed, color: '#5A8A6A' },
                { label: 'En attente', count: pending, color: '#C48A2A' },
                { label: 'Acceptées', count: missions.filter(m => m.status === 'accepted').length, color: '#C9A84C' },
                { label: 'Annulées', count: missions.filter(m => m.status === 'cancelled').length, color: '#B85A50' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-sm" style={{ color: '#7A7068' }}>{s.label}</span>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Pointage : temps réel vs prévu ─────────────────────────────────── */}
      <div className="mt-8">
        <h2 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>Pointage — temps réel</h2>
        <p className="text-sm mb-5" style={{ color: '#A8A09A' }}>D'après les missions démarrées et terminées par les cleaners.</p>

        {tracked.length === 0 ? (
          <div className="rounded-2xl p-6 border text-sm" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC', color: '#A8A09A' }}>
            Aucune mission pointée pour le moment.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Missions pointées', value: String(tracked.length) },
                { label: 'Temps réel moyen', value: formatDuration(avgReal) },
                { label: 'Temps prévu moyen', value: formatDuration(avgPlanned) },
                { label: 'Écart moyen', value: `${avgReal - avgPlanned > 0 ? '+' : ''}${avgReal - avgPlanned} min`, accent: true },
              ].map(kpi => (
                <div key={kpi.label} className="rounded-2xl p-5 border" style={{ backgroundColor: kpi.accent ? '#5B6EF512' : '#FFFFFF', borderColor: kpi.accent ? '#5B6EF540' : '#E8E4DC' }}>
                  <p className="text-2xl font-bold" style={{ color: kpi.accent ? '#5B6EF5' : '#1A1A1A' }}>{kpi.value}</p>
                  <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>{kpi.label}</p>
                </div>
              ))}
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="rounded-2xl p-6 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
                <h3 className="font-semibold mb-4" style={{ color: '#1A1A1A' }}>Temps réel moyen par appartement</h3>
                <div className="space-y-3">
                  {aptAverages.map(a => (
                    <div key={a.name} className="flex items-center justify-between">
                      <span className="text-sm truncate pr-3" style={{ color: '#7A7068' }}>{a.name}</span>
                      <span className="text-sm font-semibold shrink-0" style={{ color: '#1A1A1A' }}>{formatDuration(a.avg)} <span style={{ color: '#A8A09A', fontWeight: 400 }}>· {a.n}</span></span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl p-6 border" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
                <h3 className="font-semibold mb-4" style={{ color: '#1A1A1A' }}>Temps réel moyen par cleaner</h3>
                {cleanerAverages.length === 0 ? (
                  <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune donnée</p>
                ) : (
                  <div className="space-y-3">
                    {cleanerAverages.map(c => (
                      <div key={c.name} className="flex items-center justify-between">
                        <span className="text-sm truncate pr-3" style={{ color: '#7A7068' }}>{c.name}</span>
                        <span className="text-sm font-semibold shrink-0" style={{ color: '#1A1A1A' }}>{formatDuration(c.avg)} <span style={{ color: '#A8A09A', fontWeight: 400 }}>· {c.n}</span></span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <RhPerfPanel />
    </div>
  );
}
