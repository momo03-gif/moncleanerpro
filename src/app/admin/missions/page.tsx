'use client';

import { useState } from 'react';
import { getMissions, getActiveCleaners, HOTEL_ANNOUNCES, addMission, APARTMENTS } from '@/lib/mockData';
import { Mission, MissionStatus, MissionType, MissionSource, HotelAnnounce, AnnounceStatus } from '@/lib/types';

const MISSION_STATUS: Record<MissionStatus, { label: string; color: string }> = {
  pending:     { label: 'En attente', color: '#C48A2A' },
  accepted:    { label: 'Validée',    color: '#C9A84C' },
  in_progress: { label: 'En cours',   color: '#8B7A62' },
  completed:   { label: 'Terminée',   color: '#5A8A6A' },
  cancelled:   { label: 'Annulée',    color: '#B85A50' },
};

const ANNOUNCE_STATUS: Record<AnnounceStatus, { label: string; color: string }> = {
  pending:     { label: 'En attente', color: '#C48A2A' },
  validated:   { label: 'Validée',    color: '#C9A84C' },
  refused:     { label: 'Refusée',    color: '#B85A50' },
  in_progress: { label: 'En cours',   color: '#8B7A62' },
  completed:   { label: 'Terminée',   color: '#5A8A6A' },
};

const TYPE_LABEL: Record<string, string> = {
  checkout: 'Check-out', checkin: 'Check-in', deep_clean: 'Grand ménage', regular: 'Régulier',
  menage: 'Ménage', grand_menage: 'Grand ménage',
};

const inputStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E8E4DC', color: '#1A1A1A', outline: 'none' };

const TABS = ['Annonces hôtel', 'Missions', 'Créer'] as const;

function calcGain(cleanerId: string, source: MissionSource, duration: number, cleaners: ReturnType<typeof getActiveCleaners>): number {
  const c = cleaners.find(x => x.id === cleanerId);
  if (!c) return 0;
  if (source === 'hotel') return (c.hourlyRateHotel ?? 0) * duration;
  return c.rateAirbnb ?? 0;
}

function calcPrice(source: MissionSource, duration: number): number {
  if (source === 'hotel') return duration * 40;
  return 25;
}

