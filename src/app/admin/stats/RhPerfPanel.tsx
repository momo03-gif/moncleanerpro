'use client';

import { useState, useEffect } from 'react';
import { getCleaners } from '@/lib/db';
import { getAllCleanerRhDB, type CleanerRh } from '@/lib/rhApi';
import { formatDuration } from '@/lib/format';

// ── Tableau de performance RH par cleaner (admin, LOT 5.A). ─────────────────────
// Pas d'emoji (règle de design) : statut via pastille de couleur + libellé.

type Health = { label: string; color: string };
function health(rh: CleanerRh): Health {
  if (rh.reducedPriority) return { label: 'À surveiller', color: '#B85A50' };
  if (rh.qualityScore === 0 && rh.performanceBonusEligible) return { label: 'Excellent', color: '#5A8A6A' };
  return { label: 'Moyen', color: '#C48A2A' };
}

interface Row { id: string; name: string; rh: CleanerRh; }

export default function RhPerfPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getCleaners(), getAllCleanerRhDB()]).then(([cleaners, rhs]) => {
      const byId = new Map(rhs.map(r => [r.cleanerId, r]));
      setRows((cleaners as any[])
        .filter(c => byId.has(c.id))
        .map(c => ({ id: c.id, name: c.name, rh: byId.get(c.id)! })));
      setLoading(false);
    });
  }, []);

  function exportCsv() {
    const head = ['Cleaner', 'Missions mois', 'Jours travaillés', 'Temps moyen (min)', 'Déplacements payés (min)',
      'Retours négatifs', 'Score qualité', 'Prime qualité', 'Prime performance', 'TCL', 'Internet', 'Statut'];
    const lines = rows.map(({ name, rh }) => [
      name, rh.missionsCompletedThisMonth, rh.daysWorkedMonth, rh.avgMinutesPerMission, rh.travelPaidMinutes,
      rh.negativeFeedbackCount, rh.qualityScore,
      rh.qualityBonusEligible ? 'Oui' : 'Non', rh.performanceBonusEligible ? 'Oui' : 'Non',
      rh.tclEligible ? 'Oui' : 'Non', rh.internetBonusEligible ? 'Oui' : 'Non', health(rh).label,
    ].join(';'));
    const csv = [head.join(';'), ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `performance-rh-${new Date().toISOString().slice(0, 7)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  if (loading) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between gap-3 mb-1">
        <h2 className="font-semibold" style={{ color: '#1A1A1A' }}>Performance RH</h2>
        <button onClick={exportCsv} disabled={rows.length === 0}
          className="px-4 py-2 rounded-xl text-sm font-semibold border disabled:opacity-50"
          style={{ borderColor: '#E8E4DC', color: '#7A7068', backgroundColor: '#FAFAF8' }}>
          Exporter
        </button>
      </div>
      <p className="text-sm mb-5" style={{ color: '#A8A09A' }}>Indicateurs du mois par cleaner (recalculés depuis Comptabilité → Fiches de paie).</p>

      {rows.length === 0 ? (
        <div className="rounded-2xl p-6 border text-sm" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC', color: '#A8A09A' }}>
          Aucune donnée RH — lancez « Recalculer la paie » dans Comptabilité.
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <div className="hidden lg:grid px-5 py-3 text-xs font-semibold uppercase tracking-wide border-b" style={{ color: '#A8A09A', borderColor: '#F2EFE9', backgroundColor: '#FAFAF8', gridTemplateColumns: '1.4fr repeat(6, 1fr) 1.1fr' }}>
            <span>Cleaner</span><span>Missions</span><span>Jours</span><span>Tps moy.</span><span>Trajets</span><span>Retours -</span><span>Qualité</span><span>Statut</span>
          </div>
          {rows.map(({ id, name, rh }, i) => {
            const h = health(rh);
            const advantages = [
              rh.qualityBonusEligible && 'Prime qualité',
              rh.performanceBonusEligible && 'Prime perf.',
              rh.tclEligible && 'TCL',
              rh.internetBonusEligible && 'Internet',
            ].filter(Boolean) as string[];
            return (
              <div key={id} className={`px-5 py-4 flex flex-col lg:grid gap-2 lg:gap-0 lg:items-center ${i < rows.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9', gridTemplateColumns: '1.4fr repeat(6, 1fr) 1.1fr' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>{name.charAt(0)}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{name}</p>
                    {advantages.length > 0 && <p className="text-xs truncate" style={{ color: '#5A8A6A' }}>{advantages.join(' · ')}</p>}
                  </div>
                </div>
                <Cell label="Missions" value={String(rh.missionsCompletedThisMonth)} />
                <Cell label="Jours" value={String(rh.daysWorkedMonth)} />
                <Cell label="Tps moy." value={formatDuration(rh.avgMinutesPerMission)} />
                <Cell label="Trajets" value={`${rh.travelPaidMinutes} min`} />
                <Cell label="Retours -" value={String(rh.negativeFeedbackCount)} color={rh.negativeFeedbackCount > 0 ? '#B85A50' : undefined} />
                <Cell label="Qualité" value={String(rh.qualityScore)} color={rh.qualityScore < 0 ? '#B85A50' : '#5A8A6A'} />
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: h.color }} />
                  <span className="text-sm font-medium" style={{ color: h.color }}>{h.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between lg:block">
      <span className="text-xs lg:hidden" style={{ color: '#A8A09A' }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: color ?? '#1A1A1A' }}>{value}</span>
    </div>
  );
}
