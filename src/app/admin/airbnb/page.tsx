'use client';

import { useState, useEffect, useCallback } from 'react';
import { getAirbnbs, createAirbnb, updateAirbnb, deleteAirbnb, getPartnerNamesDB, setAirbnbCoordsDB } from '@/lib/db';
import { geocodeAddress, ZONE_PALETTE } from '@/lib/zones';
import type { Apartment } from '@/lib/types';
import { inputStyle } from '@/lib/ui';
import { formatDuration } from '@/lib/format';
import { STRUCTURE_LABEL, structureLabel } from '@/lib/labels';
import MapsModal from '@/components/MapsModal';
import Loading from "@/components/Loading";

const emptyForm = {
  name: '', address: '', partnerName: '', portalCode: '', keyboxCode: '',
  entryDirectives: '', bedrooms: '', beds: '', sofaBeds: '', clientPrice: '',
  estimatedMinutes: '60', zoneColor: '', zoneName: '', notes: '',
  structureType: 'apartment', structureLabel: '',
};
type FormState = typeof emptyForm;

function aptToForm(a: Apartment): FormState {
  return {
    name: a.name ?? '',
    address: a.address ?? '',
    structureType: a.structureType ?? 'apartment',
    structureLabel: a.structureLabel ?? '',
    partnerName: a.partnerName ?? '',
    portalCode: a.portalCode ?? '',
    keyboxCode: a.keyboxCode ?? '',
    entryDirectives: a.entryDirectives ?? '',
    bedrooms: a.bedrooms != null ? String(a.bedrooms) : '',
    beds: a.beds != null ? String(a.beds) : '',
    sofaBeds: a.sofaBeds != null ? String(a.sofaBeds) : '',
    clientPrice: a.clientPrice != null ? String(a.clientPrice) : '',
    estimatedMinutes: a.estimatedCleaningMinutes != null ? String(a.estimatedCleaningMinutes) : '60',
    zoneColor: a.zoneColor ?? '',
    zoneName: a.zoneName ?? '',
    notes: a.notes ?? '',
  };
}

