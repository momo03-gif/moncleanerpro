'use client';

// Fiche logement (espace partenaire) : agrège tout ce qui concerne UN logement —
// informations, prochains départs → ménages (avec alerte turnover), et l'historique
// des ménages. Objectif : que la conciergerie suive un logement d'un coup d'œil,
// au lieu de naviguer entre trois pages séparées.

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAirbnbsForPartner, getReservationsForPartner, getMissionsForPartnerDB } from '@/lib/db';
import type { Apartment, Reservation, Mission } from '@/lib/types';
import { missionStatusCfg, missionStatusLabel } from '@/lib/labels';
import { serviceParts } from '@/lib/service';
import { formatHour } from '@/lib/format';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';

const today = () => new Date().toISOString().split('T')[0];

function fmtDate(d?: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function LogementDetailClient() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? '');
  const { user } = useAuth();

  const [apt, setApt] = useState<Apartment | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const [apts, res, ms] = await Promise.all([
      getAirbnbsForPartner(user.id),
      getReservationsForPartner(user.id),
      getMissionsForPartnerDB(user.id),
    ]);
    setApt(apts.find(a => a.id === id) ?? null);
    setReservations(res.filter(r => r.airbnbId === id));
    setMissions(ms.filter(m => m.airbnbId === id));
    setLoading(false);
  }, [user, id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Loading className="p-5 pt-8 text-sm" />;

  if (!apt) {
    return (
      <div className="p-5">
        <button onClick={() => router.push('/airbnb')} className="text-sm mb-4" style={{ color: '#C9A84C' }}>← Mes logements</button>
        <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>Logement introuvable.</p>
        </div>
      </div>
    );
  }

  const t = today();

  // Prochains départs = réservations confirmées dont le départ est aujourd'hui ou après.
  const upcoming = reservations
    .filter(r => r.status === 'confirmed' && r.checkOut >= t)
    .sort((a, b) => a.checkOut.localeCompare(b.checkOut));

  // Turnover : un départ est « jour J » s'il existe une arrivée confirmée le même jour.
  const arrivalsByDay = new Set(reservations.filter(r => r.status === 'confirmed').map(r => r.checkIn));
  const isTurnover = (checkOut: string) => arrivalsByDay.has(checkOut);

  // Prochaines arrivées confirmées (aujourd'hui ou après).
  const upcomingArrivals = reservations
    .filter(r => r.status === 'confirmed' && r.checkIn >= t)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  // Ménages récents (missions du logement), les plus récents d'abord.
  const recentMissions = [...missions].sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));

  // Activité du mois en cours (nb de ménages non annulés + coût estimé) pour ce logement.
  const monthPrefix = new Date().toISOString().slice(0, 7); // YYYY-MM
  const monthMissions = missions.filter(m => m.date.startsWith(monthPrefix) && m.status !== 'cancelled');
  const monthCost = Math.round(monthMissions.reduce((s, m) => s + (m.price || 0), 0));

  const capacity = [
    apt.bedrooms != null ? `${apt.bedrooms} chambre${apt.bedrooms > 1 ? 's' : ''}` : null,
    apt.beds != null ? `${apt.beds} lit${apt.beds > 1 ? 's' : ''}` : null,
    apt.sofaBeds != null ? `${apt.sofaBeds} canapé-lit${apt.sofaBeds > 1 ? 's' : ''}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="p-5">
      <button onClick={() => router.push('/airbnb')} className="text-sm mb-4 inline-flex items-center gap-1" style={{ color: '#C9A84C' }}>
        ← Mes logements
      </button>

      {/* En-tête */}
      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>{apt.name}</h1>
        <p className="text-sm mt-0.5" style={{ color: '#A8A09A' }}>◎ {apt.address}</p>
      </div>

      {/* Carte infos clés */}
      <div className="rounded-2xl border p-5 mb-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {apt.clientPrice != null && (
            <Info label="Prix / ménage" value={`${apt.clientPrice}€`} valueColor="#5A8A6A" />
          )}
          <Info label="Ce mois" value={`${monthMissions.length} ménage${monthMissions.length > 1 ? 's' : ''} · ${monthCost}€`} />
          {capacity && <Info label="Capacité" value={capacity} />}
          {apt.cleanerName && <Info label="Cleaner attitré" value={apt.cleanerName} />}
          {apt.zoneName && <Info label="Zone" value={apt.zoneName} valueColor={apt.zoneColor} />}
        </div>

        {(apt.portalCode || apt.keyboxCode) && (
          <div className="flex flex-wrap gap-2 mt-4">
            {apt.portalCode && (
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold" style={{ backgroundColor: '#C9A84C20', color: '#C48A2A' }}>
                <span className="font-sans font-normal" style={{ color: '#A8A09A' }}>Portail</span>{apt.portalCode}
              </span>
            )}
            {apt.keyboxCode && (
              <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold" style={{ backgroundColor: '#5B6EF518', color: '#5B6EF5' }}>
                <span className="font-sans font-normal" style={{ color: '#A8A09A' }}>Clé</span>{apt.keyboxCode}
              </span>
            )}
          </div>
        )}

        {apt.entryDirectives && (
          <p className="text-xs mt-4 leading-snug" style={{ color: '#7A7068' }}>
            <span className="font-semibold" style={{ color: '#A8A09A' }}>Entrée : </span>{apt.entryDirectives}
          </p>
        )}
        {apt.notes && (
          <p className="text-xs px-3 py-2 rounded-xl mt-3" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>{apt.notes}</p>
        )}

        <button onClick={() => router.push(`/airbnb?edit=${apt.id}`)} className="mt-4 text-xs font-medium" style={{ color: '#C9A84C' }}>
          Modifier les informations →
        </button>
      </div>

      {/* Prochains départs → ménages */}
      <h2 className="text-sm font-bold mb-3" style={{ color: '#1A1A1A' }}>Prochains départs</h2>
      {upcoming.length === 0 ? (
        <div className="rounded-2xl p-6 text-center border mb-6" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-xs" style={{ color: '#A8A09A' }}>Aucun départ à venir. Connectez un calendrier depuis la synchronisation.</p>
        </div>
      ) : (
        <div className="space-y-2.5 mb-6">
          {upcoming.map(r => {
            const turnover = isTurnover(r.checkOut);
            return (
              <div key={r.id} className="rounded-2xl border px-4 py-3 flex items-center gap-3" style={{ backgroundColor: '#FFFFFF', borderColor: turnover ? '#EAC4BE' : '#E8E4DC' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>
                    Départ {fmtDate(r.checkOut)}{r.checkOutTime ? ` · ${formatHour(r.checkOutTime)}` : ''}
                  </p>
                  {turnover && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold mt-0.5" style={{ color: '#B85A50' }}>
                      ⚠ Arrivée le jour même — ménage prioritaire
                    </span>
                  )}
                </div>
                {r.missionId ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold shrink-0" style={{ color: '#5A8A6A' }}>
                    <Icon name="check" size={13} /> Ménage créé
                  </span>
                ) : (
                  <span className="text-[11px] shrink-0" style={{ color: '#C48A2A' }}>Ménage à créer</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Prochaines arrivées */}
      <h2 className="text-sm font-bold mb-3" style={{ color: '#1A1A1A' }}>Prochaines arrivées</h2>
      {upcomingArrivals.length === 0 ? (
        <div className="rounded-2xl p-6 text-center border mb-6" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-xs" style={{ color: '#A8A09A' }}>Aucune arrivée à venir.</p>
        </div>
      ) : (
        <div className="space-y-2.5 mb-6">
          {upcomingArrivals.slice(0, 8).map(r => (
            <div key={r.id} className="rounded-2xl border px-4 py-3 flex items-center gap-3" style={{ backgroundColor: '#FCFBF8', borderColor: '#E8E4DC' }}>
              <span className="text-sm shrink-0" style={{ color: '#5A8A6A' }}>▲</span>
              <p className="text-sm font-semibold flex-1" style={{ color: '#1A1A1A' }}>
                Arrivée {fmtDate(r.checkIn)}{r.checkInTime ? ` · ${formatHour(r.checkInTime)}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Ménages récents */}
      <h2 className="text-sm font-bold mb-3" style={{ color: '#1A1A1A' }}>Ménages récents</h2>
      {recentMissions.length === 0 ? (
        <div className="rounded-2xl p-6 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-xs" style={{ color: '#A8A09A' }}>Aucun ménage pour ce logement.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {recentMissions.slice(0, 20).map(m => {
            const cfg = missionStatusCfg(m.status);
            return (
              <button key={m.id} onClick={() => router.push(`/airbnb/mission/${m.id}`)}
                className="w-full text-left rounded-2xl border px-4 py-3 flex items-center gap-3 active:scale-[0.99] transition-transform" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold flex items-center gap-1" style={{ color: '#1A1A1A' }}>
                    {fmtDate(m.date)}{m.time ? ` · ${formatHour(m.time)}` : ''}
                    <span className="text-xs" style={{ color: '#C9A84C' }}>›</span>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#A8A09A' }}>
                    {serviceParts(m.service).delivery ? 'Livraison' : 'Ménage'}
                    {m.cleanerName ? ` · ${m.cleanerName}` : ' · non assigné'}
                  </p>
                </div>
                <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold shrink-0" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                  {missionStatusLabel(m.status, m.service)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Info({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <p className="text-[11px] mb-0.5" style={{ color: '#A8A09A' }}>{label}</p>
      <p className="text-sm font-semibold" style={{ color: valueColor ?? '#1A1A1A' }}>{value}</p>
    </div>
  );
}
