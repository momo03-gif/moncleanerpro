'use client';

import { useState } from 'react';
import { MISSIONS, USERS, HOTEL_ANNOUNCES } from '@/lib/mockData';
import { MissionStatus, HotelAnnounce, AnnounceStatus } from '@/lib/types';

// ── Statuts missions régulières
const MISSION_STATUS: Record<MissionStatus, { label: string; color: string }> = {
  pending:     { label: 'En attente',  color: '#C48A2A' },
  accepted:    { label: 'Validée',     color: '#C9A84C' },
  in_progress: { label: 'En cours',    color: '#8B7A62' },
  completed:   { label: 'Terminée',    color: '#5A8A6A' },
  cancelled:   { label: 'Annulée',     color: '#B85A50' },
};

// ── Statuts annonces hôtel (admin voit tout)
const ANNOUNCE_STATUS: Record<AnnounceStatus, { label: string; color: string }> = {
  pending:     { label: 'En attente',  color: '#C48A2A' },
  validated:   { label: 'Validée',     color: '#C9A84C' },
  refused:     { label: 'Refusée',     color: '#B85A50' },
  in_progress: { label: 'En cours',    color: '#8B7A62' },
  completed:   { label: 'Terminée',    color: '#5A8A6A' },
};

const TYPE_LABEL: Record<string, string> = {
  menage: 'Ménage', checkin: 'Check-in', checkout: 'Check-out', grand_menage: 'Grand ménage',
  checkout_m: 'Check-out', checkin_m: 'Check-in', deep_clean: 'Grand ménage', regular: 'Régulier',
};

const cleaners = USERS.filter(u => u.role === 'cleaner');

const TABS = ['Annonces hôtel', 'Missions'] as const;