export default function AirbnbPage() {
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [partnerNames, setPartnerNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState('');
  const [partnerFilter, setPartnerFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [mapsModal, setMapsModal] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, names] = await Promise.all([getAirbnbs(), getPartnerNamesDB()]);
    setApartments(a);
    setPartnerNames(names);
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

  function openCreate() { setEditingId(null); setForm(emptyForm); setShowForm(true); }
  function openEdit(a: Apartment) {
    setEditingId(a.id); setForm(aptToForm(a)); setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function closeForm() { setShowForm(false); setEditingId(null); setForm(emptyForm); }

  // Filtres : par partenaire + recherche texte
  const partners = Array.from(new Set(apartments.map(a => a.partnerName).filter(Boolean) as string[])).sort();
  const visible = apartments.filter(a => {
    if (partnerFilter !== 'all' && (a.partnerName ?? '') !== partnerFilter) return false;
    const q = search.toLowerCase();
    return !q || a.name.toLowerCase().includes(q) || a.address.toLowerCase().includes(q) || (a.partnerName ?? '').toLowerCase().includes(q);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name: form.name,
      address: form.address,
      structureType: form.structureType || 'apartment',
      structureLabel: form.structureType === 'other' ? (form.structureLabel || undefined) : undefined,
      partnerName: form.partnerName || undefined,
      portalCode: form.portalCode || undefined,
      keyboxCode: form.keyboxCode || undefined,
      entryDirectives: form.entryDirectives,
      bedrooms: form.bedrooms ? Number(form.bedrooms) : undefined,
      beds: form.beds ? Number(form.beds) : undefined,
      sofaBeds: form.sofaBeds ? Number(form.sofaBeds) : undefined,
      clientPrice: form.clientPrice ? Number(form.clientPrice) : undefined,
      estimatedCleaningMinutes: form.estimatedMinutes ? Number(form.estimatedMinutes) : 60,
      zoneColor: form.zoneColor || undefined,
      zoneName: form.zoneName || undefined,
      notes: form.notes || undefined,
    };

    // Identifiant de l'appartement (existant ou nouvellement créé) pour le géocodage.
    const aptId = editingId ? (await updateAirbnb(editingId, payload), editingId) : await createAirbnb(payload);
    // Géocode l'adresse → lat/long (zone calculée ensuite via « Générer les zones »).
    if (aptId) {
      const geo = await geocodeAddress(form.address);
      if (geo) await setAirbnbCoordsDB(aptId, geo.lat, geo.lon);
    }

    await load();
    closeForm();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cet appartement ?')) return;
    await deleteAirbnb(id);
    await load();
  }

  if (loading) return <Loading className="p-4 md:p-6 text-sm" />;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      {mapsModal && <MapsModal address={mapsModal} onClose={() => setMapsModal(null)} />}

      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Sites</h1>
          <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>{apartments.length} site{apartments.length > 1 ? 's' : ''} (logements, bureaux, salles de sport…)</p>
        </div>
        <button onClick={() => (showForm ? closeForm() : openCreate())} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ backgroundColor: showForm ? '#F5F3EF' : '#C9A84C', color: showForm ? '#7A7068' : '#1A1A1A' }}>
          <span>{showForm ? '✕' : '+'}</span>
          {showForm ? 'Annuler' : 'Ajouter un site'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border p-6 mb-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <h2 className="font-semibold mb-5" style={{ color: '#1A1A1A' }}>{editingId ? 'Modifier le site' : 'Nouveau site'}</h2>
          <datalist id="partner-names">
            {partnerNames.map(n => <option key={n} value={n} />)}
          </datalist>

          {/* Type de site : appartement (défaut), bureau, salle de sport, autre. */}
          <div className="mb-4">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Type de site</label>
            <div className="flex gap-2 flex-wrap">
              {(['apartment', 'office', 'gym', 'other'] as const).map(t => (
                <button key={t} type="button" onClick={() => setForm(p => ({ ...p, structureType: t }))}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all"
                  style={{ borderColor: form.structureType === t ? '#C9A84C' : '#E8E4DC', backgroundColor: form.structureType === t ? '#C9A84C12' : '#FFFFFF', color: form.structureType === t ? '#C9A84C' : '#7A7068' }}>
                  {STRUCTURE_LABEL[t]}
                </button>
              ))}
            </div>
            {form.structureType === 'other' && (
              <input value={form.structureLabel} onChange={e => setForm(p => ({ ...p, structureLabel: e.target.value }))}
                placeholder="Préciser le type (ex : cabinet médical)" className="mt-3 w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {[
              { label: 'Nom', key: 'name', placeholder: 'Studio Bellecour', required: true, list: undefined },
              { label: 'Adresse complète', key: 'address', placeholder: '12 Rue de la Paix, Lyon', required: true, list: undefined },
              { label: 'Partenaire / conciergerie', key: 'partnerName', placeholder: 'Hosting Services Lyon', required: false, list: 'partner-names' },
              { label: 'Code portail — optionnel', key: 'portalCode', placeholder: '1234A', required: false, list: undefined },
              { label: 'Code boîte à clé — optionnel', key: 'keyboxCode', placeholder: 'B#4512', required: false, list: undefined },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>{f.label}</label>
                <input required={f.required} list={f.list} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder} className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
            ))}
            {/* Chambres/lits/canapé — uniquement pour un logement (appartement). */}
            {form.structureType === 'apartment' && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Chambres</label>
                <input type="number" min="0" value={form.bedrooms} onChange={e => setForm(p => ({ ...p, bedrooms: e.target.value }))}
                  placeholder="2" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Lits</label>
                <input type="number" min="0" value={form.beds} onChange={e => setForm(p => ({ ...p, beds: e.target.value }))}
                  placeholder="3" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Canapé-lit</label>
                <input type="number" min="0" value={form.sofaBeds} onChange={e => setForm(p => ({ ...p, sofaBeds: e.target.value }))}
                  placeholder="1" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
            </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Prix client / ménage (€)</label>
                <input type="number" min="0" step="0.01" value={form.clientPrice} onChange={e => setForm(p => ({ ...p, clientPrice: e.target.value }))}
                  placeholder="Ex : 45" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Temps estimé de nettoyage (min)</label>
                <input required type="number" min="5" step="5" value={form.estimatedMinutes} onChange={e => setForm(p => ({ ...p, estimatedMinutes: e.target.value }))}
                  placeholder="60" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Zone couleur — optionnel (sinon calculée automatiquement par proximité)</label>
              <div className="flex flex-wrap gap-2 items-center">
                <button type="button" onClick={() => setForm(p => ({ ...p, zoneColor: '', zoneName: '' }))}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium border transition-all"
                  style={{ borderColor: !form.zoneColor ? '#C9A84C' : '#E8E4DC', backgroundColor: !form.zoneColor ? '#C9A84C12' : '#FFFFFF', color: !form.zoneColor ? '#C9A84C' : '#7A7068' }}>
                  Auto
                </button>
                {ZONE_PALETTE.map(z => (
                  <button key={z.key} type="button" onClick={() => setForm(p => ({ ...p, zoneColor: z.hex, zoneName: z.name }))}
                    title={z.name}
                    className="w-7 h-7 rounded-full transition-all"
                    style={{ backgroundColor: z.hex, outline: form.zoneColor === z.hex ? '2px solid #1A1A1A' : '2px solid transparent', outlineOffset: 2 }} />
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Directives d'entrée</label>
              <input required value={form.entryDirectives} onChange={e => setForm(p => ({ ...p, entryDirectives: e.target.value }))}
                placeholder="Instructions pour accéder au logement..." className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Notes particulières — optionnel</label>
              <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Animaux, parking, fragilités..." className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>
          </div>
          <button type="submit" disabled={saving} className="w-full sm:w-auto px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            {saving ? 'Enregistrement...' : editingId ? 'Enregistrer' : 'Ajouter le site'}
          </button>
        </form>
      )}

      <div className="relative mb-4">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#A8A09A' }}>⌕</span>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher par nom, adresse ou partenaire..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm border" style={inputStyle}
          onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
      </div>

      {/* Filtre par partenaire */}
      {partners.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {[{ v: 'all', label: 'Tous' }, ...partners.map(p => ({ v: p, label: p }))].map(({ v, label }) => (
            <button key={v} onClick={() => setPartnerFilter(v)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{
                backgroundColor: partnerFilter === v ? '#C9A84C' : '#FFFFFF',
                color: partnerFilter === v ? '#1A1A1A' : '#7A7068',
                border: `1px solid ${partnerFilter === v ? '#C9A84C' : '#E8E4DC'}`,
              }}>
              {label}
              <span className="ml-1.5 opacity-60">{v === 'all' ? apartments.length : apartments.filter(a => a.partnerName === v).length}</span>
            </button>
          ))}
        </div>
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
              <div className="px-5 py-4 border-b" style={{ borderColor: '#F2EFE9' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate" style={{ color: '#1A1A1A' }}>{apt.name}</h3>
                    <button onClick={() => setMapsModal(apt.address)}
                      className="flex items-center gap-1 mt-0.5 text-left transition-colors max-w-full"
                      style={{ color: '#A8A09A' }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#C9A84C')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#A8A09A')}>
                      <span className="text-xs shrink-0">◎</span>
                      <span className="text-xs truncate">{apt.address}</span>
                    </button>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openEdit(apt)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>Modifier</button>
                    <button onClick={() => handleDelete(apt.id)} className="text-xs px-2.5 py-1.5 rounded-lg" style={{ backgroundColor: '#B85A5010', color: '#B85A50' }}>✕</button>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {apt.partnerName && (
                    <span className="inline-block text-xs px-2.5 py-1 rounded-lg font-medium" style={{ backgroundColor: '#C9A84C15', color: '#C9A84C' }}>
                      {apt.partnerName}
                    </span>
                  )}
                  {/* Type de site (badge) — affiché pour les non-appartements. */}
                  {apt.structureType && apt.structureType !== 'apartment' && (
                    <span className="text-xs px-2.5 py-1 rounded-lg font-medium" style={{ backgroundColor: '#7C5CBF12', color: '#7C5CBF' }}>
                      {structureLabel(apt.structureType, apt.structureLabel)}
                    </span>
                  )}
                  {apt.zoneName && (
                    <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg font-medium" style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}>
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: apt.zoneColor ?? '#9CA3AF' }} />
                      {apt.zoneName}
                    </span>
                  )}
                </div>
              </div>

              <div className="px-5 py-4 space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  {apt.clientPrice != null && (
                    <p className="text-sm font-semibold" style={{ color: '#5A8A6A' }}>{apt.clientPrice}€ <span className="text-xs font-normal" style={{ color: '#A8A09A' }}>/ ménage</span></p>
                  )}
                  {apt.estimatedCleaningMinutes != null && (
                    <p className="text-sm font-semibold" style={{ color: '#C9A84C' }}>{formatDuration(apt.estimatedCleaningMinutes)} <span className="text-xs font-normal" style={{ color: '#A8A09A' }}>de ménage</span></p>
                  )}
                </div>
                {(apt.bedrooms != null || apt.beds != null || apt.sofaBeds != null) && (
                  <p className="text-xs" style={{ color: '#7A7068' }}>
                    {apt.bedrooms != null && <>{apt.bedrooms} chambre{apt.bedrooms > 1 ? 's' : ''}</>}
                    {apt.bedrooms != null && (apt.beds != null || apt.sofaBeds != null) && ' · '}
                    {apt.beds != null && <>{apt.beds} lit{apt.beds > 1 ? 's' : ''}</>}
                    {apt.beds != null && apt.sofaBeds != null && ' · '}
                    {apt.sofaBeds != null && <>{apt.sofaBeds} canapé-lit{apt.sofaBeds > 1 ? 's' : ''}</>}
                  </p>
                )}
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
                <div className="flex items-start gap-3">
                  <span className="text-xs w-28 shrink-0 mt-0.5" style={{ color: '#A8A09A' }}>Entrée</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm leading-snug" style={{
                      color: '#7A7068',
                      ...(isLong && !isExpanded ? { overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' } : {}),
                    }}>
                      {apt.entryDirectives}
                    </p>
                    {isLong && (
                      <button onClick={() => toggleExpand(apt.id)} className="text-xs mt-1.5 font-medium" style={{ color: '#C9A84C' }}>
                        {isExpanded ? 'Voir moins ↑' : 'Voir plus ↓'}
                      </button>
                    )}
                  </div>
                </div>
                {apt.notes && (
                  <div className="px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>{apt.notes}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
