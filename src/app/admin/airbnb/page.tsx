'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAirbnbs, createAirbnb } from '@/lib/db';
import type { Apartment } from '@/lib/types';
import { inputStyle } from '@/lib/ui';
import MapsModal from '@/components/MapsModal';

const emptyForm = { name: '', address: '', portalCode: '', keyboxCode: '', entryDirectives: '', clientPrice: '', cleanerGain: '' };
type FilterType = 'all' | 'assigned' | 'unassigned';

export default function AirbnbPage() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [mapsModal, setMapsModal] = useState<string | null>(null);

  const load = useCallback(async () => {
    const a = await getAirbnbs();
    setApartments(a);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const visible = apartments.filter(a => {
    const q = search.toLowerCase();
    const matchSearch = !q || a.name.toLowerCase().includes(q) || a.address.toLowerCase().includes(q);
    const matchFilter = filter === 'all' || (filter === 'assigned' ? !!a.cleanerName : !a.cleanerName);
    return matchSearch && matchFilter;
  });

  async function handleAddApartment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await createAirbnb({
      name: form.name, address: form.address,
      portalCode: form.portalCode || undefined,
      keyboxCode: form.keyboxCode || undefined,
      entryDirectives: form.entryDirectives,
      clientPrice: form.clientPrice ? Number(form.clientPrice) : undefined,
      cleanerGain: form.cleanerGain ? Number(form.cleanerGain) : undefined,
    });
    await load();
    setForm(emptyForm);
    setShowForm(false);
    setSaving(false);
  }

  if (loading) return <div className="p-4 md:p-6 text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {mapsModal && <MapsModal address={mapsModal} onClose={() => setMapsModal(null)} />}

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Airbnb</h1>
          <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>{apartments.length} appartement{apartments.length > 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowForm(s => !s)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ backgroundColor: showForm ? '#F5F3EF' : '#C9A84C', color: showForm ? '#7A7068' : '#1A1A1A' }}>
          <span>{showForm ? '✕' : '+'}</span>
          {showForm ? 'Annuler' : 'Ajouter un appartement'}
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#A8A09A' }}>⌕</span>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom ou adresse..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border" style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
        </div>
        <div className="flex gap-1 p-1 rounded-xl shrink-0" style={{ backgroundColor: '#F5F3EF' }}>
          {([['all', 'Tous'], ['assigned', 'Assignés'], ['unassigned', 'Non assignés']] as const).map(([val, lbl]) => (
            <button key={val} onClick={() => setFilter(val)} className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{ backgroundColor: filter === val ? '#FFFFFF' : 'transparent', color: filter === val ? '#1A1A1A' : '#A8A09A', boxShadow: filter === val ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleAddApartment} className="rounded-2xl border p-6 mb-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <h2 className="font-semibold mb-5" style={{ color: '#1A1A1A' }}>Nouvel appartement</h2>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {[
              { label: 'Nom', key: 'name', placeholder: 'Studio Montmartre', required: true },
              { label: 'Adresse complète', key: 'address', placeholder: '12 Rue de la Paix, Paris', required: true },
              { label: 'Code portail — optionnel', key: 'portalCode', placeholder: '1234A', required: false },
              { label: 'Code boîte à clé — optionnel', key: 'keyboxCode', placeholder: 'B#4512', required: false },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>{f.label}</label>
                <input required={f.required} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
            ))}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Directives d'entrée</label>
              <input required value={form.entryDirectives} onChange={e => setForm(p => ({ ...p, entryDirectives: e.target.value }))}
                placeholder="Instructions pour accéder au logement..." className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Prix client (€) <span className="normal-case font-normal" style={{ color: '#A8A09A' }}>— optionnel</span></label>
              <input type="number" min="0" value={form.clientPrice} onChange={e => setForm(p => ({ ...p, clientPrice: e.target.value }))}
                placeholder="Ex : 25" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Gain cleaner (€) <span className="normal-case font-normal" style={{ color: '#A8A09A' }}>— optionnel</span></label>
              <input type="number" min="0" value={form.cleanerGain} onChange={e => setForm(p => ({ ...p, cleanerGain: e.target.value }))}
                placeholder="Ex : 15" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>
          </div>
          <button type="submit" disabled={saving} className="px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {saving ? 'Ajout...' : "Ajouter l'appartement"}
          </button>
        </form>
      )}

      {visible.length === 0 && (
        <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>Aucun appartement trouvé</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {visible.map(apt => {
          const isExpanded = expanded.has(apt.id);
          const isLong = apt.entryDirectives && apt.entryDirectives.length > 100;

          return (
            <div key={apt.id} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
              {/* Header */}
              <div className="px-5 py-4 border-b" style={{ borderColor: '#F2EFE9' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate" style={{ color: '#1A1A1A' }}>{apt.name}</h3>
                    {/* Adresse cliquable → ouvre la modale Maps */}
                    <button
                      onClick={() => setMapsModal(apt.address)}
                      className="flex items-center gap-1 mt-0.5 text-left transition-colors max-w-full"
                      style={{ color: '#A8A09A' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#C9A84C')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#A8A09A')}
                    >
                      <span className="text-xs shrink-0">◎</span>
                      <span className="text-xs truncate">{apt.address}</span>
                    </button>
                  </div>
                  {apt.cleanerName ? (
                    <span className="text-xs px-2 py-1 rounded-full shrink-0 font-medium" style={{ backgroundColor: '#C9A84C12', color: '#C9A84C' }}>{apt.cleanerName.split(' ')[0]}</span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-full shrink-0" style={{ backgroundColor: '#F5F3EF', color: '#A8A09A' }}>Non assigné</span>
                  )}
                </div>
              </div>

              {/* Prix */}
              {((apt.clientPrice ?? 0) > 0 || (apt.cleanerGain ?? 0) > 0) && (
                <div className="px-5 py-3 border-b flex items-center gap-6" style={{ borderColor: '#F2EFE9', backgroundColor: '#FAFAF8' }}>
                  {(apt.clientPrice ?? 0) > 0 && (
                    <div>
                      <p className="text-xs" style={{ color: '#A8A09A' }}>Prix client</p>
                      <p className="text-sm font-semibold" style={{ color: '#5A8A6A' }}>{apt.clientPrice}€</p>
                    </div>
                  )}
                  {(apt.cleanerGain ?? 0) > 0 && (
                    <div>
                      <p className="text-xs" style={{ color: '#A8A09A' }}>Gain cleaner</p>
                      <p className="text-sm font-semibold" style={{ color: '#C9A84C' }}>{apt.cleanerGain}€</p>
                    </div>
                  )}
                </div>
              )}

              {/* Codes + directives */}
              <div className="px-5 py-4 space-y-3">
                {apt.portalCode && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-28 shrink-0" style={{ color: '#A8A09A' }}>Code portail</span>
                    <span className="text-sm font-mono font-semibold px-2 py-0.5 rounded-lg" style={{ backgroundColor: '#F5F3EF', color: '#1A1A1A' }}>{apt.portalCode}</span>
                  </div>
                )}
                {apt.keyboxCode && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-28 shrink-0" style={{ color: '#A8A09A' }}>Boîte à clé</span>
                    <span className="text-sm font-mono font-semibold px-2 py-0.5 rounded-lg" style={{ backgroundColor: '#F5F3EF', color: '#1A1A1A' }}>{apt.keyboxCode}</span>
                  </div>
                )}
                {/* Entrée : tronqué à 3 lignes avec "Voir plus" */}
                <div className="flex items-start gap-3">
                  <span className="text-xs w-28 shrink-0 mt-0.5" style={{ color: '#A8A09A' }}>Entrée</span>
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-sm leading-snug"
                      style={{
                        color: '#7A7068',
                        ...(isLong && !isExpanded ? {
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                        } : {}),
                      }}
                    >
                      {apt.entryDirectives}
                    </p>
                    {isLong && (
                      <button
                        onClick={() => toggleExpand(apt.id)}
                        className="text-xs mt-1.5 font-medium transition-colors"
                        style={{ color: '#C9A84C' }}
                      >
                        {isExpanded ? 'Voir moins ↑' : 'Voir plus ↓'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
