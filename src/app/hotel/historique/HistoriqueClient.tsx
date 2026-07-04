'use client';

// Suivi des demandes hôtel. Les données sont chargées côté SERVEUR et passées en
// props → ce composant n'importe PAS la couche données (pas de supabase dans le
// bundle de la page). Deux sections : « En cours » (demandes actives, toujours
// visibles) et « Historique » (demandes closes, filtrées par dates).

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { HotelAnnounce } from '@/lib/types';
import DateRangeFilter from '@/components/DateRangeFilter';
import { presetRange, overlapsRange, type DateRange } from '@/lib/dateRange';
import { writeHotelPrefill } from '@/lib/hotelPrefill';

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

// Demandes « actives » (en cours de traitement) vs closes (historique).
const ACTIVE_STATUSES = new Set(['pending', 'validated', 'in_progress']);

// Frise de progression d'une demande (masquée si refusée/annulée : le badge suffit).
const STEPS = ['Envoyée', 'Acceptée', 'En cours', 'Terminée'];
const STEP_INDEX: Record<string, number> = { pending: 0, validated: 1, in_progress: 2, completed: 3 };

function StatusTimeline({ status }: { status: string }) {
  const idx = STEP_INDEX[status];
  if (idx === undefined) return null;
  return (
    <div className="flex items-start gap-0 mb-3">
      {STEPS.map((label, i) => (
        <div key={i} className="flex-1 flex flex-col items-center">
          <div className="flex items-center w-full">
            <div className="h-0.5 flex-1" style={{ backgroundColor: i === 0 ? 'transparent' : i <= idx ? '#C9A84C' : '#E8E4DC' }} />
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: i <= idx ? '#C9A84C' : '#E8E4DC' }} />
            <div className="h-0.5 flex-1" style={{ backgroundColor: i === STEPS.length - 1 ? 'transparent' : i < idx ? '#C9A84C' : '#E8E4DC' }} />
          </div>
          <span className="text-[9px] mt-1 text-center leading-tight" style={{ color: i <= idx ? '#7A7068' : '#C2BBB2', fontWeight: i === idx ? 700 : 400 }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function RequestCard({ a, onReuse, onCancel, cancelBusy, cancelError }: {
  a: HotelAnnounce;
  onReuse: (a: HotelAnnounce) => void;
  onCancel: (a: HotelAnnounce) => void;
  cancelBusy: string | null;
  cancelError: { id: string; msg: string } | null;
}) {
  const st = STATUS[a.status] ?? STATUS.pending;
  return (
    <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
      <div className="px-5 py-3 flex items-center justify-between border-b" style={{ borderColor: '#F2EFE9' }}>
        <span className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{TYPE_LABEL[a.type] ?? a.type}</span>
        <span className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
      </div>
      <div className="px-5 py-4">
        <StatusTimeline status={a.status} />
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
        {a.instructions && <p className="text-xs px-3 py-2 rounded-xl whitespace-pre-line" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>{a.instructions}</p>}
        {a.cleanerName && <p className="text-xs mt-2" style={{ color: '#A8A09A' }}>Agent : <span style={{ color: '#C9A84C', fontWeight: 600 }}>{a.cleanerName}</span></p>}

        {cancelError?.id === a.id && (
          <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#B85A50' }}>{cancelError.msg}</p>
        )}

        {a.status === 'pending' && (
          <button onClick={() => onCancel(a)} disabled={cancelBusy === a.id}
            className="mt-3 w-full py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.99] disabled:opacity-50"
            style={{ borderColor: '#EAC4BE', color: '#B85A50', backgroundColor: '#FFFFFF' }}>
            {cancelBusy === a.id ? 'Annulation…' : 'Annuler la demande'}
          </button>
        )}
        {['completed', 'refused', 'cancelled'].includes(a.status) && (
          <button onClick={() => onReuse(a)}
            className="mt-3 w-full py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-[0.99]"
            style={{ borderColor: '#E8E4DC', color: '#7A7068', backgroundColor: '#FAFAF8' }}>
            Refaire cette demande
          </button>
        )}
      </div>
    </div>
  );
}

export default function HistoriqueClient({ announces }: { announces: HotelAnnounce[] }) {
  const router = useRouter();
  const [range, setRange] = useState<DateRange>(() => presetRange('today'));
  // Copie locale (les données viennent du serveur) pour refléter une annulation
  // immédiatement, tout en resynchronisant quand le serveur renvoie des données fraîches.
  const [list, setList] = useState(announces);
  useEffect(() => { setList(announces); }, [announces]);
  const [cancelBusy, setCancelBusy] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<{ id: string; msg: string } | null>(null);

  function reuse(a: HotelAnnounce) {
    writeHotelPrefill({
      type: a.type,
      timeStart: a.timeStart ?? '',
      timeEnd: a.timeEnd ?? '',
      guestCount: a.guestCount != null ? String(a.guestCount) : '',
      instructions: a.instructions ?? '',
    });
    router.push('/hotel');
  }

  async function cancelRequest(a: HotelAnnounce) {
    if (!confirm('Annuler cette demande ?')) return;
    setCancelBusy(a.id); setCancelError(null);
    // Import différé de la couche données (garde supabase hors du bundle de la page).
    const { cancelHotelRequestDB } = await import('@/lib/db');
    const res = await cancelHotelRequestDB(a.id);
    setCancelBusy(null);
    if (res.error) { setCancelError({ id: a.id, msg: res.error }); return; }
    setList(prev => prev.map(x => x.id === a.id ? { ...x, status: 'cancelled' } : x));
    router.refresh();
  }

  // En cours (toujours visibles, triées par date la plus proche en premier).
  const active = list
    .filter(a => ACTIVE_STATUSES.has(a.status))
    .sort((x, y) => (x.date + (x.timeStart || '')).localeCompare(y.date + (y.timeStart || '')));

  // Historique (demandes closes), filtré par la période sélectionnée, plus récent d'abord.
  const past = list.filter(a => !ACTIVE_STATUSES.has(a.status));
  const pastFiltered = past
    .filter(a => overlapsRange(a.date, a.dateEnd, range))
    .sort((x, y) => y.date.localeCompare(x.date));
  const pastDates = past.flatMap(a => [a.date, a.dateEnd ?? a.date]).filter(Boolean).sort();
  const pastOutOfRange = past.length - pastFiltered.length;

  const cardProps = { onReuse: reuse, onCancel: cancelRequest, cancelBusy, cancelError };

  return (
    <div className="p-5">
      <div className="mb-5 pt-2">
        <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Mes demandes</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>
          {active.length > 0 ? `${active.length} en cours` : 'Aucune demande en cours'}
        </p>
      </div>

      {/* ── EN COURS ─────────────────────────────────────────────────────── */}
      <h2 className="text-sm font-bold mb-3" style={{ color: '#1A1A1A' }}>En cours</h2>
      {active.length === 0 ? (
        <div className="rounded-2xl p-6 text-center border mb-8" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune demande en cours</p>
          <button onClick={() => router.push('/hotel')}
            className="mt-3 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
            Nouvelle demande
          </button>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {active.map(a => <RequestCard key={a.id} a={a} {...cardProps} />)}
        </div>
      )}

      {/* ── HISTORIQUE ───────────────────────────────────────────────────── */}
      <h2 className="text-sm font-bold mb-3" style={{ color: '#1A1A1A' }}>Historique</h2>
      <DateRangeFilter start={range.start} end={range.end} onChange={setRange} className="mb-4" />
      {pastFiltered.length === 0 ? (
        <div className="rounded-2xl p-8 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune demande terminée sur cette période</p>
          {pastOutOfRange > 0 && pastDates.length > 0 && (
            <button onClick={() => setRange({ start: pastDates[0], end: pastDates[pastDates.length - 1] })}
              className="mt-4 px-5 py-2.5 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
              Voir mes {pastOutOfRange} demande{pastOutOfRange > 1 ? 's' : ''} passée{pastOutOfRange > 1 ? 's' : ''} →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {pastFiltered.map(a => <RequestCard key={a.id} a={a} {...cardProps} />)}
        </div>
      )}
    </div>
  );
}
