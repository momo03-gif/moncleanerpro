'use client';

// Intervention ponctuelle : une date, un ou plusieurs cleaners (une ligne par
// cleaner, partageant un group_id).

import { useState } from 'react';
import { createOneShotMissionDB } from '@/lib/db';
import { useFeedback } from '@/contexts/FeedbackContext';
import { canCleanerDoService } from '@/lib/service';
import { inputStyle } from '@/lib/ui';
import { resolveCoords, type ProprietesCreation } from './commun';

type Props = Pick<ProprietesCreation, 'cleaners' | 'airbnbs' | 'userId' | 'onReload' | 'onGoToMissions'>;

export default function CreationPonctuelle({ cleaners, airbnbs, userId, onReload, onGoToMissions }: Props) {
  const { toast } = useFeedback();
  const [osForm, setOsForm] = useState({ siteId: '', property: '', address: '', date: '', time: '', durationMinutes: '120', price: '', instructions: '' });
  const [osCleaners, setOsCleaners] = useState<Set<string>>(new Set());
  const [osBusy, setOsBusy] = useState(false);
  const [osError, setOsError] = useState('');

  // ── Intervention ponctuelle (one-shot) ──
  function selectOsSite(id: string) {
    const a = airbnbs.find(x => x.id === id);
    setOsForm(p => ({
      ...p, siteId: id,
      property: a?.name ?? p.property,
      address: a?.address ?? p.address,
      durationMinutes: a?.estimatedCleaningMinutes != null ? String(a.estimatedCleaningMinutes) : p.durationMinutes,
      price: a?.clientPrice != null ? String(a.clientPrice) : p.price,
    }));
  }
  async function handleCreateOneShot(e: React.FormEvent) {
    e.preventDefault();
    if (!osForm.property.trim() || !osForm.date) { setOsError('Nom du site et date requis.'); return; }
    setOsBusy(true); setOsError('');
    const chosen = cleaners.filter(c => osCleaners.has(c.id)).map(c => ({ id: c.id, name: c.name, hourlyRate: c.hourly_rate }));
    const coords = await resolveCoords(airbnbs, osForm.siteId, osForm.address);
    const res = await createOneShotMissionDB({
      propertyName: osForm.property.trim(), address: osForm.address, date: osForm.date, time: osForm.time,
      durationMinutes: Number(osForm.durationMinutes) || 0, price: Number(osForm.price) || 0,
      instructions: osForm.instructions, addressLat: coords.lat, addressLng: coords.lng,
      cleaners: chosen, createdBy: userId,
    });
    setOsBusy(false);
    if (res.error) { setOsError(res.error); return; }
    setOsForm({ siteId: '', property: '', address: '', date: '', time: '', durationMinutes: '120', price: '', instructions: '' });
    setOsCleaners(new Set());
    toast('Intervention ponctuelle créée.', 'success');
    await onReload(); onGoToMissions();
  }

  return (
    /* ── INTERVENTION PONCTUELLE (one-shot, plusieurs cleaners) ── */
    <form onSubmit={handleCreateOneShot} className="rounded-2xl border p-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      <h2 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>Intervention ponctuelle</h2>
      <p className="text-xs mb-6" style={{ color: '#A8A09A' }}>Une intervention unique à une date, réalisée par un ou plusieurs cleaners (ex. gros ménage).</p>

      <div className="mb-4">
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Site (facultatif — pré-remplit)</label>
        <select value={osForm.siteId} onChange={e => selectOsSite(e.target.value)}
          className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
          style={{ ...inputStyle, color: osForm.siteId ? '#1A1A1A' : '#A8A09A' }}>
          <option value="">Saisie libre</option>
          {airbnbs.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Nom / lieu</label>
          <input value={osForm.property} onChange={e => setOsForm(p => ({ ...p, property: e.target.value }))}
            placeholder="Ex : Salle de sport FitClub" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Adresse</label>
          <input value={osForm.address} onChange={e => setOsForm(p => ({ ...p, address: e.target.value }))}
            placeholder="Adresse" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Date</label>
          <input type="date" value={osForm.date} onChange={e => setOsForm(p => ({ ...p, date: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Heure</label>
          <input type="time" value={osForm.time} onChange={e => setOsForm(p => ({ ...p, time: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Durée (min)</label>
          <input type="number" min={0} value={osForm.durationMinutes} onChange={e => setOsForm(p => ({ ...p, durationMinutes: e.target.value }))}
            className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
        </div>
      </div>

      <div className="mb-4 md:w-1/3">
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Prix client (€)</label>
        <input type="number" min={0} step="0.01" value={osForm.price} onChange={e => setOsForm(p => ({ ...p, price: e.target.value }))}
          placeholder="0" className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
      </div>

      <div className="mb-4">
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>
          Cleaners — {osCleaners.size} sélectionné{osCleaners.size > 1 ? 's' : ''}
        </label>
        <div className="flex flex-wrap gap-2">
          {cleaners.filter(c => canCleanerDoService(c, 'cleaning')).map(c => {
            const on = osCleaners.has(c.id);
            return (
              <button type="button" key={c.id}
                onClick={() => setOsCleaners(prev => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
                className="px-3 py-2 rounded-xl text-sm font-medium border-2 transition-all"
                style={{ borderColor: on ? '#C9A84C' : '#E8E4DC', backgroundColor: on ? '#C9A84C12' : '#FFFFFF', color: on ? '#C9A84C' : '#7A7068' }}>
                {on ? '✓ ' : ''}{c.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Consignes</label>
        <textarea value={osForm.instructions} onChange={e => setOsForm(p => ({ ...p, instructions: e.target.value }))}
          rows={2} placeholder="Détails de l'intervention, accès, matériel…"
          className="w-full px-4 py-3 rounded-xl text-sm border resize-none" style={inputStyle} />
      </div>

      {osError && <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#B85A5012', color: '#B85A50' }}>{osError}</div>}
      <button type="submit" disabled={osBusy}
        className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
        style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
        {osBusy ? 'Création...' : `Créer l'intervention${osCleaners.size > 1 ? ` (${osCleaners.size} intervenants)` : ''}`}
      </button>
    </form>
  );
}
