'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getRepairsForApartmentDB, createRepairDB, resolveRepairDB, reopenRepairDB,
} from '@/lib/repairs';
import type { Repair } from '@/lib/types';

// ════════════════════════════════════════════════════════════════════════════
//  Réparations d'un site — panneau repliable réutilisable.
//    role="cleaner" → peut signaler une réparation (depuis sa mission).
//    role="admin"   → peut signaler ET confirmer la réparation.
//    role="airbnb"  → le propriétaire confirme quand c'est réparé.
//
//  La liste est celle de l'APPARTEMENT (pas de la mission) : une réparation
//  signalée lors d'un ménage reste visible aux ménages suivants tant qu'elle
//  n'est pas faite.
// ════════════════════════════════════════════════════════════════════════════

interface Props {
  airbnbId: string;
  missionId?: string;        // mission d'origine quand on signale depuis une mission
  role: 'cleaner' | 'admin' | 'airbnb';
  authorName?: string;
  defaultOpen?: boolean;
}

const cardStyle = { borderColor: '#F2EFE9', backgroundColor: '#FCFBF8' };

export default function RepairsPanel({ airbnbId, missionId, role, authorName, defaultOpen }: Props) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [loaded, setLoaded] = useState(false);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const canCreate = role === 'cleaner' || role === 'admin';
  const canResolve = role === 'admin' || role === 'airbnb';

  const load = useCallback(async () => {
    const list = await getRepairsForApartmentDB(airbnbId);
    setRepairs(list);
    setLoaded(true);
  }, [airbnbId]);

  useEffect(() => { if (open && !loaded) load(); }, [open, loaded, load]);

  async function create() {
    setBusy(true); setError('');
    const res = await createRepairDB({
      airbnbId, missionId, description,
      createdBy: authorName, createdRole: role,
    });
    setBusy(false);
    if (res.error) { setError(res.error); return; }
    setDescription(''); setAdding(false);
    load();
  }

  async function resolve(r: Repair) {
    setBusy(true);
    await resolveRepairDB(r.id, authorName);
    setBusy(false);
    load();
  }

  async function reopen(r: Repair) {
    setBusy(true);
    await reopenRepairDB(r.id);
    setBusy(false);
    load();
  }

  const openCount = repairs.filter(r => r.status === 'open').length;

  return (
    <div className="rounded-xl border" style={cardStyle}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-4 py-2.5 text-left">
        <span className="text-xs font-semibold uppercase tracking-wide flex items-center gap-2" style={{ color: '#7A7068' }}>
          Réparations
          {loaded && openCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: '#B85A5015', color: '#B85A50' }}>
              {openCount} en attente
            </span>
          )}
        </span>
        <span style={{ color: '#B0A795', fontSize: 12 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {!loaded ? (
            <p className="text-xs py-2" style={{ color: '#A8A09A' }}>Chargement…</p>
          ) : (
            <>
              {repairs.length === 0 && (
                <p className="text-xs" style={{ color: '#A8A09A' }}>Aucune réparation signalée sur ce logement.</p>
              )}
              {repairs.map(r => (
                <RepairRow key={r.id} repair={r} busy={busy}
                  onResolve={canResolve ? () => resolve(r) : undefined}
                  onReopen={canResolve ? () => reopen(r) : undefined} />
              ))}
            </>
          )}

          {canCreate && (adding ? (
            <div className="rounded-xl p-3 space-y-2.5" style={{ backgroundColor: '#F8F6F2' }}>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
                placeholder="Ex. store du salon cassé, mitigeur salle de bain qui fuit…"
                className="w-full px-3 py-2 rounded-lg text-sm border resize-none"
                style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }} />
              <p className="text-[11px]" style={{ color: '#A8A09A' }}>
                Elle restera dans les réparations du logement tant que le propriétaire ne l&apos;aura pas marquée réparée.
              </p>
              {error && <p className="text-[11px]" style={{ color: '#B85A50' }}>{error}</p>}
              <div className="flex gap-2">
                <button onClick={create} disabled={busy || !description.trim()}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold disabled:opacity-50"
                  style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                  {busy ? '…' : 'Signaler la réparation'}
                </button>
                <button onClick={() => { setAdding(false); setError(''); }} disabled={busy}
                  className="px-4 py-2.5 rounded-xl text-xs border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                  Annuler
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold border"
              style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
              + Demander une réparation
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Ligne de réparation, réutilisée par l'espace partenaire ────────────────────

export function RepairRow({ repair, busy, onResolve, onReopen, showProperty }: {
  repair: Repair;
  busy?: boolean;
  onResolve?: () => void;
  onReopen?: () => void;
  showProperty?: boolean;
}) {
  const isOpen = repair.status === 'open';
  return (
    <div className="rounded-xl border px-3 py-2.5" style={{
      borderColor: isOpen ? '#B85A5030' : '#E8E4DC',
      backgroundColor: isOpen ? '#B85A500A' : '#FFFFFF',
    }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {showProperty && repair.propertyName && (
            <p className="text-xs font-semibold mb-0.5" style={{ color: '#1A1A1A' }}>{repair.propertyName}</p>
          )}
          <p className="text-sm leading-snug" style={{ color: isOpen ? '#4A443D' : '#A8A09A', textDecoration: isOpen ? 'none' : 'line-through' }}>
            {repair.description}
          </p>
          <p className="text-[11px] mt-1" style={{ color: '#A8A09A' }}>
            {repair.createdAt && new Date(repair.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            {repair.createdBy ? ` · signalé par ${repair.createdBy}` : ''}
            {!isOpen && repair.resolvedAt ? ` · réparé le ${new Date(repair.resolvedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}` : ''}
          </p>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0" style={{
          backgroundColor: isOpen ? '#B85A5015' : '#5A8A6A15',
          color: isOpen ? '#B85A50' : '#5A8A6A',
        }}>
          {isOpen ? 'à réparer' : 'réparé'}
        </span>
      </div>

      {isOpen && onResolve && (
        <button onClick={onResolve} disabled={busy}
          className="mt-2 w-full py-2 rounded-lg text-xs font-semibold disabled:opacity-50"
          style={{ backgroundColor: '#5A8A6A', color: '#FFFFFF' }}>
          ✓ Marquer comme réparé
        </button>
      )}
      {!isOpen && onReopen && (
        <button onClick={onReopen} disabled={busy}
          className="mt-2 w-full py-2 rounded-lg text-xs font-medium disabled:opacity-50 border"
          style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
          Rouvrir
        </button>
      )}
    </div>
  );
}
