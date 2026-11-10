'use client';

// Onglet « Départs à venir » : ce qu'on vient chercher chaque jour. Les
// chiffres clés, les séjours impossibles, puis les départs regroupés par jour
// — du plus proche au plus lointain —, filtrables par conciergerie.

import { useMemo, useState } from 'react';
import type { Reservation } from '@/lib/types';
import type { PartnerAccount } from '@/lib/db';
import { platformLabel } from '@/lib/pms/registry';
import type { chevauchements } from '@/lib/reservationDedupe';
import { inputStyle } from '@/lib/ui';
import LigneReservation from './LigneReservation';
import { fmtDate, titreJour, titreSection, carte } from './commun';

type Conflit = ReturnType<typeof chevauchements>[number];

function KPI({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border p-4" style={carte}>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: '#7A7068' }}>{label}</p>
    </div>
  );
}

export default function OngletDeparts({ aVenir, conflits, kpis, partenaires, aujourdhui, enCreation, onCreerMenage }: {
  aVenir: Reservation[];
  conflits: Conflit[];
  kpis: { occupied: number; leavingSoon: number; needsCleaning: number; missionCreated: number };
  partenaires: PartnerAccount[];
  aujourdhui: string;
  enCreation: string | null;
  onCreerMenage: (id: string) => void;
}) {
  const [conciergerie, setConciergerie] = useState('all');
  const [recherche, setRecherche] = useState('');

  // Seulement les conciergeries qui ont des départs à venir.
  const choix = useMemo(() => {
    const ids = new Set(aVenir.map(r => r.partnerId).filter(Boolean));
    return partenaires.filter(p => p.userId && ids.has(p.userId));
  }, [aVenir, partenaires]);

  const jours = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const visibles = aVenir.filter(r =>
      (conciergerie === 'all' || r.partnerId === conciergerie)
      && (!q || (r.apartmentName ?? '').toLowerCase().includes(q)));
    const parJour = new Map<string, Reservation[]>();
    for (const r of visibles) {
      const l = parJour.get(r.checkOut) ?? [];
      l.push(r);
      parJour.set(r.checkOut, l);
    }
    return [...parJour.entries()];
  }, [aVenir, conciergerie, recherche]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPI label="Occupés actuellement" value={kpis.occupied} color="#5B6EF5" />
        <KPI label="Bientôt libérés (≤ 3 j)" value={kpis.leavingSoon} color="#C48A2A" />
        <KPI label="Ménage à prévoir" value={kpis.needsCleaning} color="#B85A50" />
        <KPI label="Ménage créé" value={kpis.missionCreated} color="#5A8A6A" />
      </div>

      {/* Séjours qui se chevauchent — anomalie, jamais un cas normal. */}
      {conflits.length > 0 && (
        <div className="rounded-2xl border p-4 mb-6" style={{ borderColor: '#E4B7B1', backgroundColor: '#FDF3F2' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#8A3A31' }}>
            {conflits.length} séjour{conflits.length > 1 ? 's' : ''} impossible{conflits.length > 1 ? 's' : ''}
          </p>
          <p className="text-xs mb-3" style={{ color: '#8A3A31' }}>
            Un logement ne peut pas héberger deux voyageurs en même temps. Ces nuits sont décrites deux fois :
            un des calendriers exporte des périodes d’indisponibilité plutôt que des séjours, ou ce logement porte un calendrier de trop.
          </p>
          <div className="space-y-1.5">
            {conflits.slice(0, 10).map((c, i) => (
              <p key={i} className="text-xs" style={{ color: '#7A3028' }}>
                <span className="font-semibold">{c.apartmentName ?? '—'}</span>
                {' : '}{platformLabel(c.a.platform)} {fmtDate(c.a.checkIn)}→{fmtDate(c.a.checkOut)}
                {' recouvre '}{platformLabel(c.b.platform)} {fmtDate(c.b.checkIn)}→{fmtDate(c.b.checkOut)}
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input value={recherche} onChange={e => setRecherche(e.target.value)} placeholder="Rechercher un logement"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
        {choix.length > 1 && (
          <select value={conciergerie} onChange={e => setConciergerie(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm border appearance-none"
            style={{ ...inputStyle, color: conciergerie === 'all' ? '#7A7068' : '#1A1A1A' }}>
            <option value="all">Toutes les conciergeries</option>
            {choix.map(p => <option key={p.userId} value={p.userId!}>{p.name}</option>)}
          </select>
        )}
      </div>

      {jours.length === 0 ? (
        <div className="rounded-2xl p-10 text-center border" style={carte}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>
            {aVenir.length === 0 ? 'Aucun départ à venir.' : 'Aucun départ pour ce filtre.'}
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {jours.map(([jour, liste]) => {
            const sansMenage = liste.filter(r => r.status === 'confirmed' && !r.missionId).length;
            return (
              <section key={jour}>
                <div className="flex items-baseline gap-2 mb-2">
                  <h2 className={titreSection} style={{ color: '#1A1A1A' }}>{titreJour(jour, aujourdhui)}</h2>
                  <span className="text-xs" style={{ color: '#A8A09A' }}>
                    {liste.length} départ{liste.length > 1 ? 's' : ''}
                  </span>
                  {sansMenage > 0 && (
                    <span className="text-xs font-semibold" style={{ color: '#C48A2A' }}>
                      · {sansMenage} sans ménage
                    </span>
                  )}
                </div>
                <div className="rounded-2xl border overflow-hidden" style={carte}>
                  {liste.map(r => (
                    <LigneReservation key={r.id} r={r}
                      enCreation={enCreation === r.id} onCreerMenage={onCreerMenage} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
