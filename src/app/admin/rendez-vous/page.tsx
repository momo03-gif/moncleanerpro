'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAppointmentsDB, setAppointmentStatusDB, getBookingConfigDB, saveBookingConfigDB, DEFAULT_BOOKING,
  type Appointment, type AppointmentStatus, type BookingConfig,
} from '@/lib/appointments';

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

      <ConfigPanel />


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

// Jours affichés dans l'ordre Lun→Dim (valeurs JS getDay : 0=dim).
const DAYS: { v: number; label: string }[] = [
  { v: 1, label: 'Lun' }, { v: 2, label: 'Mar' }, { v: 3, label: 'Mer' }, { v: 4, label: 'Jeu' },
  { v: 5, label: 'Ven' }, { v: 6, label: 'Sam' }, { v: 0, label: 'Dim' },
];
function parseSlots(s: string): string[] {
  return s.split(/[,\s]+/).map(x => x.trim()).filter(x => /^\d{1,2}:\d{2}$/.test(x)).map(x => x.padStart(5, '0'));
}

function ConfigPanel() {
  const [cfg, setCfg] = useState<BookingConfig>(DEFAULT_BOOKING);
  const [morning, setMorning] = useState('');
  const [afternoon, setAfternoon] = useState('');
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { getBookingConfigDB().then(c => { setCfg(c); setMorning(c.morning.join(', ')); setAfternoon(c.afternoon.join(', ')); }); }, []);

  function toggleDay(v: number) {
    setCfg(c => ({ ...c, workingDays: c.workingDays.includes(v) ? c.workingDays.filter(d => d !== v) : [...c.workingDays, v] }));
  }
  async function save() {
    setSaving(true); setMsg('');
    const next: BookingConfig = { workingDays: cfg.workingDays, morning: parseSlots(morning), afternoon: parseSlots(afternoon), slotMin: cfg.slotMin || 60 };
    const res = await saveBookingConfigDB(next);
    setSaving(false);
    setMsg(res.error ? 'Erreur : ' + res.error : 'Disponibilités enregistrées ✓');
    if (!res.error) setCfg(next);
  }

  return (
    <div className="rounded-2xl border mb-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-3.5 text-left">
        <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>Réglages des disponibilités</span>
        <span className="text-xs" style={{ color: '#A8A09A' }}>{open ? 'Fermer' : 'Modifier les jours et horaires'}</span>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t" style={{ borderColor: '#F2EFE9' }}>
          <div className="pt-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Jours ouverts</p>
            <div className="flex flex-wrap gap-2">
              {DAYS.map(d => {
                const on = cfg.workingDays.includes(d.v);
                return (
                  <button key={d.v} onClick={() => toggleDay(d.v)} className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                    style={{ borderColor: on ? '#C9A84C' : '#E8E4DC', backgroundColor: on ? '#C9A84C' : '#FFFFFF', color: on ? '#1A1A1A' : '#A8A09A' }}>{d.label}</button>
                );
              })}
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#7A7068' }}>Créneaux du matin</label>
              <input value={morning} onChange={e => setMorning(e.target.value)} placeholder="09:00, 10:00, 11:00" className="w-full px-3 py-2.5 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#7A7068' }}>Créneaux de l&apos;après-midi</label>
              <input value={afternoon} onChange={e => setAfternoon(e.target.value)} placeholder="14:00, 15:00, 16:00, 17:00" className="w-full px-3 py-2.5 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold" style={{ color: '#7A7068' }}>Durée d&apos;un créneau</label>
            <input type="number" min={15} step={15} value={cfg.slotMin} onChange={e => setCfg(c => ({ ...c, slotMin: Number(e.target.value) || 60 }))} className="w-20 px-2 py-2 rounded-lg text-sm text-center border" style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }} />
            <span className="text-xs" style={{ color: '#A8A09A' }}>minutes</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={save} disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>{saving ? '…' : 'Enregistrer'}</button>
            {msg && <span className="text-xs" style={{ color: msg.includes('✓') ? '#5A8A6A' : '#B85A50' }}>{msg}</span>}
          </div>
          <p className="text-[11px]" style={{ color: '#A8A09A' }}>Format des horaires : HH:MM séparés par des virgules. Ces réglages s’appliquent immédiatement à la page publique de prise de rendez-vous.</p>
        </div>
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
