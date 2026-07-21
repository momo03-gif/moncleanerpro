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
  const [shared, setShared] = useState(false);

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

  // Calendrier d'occupation du mois en cours.
  const now = new Date();
  const calYear = now.getFullYear();
  const calMonth = now.getMonth();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const firstWeekday = (new Date(calYear, calMonth, 1).getDay() + 6) % 7; // lundi = 0
  const confirmedRes = reservations.filter(r => r.status === 'confirmed');
  const arrSet = new Set(confirmedRes.map(r => r.checkIn));
  const depSet = new Set(confirmedRes.map(r => r.checkOut));
  const pad = (n: number) => String(n).padStart(2, '0');
  const calDays = Array.from({ length: daysInMonth }, (_, i) => {
    const dnum = i + 1;
    const iso = `${calYear}-${pad(calMonth + 1)}-${pad(dnum)}`;
    const occupied = confirmedRes.some(r => r.checkIn <= iso && r.checkOut >= iso);
    return { dnum, occupied, turnover: arrSet.has(iso) && depSet.has(iso), isToday: iso === t };
  });

  // Relevé mensuel à transmettre au propriétaire (partage natif, sinon presse-papiers).
  async function shareMonthlyReport() {
    if (!apt) return;
    const monthName = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const lines = [...monthMissions]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(m => `- ${new Date(m.date + 'T00:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} · ${m.status === 'completed' ? 'réalisé' : m.status === 'cancelled' ? 'annulé' : 'prévu'}`);
    const text = `Relevé ménages — ${apt.name}\n${monthName}\n\n${monthMissions.length} ménage${monthMissions.length > 1 ? 's' : ''} :\n${lines.join('\n') || '—'}\n\nTotal : ${monthCost}€`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: `Relevé ${apt.name}`, text });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShared(true); setTimeout(() => setShared(false), 2500);
      }
    } catch { /* partage annulé par l'utilisateur */ }
  }

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
        <p className="text-sm mt-0.5 flex items-center gap-1.5" style={{ color: '#A8A09A' }}><Icon name="pin" size={14} /> {apt.address}</p>
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

        <div className="mt-4 flex items-center gap-4">
          <button onClick={() => router.push(`/airbnb?edit=${apt.id}`)} className="text-xs font-medium" style={{ color: '#C9A84C' }}>
            Modifier les informations →
          </button>
          <button onClick={shareMonthlyReport} className="text-xs font-medium" style={{ color: '#7A7068' }}>
            {shared ? 'Copié ✓' : 'Partager le relevé du mois'}
          </button>
        </div>
      </div>

      {/* Occupation du mois (calendrier visuel) */}
      <h2 className="text-sm font-bold mb-3" style={{ color: '#1A1A1A' }}>Occupation ce mois</h2>
      <div className="rounded-2xl border p-4 mb-6" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
            <span key={i} className="text-[10px] text-center" style={{ color: '#A8A09A' }}>{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekday }).map((_, i) => <span key={'b' + i} />)}
          {calDays.map(d => (
            <div key={d.dnum} className="aspect-square rounded-lg flex items-center justify-center text-[11px] font-semibold"
              style={{
                backgroundColor: d.turnover ? '#FEE2E2' : d.occupied ? '#C9A84C22' : '#F8F6F2',
                color: d.turnover ? '#B91C1C' : d.occupied ? '#A87B1E' : '#C2BBB2',
                outline: d.isToday ? '1.5px solid #C9A84C' : 'none',
                outlineOffset: '-1.5px',
              }}>
              {d.dnum}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px]" style={{ color: '#A8A09A' }}>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: '#C9A84C22' }} /> Occupé</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: '#FEE2E2' }} /> Turnover</span>
        </div>
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
