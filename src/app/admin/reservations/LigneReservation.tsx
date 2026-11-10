'use client';

// Une réservation dans une liste (séjours terminés), et le bloc « détail » :
// ce que la plateforme a réellement envoyé pour elle, lu à la demande. Une
// réservation qui paraît fausse ne se diagnostique qu'en regardant la donnée brute.

import { useEffect, useState } from 'react';
import type { Reservation } from '@/lib/types';
import { platformLabel } from '@/lib/pms/registry';
import { libelleVoyageurs } from '@/lib/mouvements';
import Icon from '@/components/Icon';
import { RES_STATUS, fmtDate, daysBetween } from './commun';

interface Detail {
  evenement: { uid?: string | null; summary?: string | null; start?: string | null; end?: string | null; status?: string | null };
  calendrier: { label?: string | null; platform?: string | null; hote?: string | null };
}

export function DetailReservation({ id, titre }: { id: string; titre?: string }) {
  const [detail, setDetail] = useState<Detail | 'chargement' | 'erreur'>('chargement');
  useEffect(() => {
    let vivant = true;
    fetch(`/api/reservations/detail?id=${encodeURIComponent(id)}`)
      .then(r => r.json()).catch(() => ({}))
      .then(data => { if (vivant) setDetail(data?.ok ? data : 'erreur'); });
    return () => { vivant = false; };
  }, [id]);

  if (detail === 'chargement') return <p className="text-[11px]" style={{ color: '#A8A09A' }}>Lecture…</p>;
  if (detail === 'erreur') return <p className="text-[11px]" style={{ color: '#A8A09A' }}>Détail indisponible.</p>;
  return (
    <div className="grid gap-0.5 rounded-lg px-3 py-2 text-[11px]" style={{ backgroundColor: '#FAFAF8', color: '#7A7068' }}>
      {titre && <p className="font-semibold" style={{ color: '#1A1A1A' }}>{titre}</p>}
      <p>Calendrier : <span style={{ color: '#1A1A1A' }}>{detail.calendrier.label || detail.calendrier.platform || '—'}</span>
        {detail.calendrier.hote ? ` (${detail.calendrier.hote})` : ''}</p>
      <p>Intitulé envoyé : <span className="font-medium" style={{ color: '#1A1A1A' }}>{detail.evenement.summary || '(vide)'}</span></p>
      <p>Dates envoyées : <span style={{ color: '#1A1A1A' }}>{detail.evenement.start} → {detail.evenement.end}</span>
        {detail.evenement.status ? ` · ${detail.evenement.status}` : ''}</p>
      <p className="break-all">Identifiant : {detail.evenement.uid || '—'}</p>
    </div>
  );
}

export default function LigneReservation({ r }: { r: Reservation }) {
  const [ouvert, setOuvert] = useState(false);
  const st = RES_STATUS[r.status] ?? RES_STATUS.confirmed;
  const nuits = daysBetween(r.checkIn, r.checkOut);
  const voyageurs = libelleVoyageurs(r.guestsCount);

  return (
    <div className="border-b last:border-0" style={{ borderColor: '#F2EFE9' }}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3" style={{ opacity: 0.7 }}>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{r.apartmentName ?? '—'}</p>
          <p className="text-xs mt-0.5" style={{ color: '#7A7068' }}>
            {fmtDate(r.checkIn)} → {fmtDate(r.checkOut)}
            {nuits > 0 && <> · {nuits} nuit{nuits > 1 ? 's' : ''}</>}
            {voyageurs && <> · {voyageurs}</>}
            {' · '}{platformLabel(r.platform)}
          </p>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
        <span className="w-24 text-right text-[11px]" style={{ color: r.missionId ? '#5A8A6A' : '#A8A09A' }}>
          {r.missionId ? <span className="inline-flex items-center gap-1 font-semibold"><Icon name="check" size={13} /> Ménage créé</span> : '—'}
        </span>
        <button onClick={() => setOuvert(o => !o)} className="text-[10px] underline" style={{ color: '#A8A09A' }}>
          {ouvert ? 'masquer' : 'détail'}
        </button>
      </div>
      {ouvert && <div className="px-4 pb-3"><DetailReservation id={r.id} /></div>}
    </div>
  );
}
