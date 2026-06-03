'use client';

import { useState, useEffect } from 'react';
import { getPendingHotelsDB, approveHotelDB, refuseHotelDB } from '@/lib/db';

export default function ComptesPage() {
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<Record<string, 'approved' | 'refused'>>({});

  useEffect(() => { getPendingHotelsDB().then(d => { setPending(d); setLoading(false); }); }, []);

  async function handleApprove(id: string) {
    await approveHotelDB(id);
    setDone(p => ({ ...p, [id]: 'approved' }));
  }

  async function handleRefuse(id: string) {
    await refuseHotelDB(id);
    setDone(p => ({ ...p, [id]: 'refused' }));
  }

  const active = pending.filter(h => !done[h.id]);
  const processed = pending.filter(h => done[h.id]);

  if (loading) return <div className="p-6 text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Comptes en attente</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Demandes d'inscription partenaires hôtel</p>
      </div>

      {active.length === 0 && processed.length === 0 && (
        <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-2xl mb-3">✦</p>
          <p className="font-medium" style={{ color: '#1A1A1A' }}>Aucune demande en attente</p>
          <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Toutes les demandes ont été traitées</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-3 mb-8">
          {active.map(h => (
            <div key={h.id} className="rounded-2xl border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#C48A2A40' }}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold" style={{ color: '#1A1A1A' }}>{h.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#C48A2A15', color: '#C48A2A' }}>En attente</span>
                  </div>
                  {h.address && <p className="text-sm" style={{ color: '#7A7068' }}>{h.address}</p>}
                  <p className="text-sm" style={{ color: '#A8A09A' }}>{h.email}{h.phone ? ` · ${h.phone}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(h.id)} className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                    Valider
                  </button>
                  <button onClick={() => handleRefuse(h.id)} className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>
                    Refuser
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {processed.length > 0 && (
        <>
          <h2 className="font-semibold mb-3" style={{ color: '#1A1A1A' }}>Traitées cette session</h2>
          <div className="space-y-2">
            {processed.map(h => (
              <div key={h.id} className="rounded-xl px-5 py-3 flex items-center gap-4 border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{h.name}</p>
                  <p className="text-xs" style={{ color: '#A8A09A' }}>{h.email}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{
                  backgroundColor: done[h.id] === 'approved' ? '#5A8A6A15' : '#B85A5015',
                  color: done[h.id] === 'approved' ? '#5A8A6A' : '#B85A50',
                }}>
                  {done[h.id] === 'approved' ? '✓ Validé' : '✕ Refusé'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
