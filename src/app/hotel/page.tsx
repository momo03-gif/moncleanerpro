'use client';

import { useState } from 'react';
import { AnnounceType } from '@/lib/types';

const TYPES: { value: AnnounceType; label: string; desc: string }[] = [
  { value: 'menage',      label: 'Ménage courant', desc: 'Nettoyage régulier des chambres' },
  { value: 'grand_menage', label: 'Grand ménage',  desc: 'Nettoyage approfondi complet' },
];

const inputStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E8E4DC',
  color: '#1A1A1A',
  outline: 'none',
};

const today = new Date().toISOString().split('T')[0];

export default function HotelDemandePage() {
  const [form, setForm] = useState({
    type: '' as AnnounceType | '',
    dateStart: '',
    dateEnd: '',
    timeStart: '',
    timeEnd: '',
    guestCount: '',
  });
  const [hasInstructions, setHasInstructions] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const isValid = form.type && form.dateStart && form.dateEnd && form.timeStart && form.timeEnd && form.guestCount;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isValid) setSubmitted(true);
  }

  function reset() {
    setSubmitted(false);
    setForm({ type: '', dateStart: '', dateEnd: '', timeStart: '', timeEnd: '', guestCount: '' });
    setHasInstructions(false);
    setInstructions('');
  }

  if (submitted) {
    return (
      <div className="p-5 flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}>
            <span className="text-xl">✦</span>
          </div>
          <h2 className="text-lg font-bold mb-1" style={{ color: '#1A1A1A' }}>Annonce envoyée</h2>
          <p className="text-sm mb-6" style={{ color: '#A8A09A' }}>Vous serez notifié une fois validée.</p>
          <button onClick={reset} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            Nouvelle annonce
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5">
      <div className="mb-6 pt-2">
        <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Déposer une annonce</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Nous vous assignons le cleaner disponible</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Type */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Type de prestation</p>
          <div className="grid grid-cols-2 gap-3">
            {TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => setForm(p => ({ ...p, type: t.value }))}
                className="p-4 rounded-2xl text-left border-2 transition-all"
                style={{
                  borderColor: form.type === t.value ? '#C9A84C' : '#E8E4DC',
                  backgroundColor: form.type === t.value ? '#C9A84C12' : '#FFFFFF',
                }}
              >
                <p className="text-sm font-semibold" style={{ color: form.type === t.value ? '#C9A84C' : '#1A1A1A' }}>{t.label}</p>
                <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Dates Du / Au */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Période</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Du</label>
              <input
                type="date"
                value={form.dateStart}
                onChange={e => {
                  const v = e.target.value;
                  setForm(p => ({ ...p, dateStart: v, dateEnd: p.dateEnd < v ? v : p.dateEnd }));
                }}
                required
                min={today}
                className="w-full px-4 py-3 rounded-xl text-sm border"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Au</label>
              <input
                type="date"
                value={form.dateEnd}
                onChange={e => setForm(p => ({ ...p, dateEnd: e.target.value }))}
                required
                min={form.dateStart || today}
                className="w-full px-4 py-3 rounded-xl text-sm border"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')}
              />
            </div>
          </div>
        </div>

        {/* Horaires */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Horaires (chaque jour)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Début</label>
              <input type="time" value={form.timeStart} onChange={e => setForm(p => ({ ...p, timeStart: e.target.value }))} required
                className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Fin</label>
              <input type="time" value={form.timeEnd} onChange={e => setForm(p => ({ ...p, timeEnd: e.target.value }))} required
                className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>
          </div>
        </div>

        {/* Nombre de personnes */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Nombre de personnes</p>
          <div className="flex gap-2">
            {['1', '2', '3', '4', '5', '6+'].map(n => (
              <button key={n} type="button" onClick={() => setForm(p => ({ ...p, guestCount: n }))}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-all"
                style={{
                  borderColor: form.guestCount === n ? '#C9A84C' : '#E8E4DC',
                  backgroundColor: form.guestCount === n ? '#C9A84C' : '#FFFFFF',
                  color: form.guestCount === n ? '#1A1A1A' : '#A8A09A',
                }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Instructions particulières — checkbox + textarea conditionnel */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div
              onClick={() => setHasInstructions(v => !v)}
              className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all"
              style={{
                borderColor: hasInstructions ? '#C9A84C' : '#C8C2BA',
                backgroundColor: hasInstructions ? '#C9A84C' : '#FFFFFF',
              }}
            >
              {hasInstructions && <span className="text-xs font-bold" style={{ color: '#1A1A1A' }}>✓</span>}
            </div>
            <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>Instructions particulières</span>
          </label>

          {hasInstructions && (
            <textarea
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              rows={3}
              placeholder="Ex : 15 chambres dont 8 départs et 7 arrivées, priorité aux chambres 101-108..."
              className="w-full mt-3 px-4 py-3 rounded-xl text-sm border resize-none"
              style={inputStyle}
              autoFocus
              onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')}
            />
          )}
        </div>

        <button
          type="submit"
          disabled={!isValid}
          className="w-full py-4 rounded-xl font-semibold text-sm transition-all disabled:opacity-40"
          style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}
        >
          Envoyer l'annonce
        </button>
      </form>
    </div>
  );
}
