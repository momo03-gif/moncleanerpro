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
import { Card, PageTitle, Segmented } from '@/components/ui';

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
      <PageTitle
        title="Réparations"
        subtitle="Ce qui est à réparer dans vos logements, signalé lors des ménages"
      />

      <Segmented
        value={tab}
        onChange={setTab}
        className="mb-6"
        options={[
          ['open', `À réparer${openList.length ? ` (${openList.length})` : ''}`],
          ['done', `Réparé${doneList.length ? ` (${doneList.length})` : ''}`],
        ] as const}
      />

      {list.length === 0 ? (
        <Card className="px-5 py-8 text-center">
          <p className="text-sm text-muted">
            {tab === 'open' ? 'Aucune réparation en attente. Tout est en ordre.' : 'Aucune réparation terminée pour le moment.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(byProperty.entries()).map(([property, items]) => (
            <div key={property}>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted">
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
