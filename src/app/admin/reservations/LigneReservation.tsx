'use client';

// Une réservation dans une liste (départs à venir, séjours terminés), avec ce
// que la plateforme a réellement envoyé pour elle, à la demande.

import { useState } from 'react';
import type { Reservation } from '@/lib/types';
import { platformLabel } from '@/lib/pms/registry';
import Icon from '@/components/Icon';
import { RES_STATUS, fmtDate, daysBetween } from './commun';

interface Detail {
  evenement: { uid?: string | null; summary?: string | null; start?: string | null; end?: string | null; status?: string | null };
  calendrier: { label?: string | null; platform?: string | null; hote?: string | null };
}

export default function LigneReservation({ r, passe, enCreation, onCreerMenage }: {
  r: Reservation;
  passe?: boolean;
  enCreation?: boolean;
  onCreerMenage?: (id: string) => void;
}) {
  // Une réservation qui paraît fausse ne se diagnostique qu'en regardant la
  // donnée brute envoyée par la plateforme.
  const [detail, setDetail] = useState<Detail | 'chargement' | 'erreur' | null>(null);
  const st = RES_STATUS[r.status] ?? RES_STATUS.confirmed;
  const nuits = daysBetween(r.checkIn, r.checkOut);

  async function voirDetail() {
    if (detail) { setDetail(null); return; }
    setDetail('chargement');
    try {
      const res = await fetch(`/api/reservations/detail?id=${encodeURIComponent(r.id)}`);
      const data = await res.json().catch(() => ({}));
      setDetail(data.ok ? data : 'erreur');
    } catch { setDetail('erreur'); }
  }

  return (
    <div className="border-b last:border-0" style={{ borderColor: '#F2EFE9' }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3" style={{ opacity: passe ? 0.6 : 1 }}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{r.apartmentName ?? '—'}</p>
          <p className="text-xs mt-0.5" style={{ color: '#7A7068' }}>
            {platformLabel(r.platform)} · {fmtDate(r.checkIn)} → <span className="font-semibold" style={{ color: '#1A1A1A' }}>{fmtDate(r.checkOut)}</span>
            {nuits > 0 && <> · {nuits} nuit{nuits > 1 ? 's' : ''}</>}
          </p>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
        <div className="w-28 text-right">
          {r.missionId ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#5A8A6A' }}><Icon name="check" size={13} /> Ménage créé</span>
          ) : r.status === 'confirmed' ? (
            <span className="text-[11px]" style={{ color: '#C48A2A' }}>Ménage à venir</span>
          ) : passe || r.status === 'cancelled' || !onCreerMenage ? (
            <span className="text-[11px]" style={{ color: '#A8A09A' }}>—</span>
          ) : (
            // Ligne écartée par la synchro alors que le départ est à venir :
            // le calendrier ne sait pas dire si c'est un séjour (Booking emploie
            // le même intitulé pour un blocage). L'exploitant tranche.
            <button onClick={() => onCreerMenage(r.id)} disabled={enCreation}
              className="text-[11px] font-semibold px-2 py-1 rounded-lg border disabled:opacity-50"
              style={{ borderColor: '#C9A84C', color: '#1A1A1A' }}>
              {enCreation ? 'Création…' : 'Créer le ménage'}
            </button>
          )}
        </div>
        <button onClick={voirDetail} className="text-[10px] underline" style={{ color: '#A8A09A' }}>
          {detail ? 'masquer' : 'détail'}
        </button>
      </div>
      {detail && (
        <div className="px-4 pb-3 text-[11px]" style={{ color: '#7A7068' }}>
          {detail === 'chargement' ? 'Lecture…'
            : detail === 'erreur' ? 'Détail indisponible.'
            : (
              <div className="grid gap-0.5 rounded-lg px-3 py-2" style={{ backgroundColor: '#FAFAF8' }}>
                <p>Calendrier : <span style={{ color: '#1A1A1A' }}>{detail.calendrier.label || detail.calendrier.platform || '—'}</span>
                  {detail.calendrier.hote ? ` (${detail.calendrier.hote})` : ''}</p>
                <p>Intitulé envoyé : <span className="font-medium" style={{ color: '#1A1A1A' }}>{detail.evenement.summary || '(vide)'}</span></p>
                <p>Dates envoyées : <span style={{ color: '#1A1A1A' }}>{detail.evenement.start} → {detail.evenement.end}</span>
                  {detail.evenement.status ? ` · ${detail.evenement.status}` : ''}</p>
                <p className="break-all">Identifiant : {detail.evenement.uid || '—'}</p>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
