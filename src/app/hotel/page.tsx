'use client';

import { useState } from 'react';
import { AnnounceType } from '@/lib/types';

const TYPES: { value: AnnounceType; label: string; desc: string }[] = [
  { value: 'menage', label: 'Ménage', desc: 'Nettoyage courant' },
  { value: 'checkin', label: 'Check-in', desc: 'Préparation arrivée' },
  { value: 'checkout', label: 'Check-out', desc: 'Remise en état' },
  { value: 'grand_menage', label: 'Grand ménage', desc: 'Nettoyage complet' },
];

const inputStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid #E8E4DC',
  color: '#1A1A1A',
  outline: 'none',
};

export default function HotelDemandePage() {
  const [form, setForm] = useState({
    type: '' as AnnounceType | '',
    date: '',
    timeStart: '',
    timeEnd: '',
    guestCount: '',
    instructions: '',
  });
  const [submitted, setSubmitted] = useState(false);

  const isValid = form.type && form.date && form.timeStart && form.timeEnd && form.guestCount;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isValid) setSubmitted(true);
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
          <button
            onClick={() => { setSubmitted(false); setForm({ type: '', date: '', timeStart: '', timeEnd: '', guestCount: '', instructions: '' }); }}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}
          >
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
          <div className="grid grid-cols-2 gap-2">
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

        {/* Date */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Date</p>
          <input
            type="date"
            value={form.date}
            onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
            required
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-4 py-3 rounded-xl text-sm border"
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
            onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')}
          />
        </div>

        {/* Horaires */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Horaires</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Début</label>
              <input
                type="time"
                value={form.timeStart}
                onChange={e => setForm(p => ({ ...p, timeStart: e.target.value }))}
                required
                className="w-full px-4 py-3 rounded-xl text-sm border"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')}
              />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Fin</label>
              <input
                type="time"
                value={form.timeEnd}
                onChange={e => setForm(p => ({ ...p, timeEnd: e.target.value }))}
                required
                className="w-full px-4 py-3 rounded-xl text-sm border"
                style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
                onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')}
              />
            </div>
          </div>
        </div>

        {/* Personnes */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Nombre de personnes</p>
          <div className="flex gap-2">
            {['1', '2', '3', '4', '5', '6+'].map(n => (
              <button
                key={n}
                type="button"
                onClick={() => setForm(p => ({ ...p, guestCount: n }))}
                className="flex-1 py-3 rounded-xl text-sm font-semibold border transition-all"
                style={{
                  borderColor: form.guestCount === n ? '#C9A84C' : '#E8E4DC',
                  backgroundColor: form.guestCount === n ? '#C9A84C' : '#FFFFFF',
                  color: form.guestCount === n ? '#1A1A1A' : '#A8A09A',
                }}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>
            Instructions <span className="normal-case font-normal tracking-normal" style={{ color: '#A8A09A' }}>— optionnel</span>
          </p>
          <textarea
            value={form.instructions}
            onChange={e => setForm(p => ({ ...p, instructions: e.target.value }))}
            rows={3}
            placeholder="Codes d'accès, consignes particulières, points d'attention..."
            className="w-full px-4 py-3 rounded-xl text-sm border resize-none"
            style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
            onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')}
          />
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
