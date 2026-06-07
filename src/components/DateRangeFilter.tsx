'use client';

import { PRESETS, presetRange, activePreset, formatRangeLabel, type DateRange } from '@/lib/dateRange';

const dateInputStyle = {
  borderColor: '#E8E4DC',
  backgroundColor: '#FAFAF8',
  color: '#1A1A1A',
  outline: 'none',
} as const;

// Filtre par période réutilisable : raccourcis (Aujourd'hui / Demain / Cette
// semaine / Ce mois) + deux sélecteurs Du/Au. Les <input type="date"> n'ouvrent
// un calendrier qu'au clic — aucun grand calendrier déployé en permanence.
export default function DateRangeFilter({
  start,
  end,
  onChange,
  className = '',
}: {
  start: string;
  end: string;
  onChange: (range: DateRange) => void;
  className?: string;
}) {
  const active = activePreset(start, end);

  return (
    <div className={`rounded-2xl border ${className}`} style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      {/* En-tête : libellé + résumé de la période sélectionnée */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-3 border-b" style={{ borderColor: '#F2EFE9' }}>
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Période</span>
        <span className="text-xs font-semibold truncate" style={{ color: '#C9A84C' }}>{formatRangeLabel(start, end)}</span>
      </div>

      <div className="p-4 space-y-3">
        {/* Raccourcis */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => {
            const isActive = active === p.key;
            return (
              <button key={p.key} type="button"
                onClick={() => onChange(presetRange(p.key))}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium border transition-all"
                style={
                  isActive
                    ? { backgroundColor: '#C9A84C', borderColor: '#C9A84C', color: '#1A1A1A' }
                    : { backgroundColor: '#FFFFFF', borderColor: '#E8E4DC', color: '#7A7068' }
                }>
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Du → Au */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="block text-[11px] font-medium mb-1.5" style={{ color: '#A8A09A' }}>Du</label>
            <input type="date" value={start}
              onChange={e => onChange({ start: e.target.value, end: e.target.value > end ? e.target.value : end })}
              className="w-full px-3 py-2.5 rounded-xl text-sm border transition-colors"
              style={dateInputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
          </div>
          <span className="pb-3 text-sm shrink-0" style={{ color: '#C8C2BA' }}>→</span>
          <div className="flex-1">
            <label className="block text-[11px] font-medium mb-1.5" style={{ color: '#A8A09A' }}>Au</label>
            <input type="date" value={end} min={start}
              onChange={e => onChange({ start, end: e.target.value })}
              className="w-full px-3 py-2.5 rounded-xl text-sm border transition-colors"
              style={dateInputStyle}
              onFocus={e => (e.currentTarget.style.borderColor = '#C9A84C')}
              onBlur={e => (e.currentTarget.style.borderColor = '#E8E4DC')} />
          </div>
        </div>
      </div>
    </div>
  );
}
