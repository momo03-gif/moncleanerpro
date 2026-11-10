'use client';

// Onglet « Occupation » : l'état de chaque logement, MAINTENANT. Occupé (par
// combien de voyageurs, depuis quand, jusqu'à quand, ménage de sortie prévu
// ou non) ou libre (depuis quand, prochaine arrivée). Même règle d'occupation
// que le moteur (occupationsReelles) : une date fermée sur Airbnb n'occupe rien.
// Un logement sans calendrier connecté n'est pas « libre » : on ne sait pas.

import { useMemo } from 'react';
import type { Apartment, Reservation, ReservationFeed } from '@/lib/types';
import { occupationsReelles } from '@/lib/reservationDedupe';
import { libelleVoyageurs } from '@/lib/mouvements';
import Icon from '@/components/Icon';
import { fmtDate, daysBetween, carte } from './commun';

interface Etat {
  apt: Apartment;
  enCours?: Reservation;        // séjour en cours (la plus longue occupation fait foi)
  prochaine?: Reservation;      // prochaine arrivée
  derniereSortie?: string;      // dernier départ passé (libre depuis)
}

function dansJours(n: number) {
  if (n === 0) return 'aujourd’hui';
  if (n === 1) return 'demain';
  return `dans ${n} jours`;
}

function Compteur({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border px-4 py-3" style={carte}>
      <p className="text-2xl font-bold leading-none" style={{ color: value ? color : '#C9C2B8' }}>{value}</p>
      <p className="text-xs mt-1.5" style={{ color: '#7A7068' }}>{label}</p>
    </div>
  );
}

function Pastille({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ backgroundColor: ok ? '#5A8A6A15' : '#B85A5015', color: ok ? '#5A8A6A' : '#B85A50' }}>
      {ok && <Icon name="check" size={12} />}{label}
    </span>
  );
}

