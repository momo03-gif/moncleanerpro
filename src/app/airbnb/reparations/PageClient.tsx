'use client';

// Espace partenaire — Réparations.
// Ce que les cleaners (ou l'admin) ont constaté de cassé/défectueux dans les
// logements. Une réparation reste dans « À réparer » tant que le propriétaire ne
// l'a pas marquée réparée : elle survit à la mission qui l'a signalée et reste
// rattachée à son appartement.

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedback } from '@/contexts/FeedbackContext';
import { getRepairsForPartnerDB, resolveRepairDB, reopenRepairDB } from '@/lib/repairs';
import type { Repair } from '@/lib/types';
import { RepairRow } from '@/components/RepairsPanel';
import Loading from '@/components/Loading';

export default function PartnerRepairsClient() {
  const { user } = useAuth();
  const { toast } = useFeedback();
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'open' | 'done'>('open');

  const load = useCallback(async () => {
    if (!user) return;
    setRepairs(await getRepairsForPartnerDB(user.id));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function resolve(r: Repair) {
    setBusy(true);
    await resolveRepairDB(r.id, user?.name);
    setBusy(false);
    load();
    toast('Marqué comme réparé.', 'success');
  }

  async function reopen(r: Repair) {
    setBusy(true);
    await reopenRepairDB(r.id);
    setBusy(false);
    load();
    toast('Réparation rouverte.', 'info');
  }

  if (!user) return null;
  if (loading) return <Loading className="p-5 pt-8 text-sm" />;

  const openList = repairs.filter(r => r.status === 'open');
  const doneList = repairs.filter(r => r.status === 'done');
  const list = tab === 'open' ? openList : doneList;

  // Regroupement par logement : le propriétaire raisonne appartement par appartement.
  const byProperty = new Map<string, Repair[]>();
  for (const r of list) {
    const key = r.propertyName || 'Logement';
    const arr = byProperty.get(key);
    if (arr) arr.push(r); else byProperty.set(key, [r]);
  }

  return (
    <div className="p-5 mcp-in">
      <div className="mb-5 pt-2">
        <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Réparations</h1>
        <p className="text-sm mt-0.5" style={{ color: '#A8A09A' }}>
          Ce qui est à réparer dans vos logements, signalé lors des ménages
        </p>
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
        {([['open', `À réparer${openList.length ? ` (${openList.length})` : ''}`], ['done', 'Réparé']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ backgroundColor: tab === v ? '#FFFFFF' : 'transparent', color: tab === v ? '#1A1A1A' : '#A8A09A', boxShadow: tab === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border px-5 py-8 text-center" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>
            {tab === 'open' ? 'Aucune réparation en attente. Tout est en ordre.' : 'Aucune réparation terminée pour le moment.'}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(byProperty.entries()).map(([property, items]) => (
            <div key={property}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#A8A09A' }}>
                {property}
              </p>
              <div className="space-y-2">
                {items.map(r => (
                  <RepairRow key={r.id} repair={r} busy={busy}
                    onResolve={() => resolve(r)} onReopen={() => reopen(r)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
