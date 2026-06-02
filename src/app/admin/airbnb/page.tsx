'use client';

import { useState } from 'react';
import { APARTMENTS, USERS } from '@/lib/mockData';
import { Apartment } from '@/lib/types';

const cleaners = USERS.filter(u => u.role === 'cleaner');

const inputStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E8E4DC',
  color: '#1A1A1A',
  outline: 'none',
};

export default function AirbnbPage() {
  const [apartments, setApartments] = useState<Apartment[]>(APARTMENTS);
  const [showForm, setShowForm] = useState(false);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [selectedCleaner, setSelectedCleaner] = useState('');
  const [form, setForm] = useState({ name: '', address: '', accessCode: '', entryDirectives: '' });

  function handleAddApartment(e: React.FormEvent) {
    e.preventDefault();
    const newApt: Apartment = {
      id: `ap${Date.now()}`,
      ...form,
    };
    setApartments(prev => [...prev, newApt]);
    setForm({ name: '', address: '', accessCode: '', entryDirectives: '' });
    setShowForm(false);
  }

  function handleAssign(aptId: string) {
    if (!selectedCleaner) return;
    const cleaner = cleaners.find(c => c.id === selectedCleaner);
    setApartments(prev =>
      prev.map(a => a.id === aptId ? { ...a, cleanerId: cleaner?.id, cleanerName: cleaner?.name } : a)
    );
    setAssignId(null);
    setSelectedCleaner('');
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Airbnb</h1>
          <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>{apartments.length} appartement{apartments.length > 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ backgroundColor: showForm ? '#F5F3EF' : '#C9A84C', color: showForm ? '#7A7068' : '#1A1A1A' }}
        >
          <span>{showForm ? '✕' : '+'}</span>
          {showForm ? 'Annuler' : 'Ajouter un appartement'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAddApartment} className="rounded-2xl border p-6 mb-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <h2 className="font-semibold mb-5" style={{ color: '#1A1A1A' }}>Nouvel appartement</h2>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Nom</label>
              <input
                required
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex : Studio Montmartre"
                className="w-full px-4 py-3 rounded-xl text-sm border"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Adresse complète</label>
              <input
                required
                value={form.address}
                onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                placeholder="12 Rue de la Paix, Paris 75001"
                className="w-full px-4 py-3 rounded-xl text-sm border"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Code d'accès</label>
              <input
                required
                value={form.accessCode}
                onChange={e => setForm(p => ({ ...p, accessCode: e.target.value }))}
                placeholder="Ex : B#4512"
                className="w-full px-4 py-3 rounded-xl text-sm border font-mono"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Directives d'entrée</label>
              <input
                required
                value={form.entryDirectives}
                onChange={e => setForm(p => ({ ...p, entryDirectives: e.target.value }))}
                placeholder="Digicode portail, localisation clés..."
                className="w-full px-4 py-3 rounded-xl text-sm border"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')}
              />
            </div>
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}
          >
            Ajouter l'appartement
          </button>
        </form>
      )}

      {/* Apartments grid */}
      <div className="grid md:grid-cols-2 gap-4">
        {apartments.map(apt => (
          <div key={apt.id} className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
            {/* Header */}
            <div className="px-5 py-4 border-b" style={{ borderColor: '#F2EFE9' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold truncate" style={{ color: '#1A1A1A' }}>{apt.name}</h3>
                  <p className="text-xs mt-0.5 truncate" style={{ color: '#A8A09A' }}>{apt.address}</p>
                </div>
                {apt.cleanerName ? (
                  <span className="text-xs px-2 py-1 rounded-full shrink-0 font-medium" style={{ backgroundColor: '#C9A84C12', color: '#C9A84C' }}>
                    {apt.cleanerName.split(' ')[0]}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-1 rounded-full shrink-0" style={{ backgroundColor: '#F5F3EF', color: '#A8A09A' }}>
                    Non assigné
                  </span>
                )}
              </div>
            </div>

            {/* Codes */}
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-xs w-28 shrink-0" style={{ color: '#A8A09A' }}>Code d'accès</span>
                <span className="text-sm font-mono font-semibold px-2 py-0.5 rounded-lg" style={{ backgroundColor: '#F5F3EF', color: '#1A1A1A' }}>{apt.accessCode}</span>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-xs w-28 shrink-0 mt-0.5" style={{ color: '#A8A09A' }}>Entrée</span>
                <p className="text-sm leading-snug" style={{ color: '#7A7068' }}>{apt.entryDirectives}</p>
              </div>
            </div>

            {/* Action */}
            <div className="px-5 pb-4">
              {assignId === apt.id ? (
                <div className="flex gap-2">
                  <select
                    value={selectedCleaner}
                    onChange={e => setSelectedCleaner(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl text-sm border appearance-none"
                    style={{ ...inputStyle, color: selectedCleaner ? '#1A1A1A' : '#A8A09A' }}
                  >
                    <option value="">Choisir un cleaner</option>
                    {cleaners.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button
                    onClick={() => handleAssign(apt.id)}
                    disabled={!selectedCleaner}
                    className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                    style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}
                  >
                    OK
                  </button>
                  <button
                    onClick={() => { setAssignId(null); setSelectedCleaner(''); }}
                    className="px-3 py-2 rounded-xl text-sm"
                    style={{ backgroundColor: '#F5F3EF', color: '#7A7068' }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { setAssignId(apt.id); setSelectedCleaner(apt.cleanerId ?? ''); }}
                  className="w-full py-2.5 rounded-xl text-sm font-medium border transition-all"
                  style={{ borderColor: '#E8E4DC', color: '#7A7068', backgroundColor: '#FAFAF8' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#C9A84C'; e.currentTarget.style.color = '#C9A84C'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8E4DC'; e.currentTarget.style.color = '#7A7068'; }}
                >
                  {apt.cleanerName ? `Réassigner · ${apt.cleanerName}` : 'Attribuer à un cleaner'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