export default function OngletOccupation({ apartments, reservations, feeds, aujourdhui }: {
  apartments: Apartment[];
  reservations: Reservation[];
  feeds: ReservationFeed[];
  aujourdhui: string;
}) {
  const { occupes, libres, sansCalendrier, partentAuj, arriventAuj } = useMemo(() => {
    const avecCalendrier = new Set(feeds.map(f => f.airbnbId));
    const parLogement = new Map<string, Reservation[]>();
    for (const r of occupationsReelles(reservations)) {
      (parLogement.get(r.airbnbId) ?? parLogement.set(r.airbnbId, []).get(r.airbnbId)!).push(r);
    }
    const etats: Etat[] = apartments.filter(a => avecCalendrier.has(a.id)).map(apt => {
      const liste = (parLogement.get(apt.id) ?? []).sort((a, b) => a.checkOut.localeCompare(b.checkOut));
      const enCours = liste.filter(r => r.checkIn <= aujourdhui && aujourdhui < r.checkOut).pop();
      const prochaine = liste.filter(r => r.checkIn >= aujourdhui && r !== enCours)
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn))[0];
      const derniereSortie = liste.map(r => r.checkOut).filter(d => d <= aujourdhui).sort().pop();
      return { apt, enCours, prochaine, derniereSortie };
    });
    const occupes = etats.filter(e => e.enCours)
      .sort((a, b) => a.enCours!.checkOut.localeCompare(b.enCours!.checkOut) || a.apt.name.localeCompare(b.apt.name, 'fr'));
    const libres = etats.filter(e => !e.enCours)
      .sort((a, b) => (a.prochaine?.checkIn ?? '9999').localeCompare(b.prochaine?.checkIn ?? '9999') || a.apt.name.localeCompare(b.apt.name, 'fr'));
    const toutes = [...parLogement.values()].flat();
    return {
      occupes, libres,
      sansCalendrier: apartments.length - etats.length,
      partentAuj: new Set(toutes.filter(r => r.checkOut === aujourdhui).map(r => r.airbnbId)).size,
      arriventAuj: new Set(toutes.filter(r => r.checkIn === aujourdhui).map(r => r.airbnbId)).size,
    };
  }, [apartments, reservations, feeds, aujourdhui]);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Compteur label="Occupés maintenant" value={occupes.length} color="#1A1A1A" />
        <Compteur label="Libres maintenant" value={libres.length} color="#5A8A6A" />
        <Compteur label="Voyageurs qui partent aujourd’hui" value={partentAuj} color="#C48A2A" />
        <Compteur label="Voyageurs qui arrivent aujourd’hui" value={arriventAuj} color="#5B6EF5" />
      </div>

      {/* ── Occupés ─────────────────────────────────────────────────────── */}
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#1A1A1A' }}>
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#1A1A1A' }} />
        Occupés maintenant <span style={{ color: '#A8A09A' }}>{occupes.length}</span>
      </h2>
      {occupes.length === 0 ? (
        <p className="text-sm rounded-2xl border px-4 py-6 text-center mb-8" style={{ ...carte, color: '#A8A09A' }}>Aucun logement occupé en ce moment.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-2.5 mb-8">
          {occupes.map(({ apt, enCours: r, prochaine }) => {
            const total = Math.max(daysBetween(r!.checkIn, r!.checkOut), 1);
            const faites = Math.min(Math.max(daysBetween(r!.checkIn, aujourdhui), 0), total);
            const reste = daysBetween(aujourdhui, r!.checkOut);
            const voyageurs = libelleVoyageurs(r!.guestsCount);
            const enchaine = prochaine && prochaine.checkIn === r!.checkOut;
            return (
              <div key={apt.id} className="rounded-2xl border p-4" style={carte}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold truncate" style={{ color: '#1A1A1A' }}>{apt.name}</p>
                    <p className="text-xs mt-0.5 inline-flex items-center gap-1" style={{ color: voyageurs ? '#1A1A1A' : '#B5ADA3' }}>
                      <Icon name="user" size={12} />{voyageurs ?? 'voyageurs non communiqués'}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0"
                    style={{ backgroundColor: reste <= 1 ? '#C48A2A18' : '#F5F3EF', color: reste <= 1 ? '#C48A2A' : '#7A7068' }}>
                    Part {dansJours(reste)}
                  </span>
                </div>
                {/* Avancement du séjour */}
                <div className="mt-3 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#F2EFE9' }}>
                  <div className="h-full rounded-full" style={{ width: `${(faites / total) * 100}%`, backgroundColor: '#C9A84C' }} />
                </div>
                <div className="flex justify-between text-[11px] mt-1.5" style={{ color: '#7A7068' }}>
                  <span>Arrivé le {fmtDate(r!.checkIn)}</span>
                  <span>{total} nuit{total > 1 ? 's' : ''}</span>
                  <span className="font-semibold" style={{ color: '#1A1A1A' }}>Départ le {fmtDate(r!.checkOut)}{r!.checkOutTime ? ` à ${r!.checkOutTime}` : ''}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <Pastille ok={!!r!.missionId} label={r!.missionId ? 'Ménage de sortie prévu' : 'Ménage de sortie manquant'} />
                  {enchaine && (
                    <span className="text-[11px] font-semibold" style={{ color: '#B85A50' }}>
                      Nouvelle arrivée le même jour{prochaine!.checkInTime ? ` à ${prochaine!.checkInTime}` : ''}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Libres ──────────────────────────────────────────────────────── */}
      <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider mb-2" style={{ color: '#5A8A6A' }}>
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#5A8A6A' }} />
        Libres maintenant <span style={{ color: '#A8A09A' }}>{libres.length}</span>
      </h2>
      {libres.length === 0 ? (
        <p className="text-sm rounded-2xl border px-4 py-6 text-center" style={{ ...carte, color: '#A8A09A' }}>Tous les logements suivis sont occupés.</p>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={carte}>
          {libres.map(({ apt, prochaine, derniereSortie }) => {
            const dans = prochaine ? daysBetween(aujourdhui, prochaine.checkIn) : null;
            const voyageurs = prochaine ? libelleVoyageurs(prochaine.guestsCount) : null;
            return (
              <div key={apt.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 border-b last:border-0" style={{ borderColor: '#F2EFE9' }}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{apt.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: '#7A7068' }}>
                    {derniereSortie ? `Libre depuis le ${fmtDate(derniereSortie)}` : 'Libre'}
                  </p>
                </div>
                <div className="text-right">
                  {prochaine ? (
                    <>
                      <p className="text-xs font-semibold" style={{ color: dans! <= 1 ? '#5B6EF5' : '#1A1A1A' }}>
                        Prochaine arrivée {dansJours(dans!)}
                      </p>
                      <p className="text-[11px]" style={{ color: '#7A7068' }}>
                        le {fmtDate(prochaine.checkIn)}{prochaine.checkInTime ? ` à ${prochaine.checkInTime}` : ''}
                        {voyageurs ? ` · ${voyageurs}` : ''}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs" style={{ color: '#A8A09A' }}>Aucune arrivée prévue</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sansCalendrier > 0 && (
        <p className="text-xs mt-4" style={{ color: '#A8A09A' }}>
          {sansCalendrier} logement{sansCalendrier > 1 ? 's' : ''} sans calendrier connecté ne {sansCalendrier > 1 ? 'sont' : 'est'} pas
          {' '}suivi{sansCalendrier > 1 ? 's' : ''} ici : on ne connaît pas leur occupation (onglet Calendriers pour les brancher).
        </p>
      )}
    </>
  );
}
