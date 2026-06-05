'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAirbnbsForPartner, getMissionsForPartnerDB, createAirbnbMissionDB, updateMissionStatusDB } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { Apartment, Mission } from '@/lib/types';

const inputStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E8E4DC', color: '#1A1A1A', outline: 'none' } as const;
const today = new Date().toISOString().split('T')[0];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'À assigner', color: '#6B7280', bg: '#6B728018' },
  accepted:    { label: 'En attente', color: '#C48A2A', bg: '#C48A2A15' },
  validated:   { label: 'Validée',    color: '#C9A84C', bg: '#C9A84C15' },
  in_progress: { label: 'En cours',   color: '#5B6EF5', bg: '#5B6EF518' },
  completed:   { label: 'Terminée',   color: '#5A8A6A', bg: '#5A8A6A15' },
  cancelled:   { label: 'Annulée',    color: '#B85A50', bg: '#B85A5015' },
};

function formatDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'long' });
}

export default function AirbnbMissionsPage() {
  const { user } = useAuth();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'create' | 'track'>('track');

  const [airbnbId, setAirbnbId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [hasInstructions, setHasInstructions] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const [a, m] = await Promise.all([
      getAirbnbsForPartner(user.id),
      getMissionsForPartnerDB(user.id),
    ]);
    setApartments(a);
    setMissions(m);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase.channel('partner-missions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'missions' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, user]);

  function resetForm() {
    setAirbnbId(''); setDate(''); setTime('');
    setHasInstructions(false); setInstructions(''); setError('');
  }

  async function handleCancel(id: string) {
    if (!confirm('Annuler cette mission ?')) return;
    await updateMissionStatusDB(id, 'cancelled');
    await load();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!airbnbId) { setError('Sélectionnez un appartement.'); return; }
    if (!date) { setError('Choisissez une date.'); return; }
    if (!time) { setError('Choisissez une heure.'); return; }
    setSaving(true); setError('');
    const res = await createAirbnbMissionDB({
      partnerId: user.id,
      airbnbId,
      dateFrom: date,
      timeFrom: time,
      instructions: hasInstructions ? instructions : undefined,
    });
    if (res.error) { setError(`Erreur : ${res.error}`); setSaving(false); return; }
    resetForm();
    await load();
    setSubmitted(true);
    setSaving(false);
  }

  if (loading) return <div className="p-5 pt-8 text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  if (submitted) return (
    <div className="p-5 flex flex-col items-center justify-center min-h-[60vh] text-center">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>
        <span className="text-xl">✦</span>
      </div>
      <h2 className="text-lg font-bold mb-1" style={{ color: '#1A1A1A' }}>Mission créée</h2>
      <p className="text-sm mb-6" style={{ color: '#A8A09A' }}>Elle sera assignée à un cleaner par l'équipe.</p>
      <div className="flex gap-2">
        <button onClick={() => { setSubmitted(false); setTab('track'); }} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Voir mes missions</button>
        <button onClick={() => { setSubmitted(false); setTab('create'); }} className="px-5 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Nouvelle</button>
      </div>
    </div>
  );

  return (
    <div className="p-5">
      <div className="mb-5 pt-2">
        <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Missions</h1>
      </div>

      <div className="flex gap-1 mb-6 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
        {([['track', 'Mes missions'], ['create', 'Créer']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ backgroundColor: tab === v ? '#FFFFFF' : 'transparent', color: tab === v ? '#1A1A1A' : '#A8A09A', boxShadow: tab === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'create' && (
        apartments.length === 0 ? (
          <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
            <p className="text-sm" style={{ color: '#A8A09A' }}>Ajoutez d'abord un appartement dans l'onglet « Appartements ».</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Appartement</label>
              <select value={airbnbId} onChange={e => setAirbnbId(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
                style={{ ...inputStyle, color: airbnbId ? '#1A1A1A' : '#A8A09A' }}>
                <option value="">Sélectionner un appartement</option>
                {apartments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {airbnbId && (() => {
              const a = apartments.find(x => x.id === airbnbId);
              if (!a) return null;
              return (
                <div className="rounded-xl p-4 text-sm space-y-1" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>
                  <p style={{ color: '#1A1A1A', fontWeight: 600 }}>{a.name}</p>
                  <p className="text-xs">◎ {a.address}</p>
                  {a.portalCode && <p className="text-xs">Portail : <span className="font-mono">{a.portalCode}</span></p>}
                  {a.keyboxCode && <p className="text-xs">Clé : <span className="font-mono">{a.keyboxCode}</span></p>}
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Date</label>
                <input type="date" value={date} min={today} required onChange={e => setDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Heure</label>
                <input type="time" value={time} required onChange={e => setTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div onClick={() => setHasInstructions(v => !v)}
                  className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all"
                  style={{ borderColor: hasInstructions ? '#C9A84C' : '#C8C2BA', backgroundColor: hasInstructions ? '#C9A84C' : '#FFFFFF' }}>
                  {hasInstructions && <span className="text-xs font-bold" style={{ color: '#1A1A1A' }}>✓</span>}
                </div>
                <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>Ajouter des consignes</span>
              </label>
              {hasInstructions && (
                <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3} autoFocus
                  placeholder="Ex : check-out 11h, linge dans le placard du couloir..."
                  className="w-full mt-3 px-4 py-3 rounded-xl text-sm border resize-none" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              )}
            </div>

            {error && <p className="text-xs text-center py-2 px-3 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#B85A50' }}>{error}</p>}

            <button type="submit" disabled={saving} className="w-full py-4 rounded-xl font-semibold text-sm disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
              {saving ? 'Création...' : 'Créer la mission'}
            </button>
          </form>
        )
      )}

      {tab === 'track' && (
        missions.length === 0 ? (
          <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
            <p className="text-xl mb-3">📋</p>
            <p className="font-medium text-sm" style={{ color: '#1A1A1A' }}>Aucune mission</p>
            <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Créez votre première mission</p>
          </div>
        ) : (
          <div className="space-y-3">
            {missions.map(m => {
              const st = STATUS_CFG[m.status] ?? STATUS_CFG.pending;
              return (
                <div key={m.id} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
                  <div className="px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: '#F2EFE9' }}>
                    <span className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{m.property || 'Mission'}</span>
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold shrink-0" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <div className="px-5 py-4">
                    {m.address && <p className="text-xs mb-2" style={{ color: '#A8A09A' }}>◎ {m.address}</p>}
                    <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: '#7A7068' }}>
                      <span>📅 {formatDate(m.date)}</span>
                      {m.time && <span>◷ {m.time}</span>}
                    </div>
                    {m.cleanerName && <p className="text-xs mt-2" style={{ color: '#A8A09A' }}>Cleaner : <span style={{ color: '#C9A84C', fontWeight: 600 }}>{m.cleanerName}</span></p>}
                    {m.status === 'pending' && (
                      <button onClick={() => handleCancel(m.id)}
                        className="mt-3 px-4 py-2 rounded-xl text-xs font-medium border"
                        style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>
                        Annuler la mission
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
