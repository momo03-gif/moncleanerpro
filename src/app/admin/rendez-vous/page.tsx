'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAppointmentsDB, setAppointmentStatusDB, type Appointment, type AppointmentStatus } from '@/lib/appointments';

const STATUS_CFG: Record<AppointmentStatus, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmé', color: '#4E7D5E', bg: '#EAF3EC' },
  done: { label: 'Effectué', color: '#7A7068', bg: '#F5F3EF' },
  cancelled: { label: 'Annulé', color: '#B85A50', bg: '#FBECEA' },
};

function fmtDate(d: string): string {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}
const todayISO = () => new Date().toISOString().slice(0, 10);

export default function AdminRendezVousPage() {
  const [list, setList] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => { setLoading(true); setList(await getAppointmentsDB()); setLoading(false); }, []);
  useEffect(() => { load(); }, [load]);

  async function setStatus(id: string, status: AppointmentStatus) {
    setList(prev => prev.map(a => a.id === id ? { ...a, status } : a));
    await setAppointmentStatusDB(id, status);
  }

  const { upcoming, past } = useMemo(() => {
    const t = todayISO();
    const up: Appointment[] = [], pa: Appointment[] = [];
    for (const a of list) { (a.date >= t && a.status === 'confirmed' ? up : pa).push(a); }
    return { upcoming: up, past: pa };
  }, [list]);

  return (
    <div className="max-w-4xl mx-auto px-5 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Rendez-vous</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Créneaux réservés par les clients après validation de leur devis.</p>
      </div>

      {loading ? (
        <p className="text-sm py-10 text-center" style={{ color: '#A8A09A' }}>Chargement…</p>
      ) : list.length === 0 ? (
        <div className="rounded-2xl border py-12 text-center text-sm" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC', color: '#A8A09A' }}>Aucun rendez-vous pour le moment.</div>
      ) : (
        <>
          <Section title={`À venir (${upcoming.length})`} items={upcoming} onStatus={setStatus} />
          {past.length > 0 && <Section title={`Historique (${past.length})`} items={past} onStatus={setStatus} muted />}
        </>
      )}
    </div>
  );
}

function Section({ title, items, onStatus, muted }: { title: string; items: Appointment[]; onStatus: (id: string, s: AppointmentStatus) => void; muted?: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-7">
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>{title}</p>
      <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC', opacity: muted ? 0.85 : 1 }}>
        {items.map((a, i) => {
          const badge = STATUS_CFG[a.status];
          return (
            <div key={a.id} className={`px-5 py-4 ${i < items.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                    {fmtDate(a.date)} · <span style={{ color: '#9A7B22' }}>{a.time}</span>
                  </p>
                  <p className="text-sm mt-0.5" style={{ color: '#1A1A1A' }}>{a.clientName}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#7A7068' }}>
                    {[a.clientPhone, a.clientEmail].filter(Boolean).join(' · ')}
                    {a.devisNumber ? <> · <span style={{ color: '#9A7B22' }}>Devis {a.devisNumber}</span></> : null}
                  </p>
                  {a.message && <p className="text-xs mt-1 italic" style={{ color: '#A8A09A' }}>« {a.message} »</p>}
                  {a.refCode && <p className="text-[11px] mt-1" style={{ color: '#B0A795' }}>{a.refCode}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: badge.bg, color: badge.color }}>{badge.label}</span>
                </div>
              </div>
              {a.status === 'confirmed' && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => onStatus(a.id, 'done')} className="px-3 py-1.5 rounded-xl text-xs font-semibold border" style={{ borderColor: '#E8E4DC', color: '#4E7D5E' }}>Marquer effectué</button>
                  <button onClick={() => onStatus(a.id, 'cancelled')} className="px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ color: '#B85A50' }}>Annuler</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
