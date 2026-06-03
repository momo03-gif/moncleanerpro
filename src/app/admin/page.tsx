'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getMissionsDB, getCleaners, getPendingHotelsDB, approveHotelDB, refuseHotelDB } from '@/lib/db';
import type { Mission } from '@/lib/types';

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl p-5 border" style={{ backgroundColor: accent ? '#C9A84C' : '#FFFFFF', borderColor: accent ? '#C9A84C' : '#E8E4DC' }}>
      <p className="text-xs font-medium mb-3" style={{ color: accent ? '#7A6030' : '#A8A09A' }}>{label}</p>
      <p className="text-3xl font-bold" style={{ color: '#1A1A1A' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: accent ? '#7A6030' : '#A8A09A' }}>{sub}</p>}
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = { pending: '#C48A2A', accepted: '#C9A84C', in_progress: '#8B7A62', completed: '#5A8A6A', cancelled: '#B85A50' };
const STATUS_LABEL: Record<string, string> = { pending: 'En attente', accepted: 'Validée', in_progress: 'En cours', completed: 'Terminée', cancelled: 'Annulée' };

export default function AdminDashboard() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [cleaners, setCleaners] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    async function load() {
      const [m, c, p] = await Promise.all([getMissionsDB(), getCleaners(), getPendingHotelsDB()]);
      setMissions(m); setCleaners(c); setPending(p);
      setLoading(false);
    }
    load();
  }, []);

  async function handleApprove(id: string) { await approveHotelDB(id); setPending(await getPendingHotelsDB()); }
  async function handleRefuse(id: string) { await refuseHotelDB(id); setPending(await getPendingHotelsDB()); }

  const todayMissions = missions.filter(m => m.date === today);
  const pendingMissions = missions.filter(m => m.status === 'pending');
  const recent = [...missions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  if (loading) return <div className="p-6 text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Tableau de bord</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Comptes en attente */}
      {pending.length > 0 && (
        <div className="rounded-2xl border overflow-hidden mb-8" style={{ borderColor: '#C48A2A40', backgroundColor: '#FFFFFF' }}>
          <div className="px-5 py-3.5 flex items-center gap-3 border-b" style={{ borderColor: '#F2EFE9', backgroundColor: '#C48A2A08' }}>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#C48A2A' }} />
            <h2 className="font-semibold text-sm" style={{ color: '#1A1A1A' }}>Comptes en attente</h2>
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#C48A2A18', color: '#C48A2A' }}>
              {pending.length}
            </span>
          </div>
          {pending.map((h, i) => (
            <div key={h.id} className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 ${i < pending.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{h.name}</p>
                {h.address && <p className="text-xs" style={{ color: '#A8A09A' }}>{h.address}</p>}
                <p className="text-xs" style={{ color: '#A8A09A' }}>{h.email}{h.phone ? ` · ${h.phone}` : ''}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => handleApprove(h.id)} className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Valider</button>
                <button onClick={() => handleRefuse(h.id)} className="px-4 py-2 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>Refuser</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Missions aujourd'hui" value={todayMissions.length} sub={`${todayMissions.filter(m => m.status === 'accepted').length} acceptées`} accent />
        <StatCard label="En attente" value={pendingMissions.length} sub="à assigner" />
        <StatCard label="Cleaners actifs" value={cleaners.filter(c => c.status === 'active').length} sub={`sur ${cleaners.length} total`} />
        <StatCard label="Total missions" value={missions.length} sub="toutes" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: '#1A1A1A' }}>Missions récentes</h2>
            <Link href="/admin/missions" className="text-sm" style={{ color: '#C9A84C' }}>Voir tout →</Link>
          </div>
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
            {recent.length === 0 && <div className="p-8 text-center text-sm" style={{ color: '#A8A09A' }}>Aucune mission</div>}
            {recent.map((m, i) => (
              <div key={m.id} className={`px-5 py-4 flex items-center gap-4 ${i < recent.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{m.property}</p>
                  <p className="text-xs truncate" style={{ color: '#A8A09A' }}>{m.date} · {m.time} · {m.duration}h</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{m.price}€</span>
                  <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: `${STATUS_COLOR[m.status]}18`, color: STATUS_COLOR[m.status] }}>
                    {STATUS_LABEL[m.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: '#1A1A1A' }}>Cleaners</h2>
            <Link href="/admin/cleaners" className="text-sm" style={{ color: '#C9A84C' }}>Voir tout →</Link>
          </div>
          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
            {cleaners.map((c, i) => (
              <div key={c.id} className={`px-5 py-4 flex items-center gap-3 ${i < cleaners.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>
                  {c.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{c.name}</p>
                  <p className="text-xs" style={{ color: '#A8A09A' }}>{c.hourly_rate_hotel}€/h hôtel</p>
                </div>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.status === 'active' ? '#5A8A6A' : '#A8A09A' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
