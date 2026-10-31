'use client';

// Création groupée : une mission individuelle par appartement coché.

import { useState } from 'react';
import { createMissionsBatchDB } from '@/lib/db';
import { useFeedback } from '@/contexts/FeedbackContext';
import { formatDuration, formatHour, DEPARTURE_TIMES } from '@/lib/format';
import { inputStyle } from '@/lib/ui';
import type { ProprietesCreation } from './commun';

type Props = Pick<ProprietesCreation, 'cleaners' | 'airbnbs' | 'userId' | 'onReload' | 'onGoToMissions'>;

export default function CreationGroupee({ cleaners, airbnbs, userId, onReload, onGoToMissions }: Props) {
  const { toast } = useFeedback();
  const [batchApts, setBatchApts] = useState<Set<string>>(new Set());
  const [batchDate, setBatchDate] = useState('');
  const [batchTime, setBatchTime] = useState('');
  const [batchCleaner, setBatchCleaner] = useState('');
  const [batchZone, setBatchZone] = useState('all');
  const [batchBusy, setBatchBusy] = useState(false);
  const [batchError, setBatchError] = useState('');
  const [batchDone, setBatchDone] = useState('');

  // ── Création groupée : une mission par appartement sélectionné ──
  function toggleBatchApt(id: string) {
    setBatchDone('');
    setBatchApts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleBatchCreate() {
    setBatchError(''); setBatchDone('');
    if (batchApts.size === 0) { setBatchError('Sélectionnez au moins un appartement.'); return; }
    if (!batchDate) { setBatchError('Choisissez la date de nettoyage.'); return; }

    const c = cleaners.find(x => x.id === batchCleaner);
    const selected = airbnbs.filter(a => batchApts.has(a.id));
    const apartments = selected.map(a => ({
      airbnbId: a.id,
      partnerId: a.partnerId,
      price: a.clientPrice ?? 0,                       // prix CLIENT repris de la fiche
      durationMinutes: a.estimatedCleaningMinutes ?? 60,
      defaultDuration: a.estimatedCleaningMinutes ?? undefined,
    }));

    setBatchBusy(true);
    const res = await createMissionsBatchDB({
      apartments,
      dateFrom: batchDate,
      timeFrom: batchTime,
      cleanerId: batchCleaner || undefined,
      cleanerName: c?.name,
      cleanerHourlyRate: c?.hourly_rate ?? 0,
      createdBy: userId,
      createdByRole: 'admin',
    });
    setBatchBusy(false);

    if (res.error) { setBatchError(`Erreur Supabase : ${res.error}`); return; }
    setBatchDone(`${res.count} mission${res.count > 1 ? 's' : ''} créée${res.count > 1 ? 's' : ''}.`);
    setBatchApts(new Set());
    setBatchDate(''); setBatchTime(''); setBatchCleaner('');
    toast(`${res.count} mission${res.count > 1 ? 's' : ''} créée${res.count > 1 ? 's' : ''}.`, 'success');
    await onReload();
    onGoToMissions();
  }

  // Zones présentes parmi les appartements (filtre de la création groupée).
  const batchZones = (() => {
    const map = new Map<string, string>();
    airbnbs.forEach(a => { if (a.zoneName) map.set(a.zoneName, a.zoneColor ?? '#9CA3AF'); });
    return Array.from(map.entries()).map(([name, color]) => ({ name, color }));
  })();
  const batchVisibleApts = batchZone === 'all' ? airbnbs : airbnbs.filter(a => (a.zoneName ?? '') === batchZone);

  return (
    /* ── CRÉATION GROUPÉE (plusieurs appartements) ── */
    <div className="rounded-2xl border p-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      <h2 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>Créer plusieurs missions</h2>
      <p className="text-xs mb-6" style={{ color: '#A8A09A' }}>Une mission individuelle est créée pour chaque appartement coché.</p>

      {/* Réglages partagés */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Date de nettoyage</label>
          <input type="date" value={batchDate} onChange={e => { setBatchDate(e.target.value); setBatchDone(''); }}
            className="w-full px-4 py-3 rounded-xl text-sm border" style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Heure départ clients</label>
          <select value={batchTime} onChange={e => setBatchTime(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
            style={{ ...inputStyle, color: batchTime ? '#1A1A1A' : '#A8A09A' }}>
            <option value="">Choisir</option>
            {DEPARTURE_TIMES.map(t => <option key={t} value={t}>{formatHour(t)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#7A7068' }}>Cleaner</label>
          <select value={batchCleaner} onChange={e => setBatchCleaner(e.target.value)}
            className="w-full px-4 py-3 rounded-xl text-sm border appearance-none"
            style={{ ...inputStyle, color: batchCleaner ? '#1A1A1A' : '#A8A09A' }}>
            <option value="">Assigner plus tard</option>
            {cleaners.map(c => <option key={c.id} value={c.id}>{c.name}{c.status === 'offline' ? ' · Hors ligne' : ''}</option>)}
          </select>
        </div>
      </div>

      {/* Sélection des appartements */}
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>
          Appartements — {batchApts.size} sélectionné{batchApts.size > 1 ? 's' : ''}
        </label>
        <div className="flex gap-3">
          <button type="button" onClick={() => { setBatchDone(''); setBatchApts(prev => new Set([...prev, ...batchVisibleApts.map(a => a.id)])); }}
            className="text-xs font-medium" style={{ color: '#C9A84C' }}>Tout sélectionner</button>
          <button type="button" onClick={() => { setBatchDone(''); setBatchApts(new Set()); }}
            className="text-xs font-medium" style={{ color: '#A8A09A' }}>Effacer</button>
        </div>
      </div>

      {/* Filtre par zone (tournée) */}
      {batchZones.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap items-center">
          <button type="button" onClick={() => setBatchZone('all')}
            className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
            style={{ backgroundColor: batchZone === 'all' ? '#C9A84C' : '#FFFFFF', color: batchZone === 'all' ? '#1A1A1A' : '#7A7068', border: `1px solid ${batchZone === 'all' ? '#C9A84C' : '#E8E4DC'}` }}>
            Toutes
          </button>
          {batchZones.map(z => (
            <button type="button" key={z.name} onClick={() => setBatchZone(z.name)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={{ backgroundColor: batchZone === z.name ? '#C9A84C' : '#FFFFFF', color: batchZone === z.name ? '#1A1A1A' : '#7A7068', border: `1px solid ${batchZone === z.name ? '#C9A84C' : '#E8E4DC'}` }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: z.color }} />
              {z.name}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2 mb-6 max-h-[420px] overflow-auto pr-1">
        {batchVisibleApts.length === 0 && (
          <p className="text-sm py-6 text-center" style={{ color: '#A8A09A' }}>Aucun appartement.</p>
        )}
        {batchVisibleApts.map(a => {
          const checked = batchApts.has(a.id);
          return (
            <button type="button" key={a.id} onClick={() => toggleBatchApt(a.id)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all"
              style={{ borderColor: checked ? '#C9A84C' : '#E8E4DC', backgroundColor: checked ? '#C9A84C12' : '#FFFFFF' }}>
              <span className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all"
                style={{ borderColor: checked ? '#C9A84C' : '#C8C2BA', backgroundColor: checked ? '#C9A84C' : '#FFFFFF' }}>
                {checked && <span className="text-xs font-bold" style={{ color: '#1A1A1A' }}>✓</span>}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{a.name}</span>
                {a.address && <span className="block text-xs truncate" style={{ color: '#A8A09A' }}>{a.address}</span>}
              </span>
              {a.zoneName && (
                <span className="inline-flex items-center gap-1.5 text-xs shrink-0" style={{ color: '#7A7068' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.zoneColor ?? '#9CA3AF' }} />{a.zoneName}
                </span>
              )}
              <span className="text-xs shrink-0" style={{ color: '#A8A09A' }}>{formatDuration(a.estimatedCleaningMinutes ?? 60)}</span>
            </button>
          );
        })}
      </div>

      {batchError && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#B85A5012', color: '#B85A50' }}>{batchError}</div>
      )}
      {batchDone && (
        <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#5A8A6A15', color: '#5A8A6A' }}>{batchDone}</div>
      )}

      <button type="button" onClick={handleBatchCreate} disabled={batchBusy || batchApts.size === 0 || !batchDate}
        className="px-8 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
        style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
        {batchBusy ? 'Création...' : `Créer ${batchApts.size > 0 ? batchApts.size + ' ' : ''}mission${batchApts.size > 1 ? 's' : ''}`}
      </button>
    </div>
  );
}
