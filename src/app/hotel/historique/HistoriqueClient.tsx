'use client';

// Partie interactive de l'historique hôtel (filtre de dates + liste). Les données
// sont chargées côté SERVEUR et passées en props → ce composant n'importe PAS la
// couche données (pas de supabase dans le bundle client de cette page).

import { useState } from 'react';
import type { HotelAnnounce } from '@/lib/types';
import DateRangeFilter from '@/components/DateRangeFilter';
import { presetRange, overlapsRange, type DateRange } from '@/lib/dateRange';

// Statuts côté hôtel : suivi clair du cycle de vie de la demande.
const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:     { label: 'En attente', color: '#C48A2A', bg: '#C48A2A12' },
  validated:   { label: 'Acceptée',   color: '#5B6EF5', bg: '#5B6EF512' },
  in_progress: { label: 'En cours',   color: '#C9A84C', bg: '#C9A84C18' },
  completed:   { label: 'Terminée',   color: '#5A8A6A', bg: '#5A8A6A15' },
  refused:     { label: 'Refusée',    color: '#B85A50', bg: '#B85A5012' },
  cancelled:   { label: 'Annulée',    color: '#8A8178', bg: '#8A817812' },
};

const TYPE_LABEL: Record<string, string> = { menage: 'Ménage courant', checkin: 'Check-in', checkout: 'Check-out', grand_menage: 'Grand ménage' };

export default function HistoriqueClient({ announces }: { announces: HotelAnnounce[] }) {
  const [range, setRange] = useState<DateRange>(() => presetRange('today'));

  // Demandes dont la période chevauche la période sélectionnée
  const filtered = announces.filter(a => overlapsRange(a.date, a.dateEnd, range));
  const pendingCount = filtered.filter(a => a.status === 'pending').length;
  const activeCount = filtered.filter(a => ['validated', 'in_progress'].includes(a.status)).length;
  const doneCount = filtered.filter(a => a.status === 'completed').length;

  // Bornes (1re → dernière demande) pour le bouton « voir toutes les dates »
  const allDates = announces.flatMap(a => [a.date, a.dateEnd ?? a.date]).filter(Boolean).sort();
  const outOfRangeCount = announces.length - filtered.length;

  return (
    <div className="p-5">
      <div className="mb-5 pt-2">
        <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Mes demandes</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>{filtered.length} demande{filtered.length > 1 ? 's' : ''}</p>
      </div>

      <DateRangeFilter start={range.start} end={range.end} onChange={setRange} className="mb-5" />

      {(pendingCount > 0 || activeCount > 0 || doneCount > 0) && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {pendingCount > 0 && <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#C48A2A12', color: '#C48A2A' }}><span className="w-1.5 h-1.5 rounded-full bg-current" />{pendingCount} en attente</div>}
          {activeCount > 0 && <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#C9A84C18', color: '#C9A84C' }}><span className="w-1.5 h-1.5 rounded-full bg-current" />{activeCount} en cours</div>}
          {doneCount > 0 && <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#5A8A6A15', color: '#5A8A6A' }}><span className="w-1.5 h-1.5 rounded-full bg-current" />{doneCount} terminée{doneCount > 1 ? 's' : ''}</div>}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune demande sur cette période</p>
          {outOfRangeCount > 0 && allDates.length > 0 && (
            <button onClick={() => setRange({ start: allDates[0], end: allDates[allDates.length - 1] })}
              className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
              Voir mes {outOfRangeCount} demande{outOfRangeCount > 1 ? 's' : ''} sur d'autres dates →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const st = STATUS[a.status] ?? STATUS.pending;
            return (
              <div key={a.id} className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
                <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: '#F2EFE9' }}>
                  <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{TYPE_LABEL[a.type] ?? a.type}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <div className="px-5 py-4">
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <p className="text-xs mb-1" style={{ color: '#A8A09A' }}>Période</p>
                      <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                        {new Date(a.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        {a.dateEnd && a.dateEnd !== a.date && <> → {new Date(a.dateEnd).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</>}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs mb-1" style={{ color: '#A8A09A' }}>Horaires</p>
                      <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{a.timeStart} – {a.timeEnd}</p>
                    </div>
                    <div>
                      <p className="text-xs mb-1" style={{ color: '#A8A09A' }}>Chambres</p>
                      <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{a.guestCount}</p>
                    </div>
                  </div>
                  {a.instructions && <p className="text-xs px-3 py-2 rounded-xl" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>{a.instructions}</p>}
                  {a.cleanerName && <p className="text-xs mt-2" style={{ color: '#A8A09A' }}>Cleaner : <span style={{ color: '#C9A84C', fontWeight: 600 }}>{a.cleanerName}</span></p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
