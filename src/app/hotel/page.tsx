'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import type { AnnounceType, HotelAnnounce } from '@/lib/types';
import { readHotelPrefill } from '@/lib/hotelPrefill';
import Icon from '@/components/Icon';

const TYPE_SHORT: Record<string, string> = { menage: 'Ménage', grand_menage: 'Grand ménage', checkin: 'Check-in', checkout: 'Check-out' };

// Perf : la couche données (supabase) n'est utilisée qu'à l'envoi du formulaire.
// On l'importe en différé dans le handler → elle ne pèse pas sur le chargement
// initial de la page.
const loadDb = () => import('@/lib/db');

const TYPES: { value: AnnounceType; label: string; desc: string }[] = [
  { value: 'menage', label: 'Ménage courant', desc: 'Nettoyage régulier des chambres' },
  { value: 'grand_menage', label: 'Grand ménage', desc: 'Nettoyage approfondi complet' },
];

const inputStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E8E4DC', color: '#1A1A1A', outline: 'none' };
const today = new Date().toISOString().split('T')[0];

export default function HotelDemandePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ type: '' as AnnounceType | '', dateStart: '', dateEnd: '', timeStart: '', timeEnd: '', guestCount: '', zone: '', contact: '' });
  const [hasInstructions, setHasInstructions] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Raccourcis « Refaire » : quelques modèles distincts issus des demandes récentes.
  const [recent, setRecent] = useState<HotelAnnounce[]>([]);

  // Pré-remplissage depuis « Refaire cette demande » (historique). Les dates
  // restent vides : l'hôtel choisit toujours de nouvelles dates.
  useEffect(() => {
    const p = readHotelPrefill();
    if (!p) return;
    setForm(f => ({ ...f, type: (p.type as AnnounceType) || '', timeStart: p.timeStart || '', timeEnd: p.timeEnd || '', guestCount: p.guestCount || '' }));
    if (p.instructions) { setHasInstructions(true); setInstructions(p.instructions); }
  }, []);

  // Modèles récents (déduplication par type + chambres + horaires) pour un
  // « Refaire » en 1 tap directement sur l'accueil.
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const { getHotelByUserId, getHotelRequestsForHotelDB } = await loadDb();
        const hotel = await getHotelByUserId(user.id);
        const all = await getHotelRequestsForHotelDB(hotel?.id ?? user.id);
        const seen = new Set<string>();
        const uniq: HotelAnnounce[] = [];
        for (const a of all) {
          const key = `${a.type}|${a.guestCount}|${a.timeStart}|${a.timeEnd}`;
          if (seen.has(key)) continue;
          seen.add(key); uniq.push(a);
          if (uniq.length >= 3) break;
        }
        if (active) setRecent(uniq);
      } catch { /* silencieux */ }
    })();
    return () => { active = false; };
  }, [user]);

  function applyTemplate(a: HotelAnnounce) {
    setForm(f => ({ ...f, type: (a.type as AnnounceType) || '', timeStart: a.timeStart ?? '', timeEnd: a.timeEnd ?? '', guestCount: a.guestCount != null ? String(a.guestCount) : '' }));
    if (a.instructions) { setHasInstructions(true); setInstructions(a.instructions); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const isValid = form.type && form.dateStart && form.dateEnd && form.timeStart && form.timeEnd && form.guestCount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || !user) return;
    setLoading(true); setError('');
    try {
      const { getHotelByUserId, createHotelRequestDB } = await loadDb();
      const hotel = await getHotelByUserId(user.id);
      // Zone/étage et contact sur place sont capturés dans les instructions
      // (structurés) pour être visibles par l'équipe et l'agent, sans colonne dédiée.
      const parts: string[] = [];
      if (form.zone.trim()) parts.push(`Zone / étage : ${form.zone.trim()}`);
      if (form.contact.trim()) parts.push(`Contact sur place : ${form.contact.trim()}`);
      if (hasInstructions && instructions.trim()) parts.push(instructions.trim());
      await createHotelRequestDB({
        hotelId: hotel?.id ?? user.id,
        hotelName: user.name,
        type: form.type as string,
        dateFrom: form.dateStart,
        dateTo: form.dateEnd,
        timeFrom: form.timeStart,
        timeTo: form.timeEnd,
        persons: Number(form.guestCount) || 1,
        instructions: parts.length > 0 ? parts.join('\n') : undefined,
      });
      setSubmitted(true);
    } catch { setError('Une erreur est survenue. Réessayez.'); }
    setLoading(false);
  }

  function reset() {
    setSubmitted(false);
    setForm({ type: '', dateStart: '', dateEnd: '', timeStart: '', timeEnd: '', guestCount: '', zone: '', contact: '' });
    setHasInstructions(false); setInstructions(''); setError('');
  }

  if (submitted) return (
    <div className="p-5 flex flex-col items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#5A8A6A15', color: '#5A8A6A' }}>
          <Icon name="check" size={24} />
        </div>
        <h2 className="text-lg font-bold mb-1" style={{ color: '#1A1A1A' }}>Demande envoyée</h2>
        <p className="text-sm mb-6" style={{ color: '#A8A09A' }}>Vous serez notifié dès qu'elle est acceptée.</p>
        <div className="flex gap-2 justify-center">
          <button onClick={() => router.push('/hotel/historique')} className="px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>Voir mes demandes</button>
          <button onClick={reset} className="px-5 py-2.5 rounded-xl text-sm font-semibold border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Nouvelle demande</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-5">
      <div className="mb-6 pt-2">
        <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Nouvelle demande</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Notre équipe traite votre demande et assigne un agent</p>
      </div>

      {recent.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Refaire une demande récente</p>
          <div className="flex gap-2 flex-wrap">
            {recent.map(a => (
              <button key={a.id} type="button" onClick={() => applyTemplate(a)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-95"
                style={{ borderColor: '#E8E4DC', color: '#7A7068', backgroundColor: '#FFFFFF' }}>
                {TYPE_SHORT[a.type] ?? a.type}{a.guestCount != null ? ` · ${a.guestCount} ch.` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Type */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Type de prestation</p>
          <div className="grid grid-cols-2 gap-3">
            {TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setForm(p => ({ ...p, type: t.value }))}
                className="p-4 rounded-2xl text-left border-2 transition-all"
                style={{ borderColor: form.type === t.value ? '#C9A84C' : '#E8E4DC', backgroundColor: form.type === t.value ? '#C9A84C12' : '#FFFFFF' }}>
                <p className="text-sm font-semibold" style={{ color: form.type === t.value ? '#C9A84C' : '#1A1A1A' }}>{t.label}</p>
                <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>{t.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Période */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Période</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Du</label>
              <input type="date" value={form.dateStart} min={today} required
                onChange={e => { const v = e.target.value; setForm(p => ({ ...p, dateStart: v, dateEnd: p.dateEnd < v ? v : p.dateEnd })); }}
                className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Au</label>
              <input type="date" value={form.dateEnd} min={form.dateStart || today} required
                onChange={e => setForm(p => ({ ...p, dateEnd: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>
          </div>
        </div>

        {/* Horaires */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Horaires (chaque jour)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Début</label>
              <input type="time" value={form.timeStart} required onChange={e => setForm(p => ({ ...p, timeStart: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>
            <div>
              <label className="block text-xs mb-1.5" style={{ color: '#A8A09A' }}>Fin</label>
              <input type="time" value={form.timeEnd} required onChange={e => setForm(p => ({ ...p, timeEnd: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
                onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
            </div>
          </div>
        </div>

        {/* Chambres */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Nombre de chambres</p>
          <input type="number" min="1" inputMode="numeric" value={form.guestCount} required
            onChange={e => setForm(p => ({ ...p, guestCount: e.target.value }))}
            placeholder="Ex : 12" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
            onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
          <div className="flex gap-2 mt-2 flex-wrap">
            {['5', '10', '15', '20', '30'].map(n => (
              <button key={n} type="button" onClick={() => setForm(p => ({ ...p, guestCount: n }))}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all"
                style={{ borderColor: form.guestCount === n ? '#C9A84C' : '#E8E4DC', backgroundColor: form.guestCount === n ? '#C9A84C' : '#FFFFFF', color: form.guestCount === n ? '#1A1A1A' : '#A8A09A' }}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Zone / étage + contact (optionnels) */}
        <div className="grid grid-cols-1 gap-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Zone / étage — optionnel</label>
            <input type="text" value={form.zone} onChange={e => setForm(p => ({ ...p, zone: e.target.value }))}
              placeholder="Ex : 3e étage, aile B" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Contact sur place — optionnel</label>
            <input type="text" value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))}
              placeholder="Ex : Marie · 06 12 34 56 78" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
          </div>
        </div>

        {/* Instructions */}
        <div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div onClick={() => setHasInstructions(v => !v)}
              className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all"
              style={{ borderColor: hasInstructions ? '#C9A84C' : '#C8C2BA', backgroundColor: hasInstructions ? '#C9A84C' : '#FFFFFF' }}>
              {hasInstructions && <span className="text-xs font-bold" style={{ color: '#1A1A1A' }}>✓</span>}
            </div>
            <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>Instructions particulières</span>
          </label>
          {hasInstructions && (
            <textarea value={instructions} onChange={e => setInstructions(e.target.value)} rows={3} autoFocus
              placeholder="Ex : 15 chambres dont 8 départs et 7 arrivées..."
              className="w-full mt-3 px-4 py-3 rounded-xl text-sm border resize-none" style={inputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')} onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
          )}
        </div>

        {error && <p className="text-xs text-center py-2 px-3 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#B85A50' }}>{error}</p>}

        <button type="submit" disabled={!isValid || loading} className="w-full py-4 rounded-xl font-semibold text-sm transition-all disabled:opacity-40" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
          {loading ? 'Envoi...' : 'Envoyer la demande'}
        </button>
      </form>
    </div>
  );
}
