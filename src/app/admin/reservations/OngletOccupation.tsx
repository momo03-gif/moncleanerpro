'use client';

// Onglet « Occupation » : l'état de chaque logement — occupé, prochain départ,
// ménage prévu ou non. Les logements sans séjour connu ne sont pas listés.

import type { Apartment, Reservation } from '@/lib/types';
import Icon from '@/components/Icon';
import { fmtDate, carte } from './commun';

export interface AptOccupancy {
  apt: Apartment;
  occupied: boolean;
  currentCheckOut?: string;       // départ du séjour en cours
  nextDeparture?: Reservation;    // 1er départ >= aujourd'hui
  nextArrival?: string;           // 1re arrivée >= aujourd'hui
}

export default function OngletOccupation({ occupation }: { occupation: AptOccupancy[] }) {
  const lignes = occupation.filter(o => o.occupied || o.nextDeparture);
  if (lignes.length === 0) {
    return (
      <div className="rounded-2xl p-10 text-center border" style={carte}>
        <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune réservation active. Connectez des calendriers dans l’onglet Calendriers.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border overflow-hidden" style={carte}>
      {lignes.map(o => {
        const turnover = o.nextDeparture && o.nextArrival && o.nextArrival === o.nextDeparture.checkOut;
        return (
          <div key={o.apt.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b last:border-0" style={{ borderColor: '#F2EFE9' }}>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{o.apt.name}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs" style={{ color: '#7A7068' }}>
                {o.occupied && <span style={{ color: '#5B6EF5' }}>Occupé jusqu&apos;au {fmtDate(o.currentCheckOut!)}</span>}
                {o.nextDeparture && <span>Départ {fmtDate(o.nextDeparture.checkOut)}</span>}
                {turnover && <span className="font-semibold" style={{ color: '#B91C1C' }}>Arrivée le jour même</span>}
              </div>
            </div>
            <div className="shrink-0 text-right">
              {o.nextDeparture ? (
                o.nextDeparture.missionId ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: '#5A8A6A15', color: '#5A8A6A' }}>
                    <Icon name="check" size={12} /> Ménage créé
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: '#B85A5015', color: '#B85A50' }}>
                    Ménage à prévoir
                  </span>
                )
              ) : (
                <span className="text-[11px] px-2 py-1 rounded-full" style={{ backgroundColor: '#6B728018', color: '#6B7280' }}>Libre</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