export default function MissionsPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('Annonces hôtel');
  const [missionFilter, setMissionFilter] = useState<MissionStatus | 'all'>('all');
  const [missions, setMissions] = useState<Mission[]>(getMissions());
  const [announces, setAnnounces] = useState<HotelAnnounce[]>(HOTEL_ANNOUNCES);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedCleaner, setSelectedCleaner] = useState('');

  const cleaners = getActiveCleaners();
  const pendingAnnounces = announces.filter(a => a.status === 'pending').length;

  // ── Create form state
  const [form, setForm] = useState({
    property: '', address: '', type: 'checkout' as MissionType,
    source: 'hotel' as MissionSource, date: '', time: '', duration: '2',
    cleanerId: '', price: '', cleanerGain: '',
  });

  function handleSourceOrCleanerChange(patch: Partial<typeof form>) {
    const next = { ...form, ...patch };
    const dur = Number(next.duration) || 0;
    if (next.cleanerId && dur > 0) {
      const gain = calcGain(next.cleanerId, next.source, dur, cleaners);
      next.cleanerGain = String(gain);
    }
    const price = calcPrice(next.source, dur);
    if (!form.price || form.price === calcPrice(form.source, Number(form.duration) || 0).toString()) {
      next.price = String(price);
    }
    setForm(next);
  }

  function handleCreateMission(e: React.FormEvent) {
    e.preventDefault();
    const cleaner = cleaners.find(c => c.id === form.cleanerId);
    const newMission: Mission = {
      id: `m${Date.now()}`,
      property: form.property,
      address: form.address,
      type: form.type,
      source: form.source,
      date: form.date,
      time: form.time,
      duration: Number(form.duration),
      status: form.cleanerId ? 'accepted' : 'pending',
      cleanerId: form.cleanerId || undefined,
      cleanerName: cleaner?.name,
      price: Number(form.price) || 0,
      cleanerGain: form.cleanerGain ? Number(form.cleanerGain) : undefined,
    };
    addMission(newMission);
    setMissions(getMissions());
    setForm({ property: '', address: '', type: 'checkout', source: 'hotel', date: '', time: '', duration: '2', cleanerId: '', price: '', cleanerGain: '' });
    setTab('Missions');
  }

  function handleValidate(id: string) {
    if (!selectedCleaner) return;
    const cleaner = cleaners.find(c => c.id === selectedCleaner);
    setAnnounces(prev => prev.map(a => a.id === id ? { ...a, status: 'validated' as AnnounceStatus, cleanerId: cleaner?.id, cleanerName: cleaner?.name } : a));
    setAssigningId(null);
    setSelectedCleaner('');
  }

  function handleRefuse(id: string) {
    setAnnounces(prev => prev.map(a => a.id === id ? { ...a, status: 'refused' as AnnounceStatus } : a));
  }

  const filteredMissions = missionFilter === 'all' ? missions : missions.filter(m => m.status === missionFilter);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Missions</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all relative"
            style={{ backgroundColor: tab === t ? '#FFFFFF' : 'transparent', color: tab === t ? '#1A1A1A' : '#A8A09A', boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {t}
            {t === 'Annonces hôtel' && pendingAnnounces > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center" style={{ backgroundColor: '#C48A2A', color: '#FFFFFF' }}>
                {pendingAnnounces}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB : Annonces hôtel ── */}
      {tab === 'Annonces hôtel' && (
        <div className="space-y-3">
          {announces.length === 0 && <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}><p className="text-sm" style={{ color: '#A8A09A' }}>Aucune annonce</p></div>}
          {announces.map(a => {
            const st = ANNOUNCE_STATUS[a.status];
            const isPending = a.status === 'pending';
            return (
              <div key={a.id} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: isPending ? '#C48A2A40' : '#E8E4DC' }}>
                <div className="px-5 py-3.5 flex items-center justify-between gap-3 border-b" style={{ borderColor: '#F2EFE9' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{TYPE_LABEL[a.type]} — {a.hotelName}</span>
                    <span className="text-xs" style={{ color: '#A8A09A' }}>{new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {a.timeStart}–{a.timeEnd}</span>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold shrink-0" style={{ backgroundColor: `${st.color}15`, color: st.color }}>{st.label}</span>
                </div>
                <div className="px-5 py-4">
                  <div className="flex flex-wrap gap-4 mb-3">
                    <span className="text-xs" style={{ color: '#7A7068' }}>👥 {a.guestCount} personne{a.guestCount > 1 ? 's' : ''}</span>
                    {a.cleanerName && <span className="text-xs" style={{ color: '#C9A84C' }}>👤 {a.cleanerName}</span>}
                  </div>
                  {a.instructions && <p className="text-xs mb-3 px-3 py-2 rounded-xl" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>{a.instructions}</p>}
                  {isPending && (
                    assigningId === a.id ? (
                      <div className="flex gap-2">
                        <select value={selectedCleaner} onChange={e => setSelectedCleaner(e.target.value)} className="flex-1 px-3 py-2 rounded-xl text-sm border appearance-none" style={{ ...inputStyle, color: selectedCleaner ? '#1A1A1A' : '#A8A09A' }}>
                          <option value="">Choisir un cleaner</option>
                          {cleaners.map(c => <option key={c.id} value={c.id}>{c.name} — ⭐{c.rating}</option>)}
                        </select>
                        <button onClick={() => handleValidate(a.id)} disabled={!selectedCleaner} className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Valider</button>
                        <button onClick={() => { setAssigningId(null); setSelectedCleaner(''); }} className="px-3 py-2 rounded-xl text-sm" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>✕</button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => setAssigningId(a.id)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Valider et attribuer</button>
                        <button onClick={() => handleRefuse(a.id)} className="px-4 py-2.5 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>Refuser</button>
                      </div>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB : Missions ── */}
      {tab === 'Missions' && (
        <>
          <div className="flex gap-2 mb-6 flex-wrap">
            {([['all', 'Toutes'], ['pending', 'En attente'], ['accepted', 'Validées'], ['in_progress', 'En cours'], ['completed', 'Terminées']] as const).map(([val, lbl]) => (
              <button key={val} onClick={() => setMissionFilter(val)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: missionFilter === val ? '#C9A84C' : '#FFFFFF', color: missionFilter === val ? '#1A1A1A' : '#7A7068', border: `1px solid ${missionFilter === val ? '#C9A84C' : '#E8E4DC'}` }}>
                {lbl}
              </button>
            ))}
          </div>

          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
            <div className="hidden md:grid grid-cols-7 px-5 py-3 text-xs font-semibold uppercase tracking-wide border-b" style={{ color: '#A8A09A', borderColor: '#F2EFE9', backgroundColor: '#FAFAF8' }}>
              <span className="col-span-2">Propriété</span>
              <span>Date</span>
              <span>Type</span>
              <span>Cleaner</span>
              <span>Prix client</span>
              <span>Gain cleaner</span>
            </div>
            {filteredMissions.length === 0 && <div className="py-12 text-center text-sm" style={{ color: '#A8A09A' }}>Aucune mission</div>}
            {filteredMissions.map((m, i) => {
              const st = MISSION_STATUS[m.status];
              return (
                <div key={m.id} className={`px-5 py-4 flex flex-col md:grid md:grid-cols-7 gap-2 md:gap-0 md:items-center ${i < filteredMissions.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{m.property}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: m.source === 'airbnb' ? '#C9A84C15' : '#F5F3EF', color: m.source === 'airbnb' ? '#C9A84C' : '#7A7068' }}>{m.source === 'airbnb' ? 'Airbnb' : 'Hôtel'}</span>
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: `${st.color}18`, color: st.color }}>{st.label}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: '#1A1A1A' }}>{m.date}</p>
                    <p className="text-xs" style={{ color: '#A8A09A' }}>{m.time} · {m.duration}h</p>
                  </div>
                  <div>
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>{TYPE_LABEL[m.type]}</span>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: m.cleanerName ? '#1A1A1A' : '#A8A09A' }}>{m.cleanerName ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: '#5A8A6A' }}>{m.price}€</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: m.cleanerGain ? '#C9A84C' : '#A8A09A' }}>
                      {m.cleanerGain ? `${m.cleanerGain}€` : '—'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── TAB : Créer ── */}
      {tab === 'Créer' && (
        <form onSubmit={handleCreateMission} className="rounded-2xl border p-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <h2 className="font-semibold mb-5" style={{ color: '#1A1A1A' }}>Nouvelle mission</h2>

          <div className="grid md:grid-cols-2 gap-4 mb-5">
            {/* Source */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Source</label>
              <div className="flex gap-2">
                {(['hotel', 'airbnb'] as MissionSource[]).map(s => (
                  <button key={s} type="button" onClick={() => handleSourceOrCleanerChange({ source: s })}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
                    style={{ borderColor: form.source === s ? '#C9A84C' : '#E8E4DC', backgroundColor: form.source === s ? '#C9A84C12' : '#FFFFFF', color: form.source === s ? '#C9A84C' : '#7A7068' }}>
                    {s === 'hotel' ? '🏨 Hôtel' : '🏠 Airbnb'}
                  </button>
                ))}
              </div>
            </div>

            {/* Property */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>
                {form.source === 'airbnb' ? 'Appartement' : 'Propriété'}
              </label>
              {form.source === 'airbnb' ? (
                <select value={form.property} onChange={e => { const apt = APARTMENTS.find(a => a.name === e.target.value); setForm(p => ({ ...p, property: e.target.value, address: apt?.address ?? '' })); }}
                  className="w-full px-4 py-3 rounded-xl text-sm border appearance-none" style={{ ...inputStyle, color: form.property ? '#1A1A1A' : '#A8A09A' }}
                  required>
                  <option value="">Sélectionner un appartement</option>
                  {APARTMENTS.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                </select>
              ) : (
                <input required value={form.property} onChange={e => setForm(p => ({ ...p, property: e.target.value }))}
                  placeholder="Nom de la propriété" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              )}
            </div>

            {/* Address */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Adresse</label>
              <input required value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                placeholder="12 Rue de la Paix, Paris 75001" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as MissionType }))}
                className="w-full px-4 py-3 rounded-xl text-sm border appearance-none" style={inputStyle}>
                <option value="checkout">Check-out</option>
                <option value="checkin">Check-in</option>
                <option value="deep_clean">Grand ménage</option>
                <option value="regular">Régulier</option>
              </select>
            </div>

            {/* Cleaner */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Cleaner assigné</label>
              <select value={form.cleanerId} onChange={e => handleSourceOrCleanerChange({ cleanerId: e.target.value })}
                className="w-full px-4 py-3 rounded-xl text-sm border appearance-none" style={{ ...inputStyle, color: form.cleanerId ? '#1A1A1A' : '#A8A09A' }}>
                <option value="">Assigner plus tard</option>
                {cleaners.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {/* Date + Time */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Date</label>
              <input required type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                min={new Date().toISOString().split('T')[0]} className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Heure</label>
              <input required type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Durée (heures)</label>
              <div className="flex gap-2">
                {['1','2','3','4','5'].map(d => (
                  <button key={d} type="button" onClick={() => handleSourceOrCleanerChange({ duration: d })}
                    className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-all"
                    style={{ borderColor: form.duration === d ? '#C9A84C' : '#E8E4DC', backgroundColor: form.duration === d ? '#C9A84C' : '#FFFFFF', color: form.duration === d ? '#1A1A1A' : '#A8A09A' }}>
                    {d}h
                  </button>
                ))}
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>
                  Prix client (€)
                  <span className="ml-1 font-normal tracking-normal normal-case" style={{ color: '#A8A09A' }}>auto</span>
                </label>
                <input type="number" min="0" value={form.price} onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                  placeholder="0" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>
                  Gain cleaner (€)
                  <span className="ml-1 font-normal tracking-normal normal-case" style={{ color: '#A8A09A' }}>auto</span>
                </label>
                <input type="number" min="0" value={form.cleanerGain} onChange={e => setForm(p => ({ ...p, cleanerGain: e.target.value }))}
                  placeholder="0" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
            </div>
          </div>

          {/* Auto-calc hint */}
          {form.cleanerId && form.duration && (
            <div className="mb-4 px-4 py-3 rounded-xl text-xs" style={{ backgroundColor: '#C9A84C12', color: '#7A6030' }}>
              {(() => {
                const c = cleaners.find(x => x.id === form.cleanerId);
                if (!c) return null;
                if (form.source === 'hotel') return `Taux hôtel de ${c.name} : ${c.hourlyRateHotel ?? 0}€/h × ${form.duration}h = ${(c.hourlyRateHotel ?? 0) * Number(form.duration)}€`;
                return `Prix Airbnb de ${c.name} : ${c.rateAirbnb ?? 0}€/apt`;
              })()}
            </div>
          )}

          <button type="submit" className="px-6 py-3 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            Créer la mission
          </button>
        </form>
      )}
    </div>
  );
}