export default function MissionsPage() {
  const [tab, setTab] = useState<typeof TABS[number]>('Annonces hôtel');
  const [missionFilter, setMissionFilter] = useState<MissionStatus | 'all'>('all');
  const [announces, setAnnounces] = useState<HotelAnnounce[]>(HOTEL_ANNOUNCES);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedCleaner, setSelectedCleaner] = useState('');

  const filteredMissions = missionFilter === 'all' ? MISSIONS : MISSIONS.filter(m => m.status === missionFilter);
  const pendingAnnounces = announces.filter(a => a.status === 'pending').length;

  function handleValidate(id: string) {
    if (!selectedCleaner) return;
    const cleaner = cleaners.find(c => c.id === selectedCleaner);
    setAnnounces(prev => prev.map(a =>
      a.id === id ? { ...a, status: 'validated' as AnnounceStatus, cleanerId: cleaner?.id, cleanerName: cleaner?.name } : a
    ));
    setAssigningId(null);
    setSelectedCleaner('');
  }

  function handleRefuse(id: string) {
    setAnnounces(prev => prev.map(a => a.id === id ? { ...a, status: 'refused' as AnnounceStatus } : a));
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Missions</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all relative"
            style={{
              backgroundColor: tab === t ? '#FFFFFF' : 'transparent',
              color: tab === t ? '#1A1A1A' : '#A8A09A',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
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
          {announces.length === 0 && (
            <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
              <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune annonce</p>
            </div>
          )}

          {announces.map(a => {
            const st = ANNOUNCE_STATUS[a.status];
            const isPending = a.status === 'pending';

            return (
              <div key={a.id} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: isPending ? '#C48A2A40' : '#E8E4DC' }}>
                {/* Top */}
                <div className="px-5 py-3.5 flex items-center justify-between gap-3 border-b" style={{ borderColor: '#F2EFE9' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                      {TYPE_LABEL[a.type]} — {a.hotelName}
                    </span>
                    <span className="text-xs" style={{ color: '#A8A09A' }}>
                      {new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {a.timeStart}–{a.timeEnd}
                    </span>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold shrink-0" style={{ backgroundColor: `${st.color}15`, color: st.color }}>
                    {st.label}
                  </span>
                </div>

                {/* Details */}
                <div className="px-5 py-4">
                  <div className="flex flex-wrap gap-4 mb-3">
                    <span className="text-xs" style={{ color: '#7A7068' }}>
                      👥 {a.guestCount} personne{a.guestCount > 1 ? 's' : ''}
                    </span>
                    {a.cleanerName && (
                      <span className="text-xs" style={{ color: '#C9A84C' }}>
                        👤 {a.cleanerName}
                      </span>
                    )}
                  </div>

                  {a.instructions && (
                    <p className="text-xs mb-3 px-3 py-2 rounded-xl" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>
                      {a.instructions}
                    </p>
                  )}

                  {/* Actions */}
                  {isPending && (
                    assigningId === a.id ? (
                      <div className="flex gap-2">
                        <select
                          value={selectedCleaner}
                          onChange={e => setSelectedCleaner(e.target.value)}
                          className="flex-1 px-3 py-2 rounded-xl text-sm border appearance-none"
                          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8E4DC', color: selectedCleaner ? '#1A1A1A' : '#A8A09A', outline: 'none' }}
                        >
                          <option value="">Choisir un cleaner</option>
                          {cleaners.map(c => (
                            <option key={c.id} value={c.id}>{c.name} — ⭐{c.rating}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleValidate(a.id)}
                          disabled={!selectedCleaner}
                          className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                          style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}
                        >
                          Valider
                        </button>
                        <button
                          onClick={() => { setAssigningId(null); setSelectedCleaner(''); }}
                          className="px-3 py-2 rounded-xl text-sm"
                          style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAssigningId(a.id)}
                          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                          style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}
                        >
                          Valider et attribuer
                        </button>
                        <button
                          onClick={() => handleRefuse(a.id)}
                          className="px-4 py-2.5 rounded-xl text-sm border transition-all"
                          style={{ borderColor: '#E8E4DC', color: '#B85A50' }}
                        >
                          Refuser
                        </button>
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
          {/* Filters */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {([['all', 'Toutes'], ['pending', 'En attente'], ['accepted', 'Validées'], ['in_progress', 'En cours'], ['completed', 'Terminées']] as const).map(([val, lbl]) => (
              <button
                key={val}
                onClick={() => setMissionFilter(val)}
                className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
                style={{
                  backgroundColor: missionFilter === val ? '#C9A84C' : '#FFFFFF',
                  color: missionFilter === val ? '#1A1A1A' : '#7A7068',
                  border: `1px solid ${missionFilter === val ? '#C9A84C' : '#E8E4DC'}`,
                }}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div className="rounded-2xl overflow-hidden border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
            <div className="hidden md:grid grid-cols-6 px-5 py-3 text-xs font-semibold uppercase tracking-wide border-b" style={{ color: '#A8A09A', borderColor: '#F2EFE9', backgroundColor: '#FAFAF8' }}>
              <span className="col-span-2">Propriété</span>
              <span>Date</span>
              <span>Type</span>
              <span>Cleaner</span>
              <span>Statut</span>
            </div>

            {filteredMissions.length === 0 && (
              <div className="py-12 text-center text-sm" style={{ color: '#A8A09A' }}>Aucune mission</div>
            )}

            {filteredMissions.map((m, i) => {
              const st = MISSION_STATUS[m.status];
              return (
                <div key={m.id} className={`px-5 py-4 flex flex-col md:grid md:grid-cols-6 gap-2 md:gap-0 md:items-center ${i < filteredMissions.length - 1 ? 'border-b' : ''}`} style={{ borderColor: '#F2EFE9' }}>
                  <div className="md:col-span-2">
                    <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{m.property}</p>
                    <p className="text-xs" style={{ color: '#A8A09A' }}>{m.address.split(',')[1]?.trim()} · {m.price}€</p>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: '#1A1A1A' }}>{m.date}</p>
                    <p className="text-xs" style={{ color: '#A8A09A' }}>{m.time} · {m.duration}h</p>
                  </div>
                  <div>
                    <span className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>
                      {TYPE_LABEL[m.type]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm" style={{ color: m.cleanerName ? '#1A1A1A' : '#A8A09A' }}>{m.cleanerName ?? '—'}</p>
                  </div>
                  <div>
                    <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: `${st.color}18`, color: st.color }}>
                      {st.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
