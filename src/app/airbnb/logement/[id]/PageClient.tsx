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
import SiteAccessVideo from '@/components/SiteAccessVideo';
import ChecklistPanel from '@/components/ChecklistPanel';
import SuppliesPanel from '@/components/SuppliesPanel';
import Loading from '@/components/Loading';
import { Badge, Card, SectionTitle } from '@/components/ui';

const today = () => new Date().toLocaleDateString('en-CA');  // date LOCALE (pas UTC)

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

  // ?panel=checklist|video|supplies — les pastilles de la liste des logements
  // mènent ici. Sans ça, on atterrissait sur la fiche sans voir ce qu'on venait
  // configurer : le panneau replié passait inaperçu.
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  useEffect(() => {
    setOpenPanel(new URLSearchParams(window.location.search).get('panel'));
  }, []);
  useEffect(() => {
    if (loading || !openPanel) return;
    const el = document.getElementById(`panel-${openPanel}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [loading, openPanel]);

  if (loading) return <Loading className="p-5 pt-8 text-sm" />;

  if (!apt) {
    return (
      <div className="p-5">
        <BackButton onClick={() => router.push('/airbnb')} />
        <Card className="p-10 text-center">
          <p className="text-sm text-muted">Logement introuvable.</p>
        </Card>
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
    <div className="p-5 mcp-in">
      <BackButton onClick={() => router.push('/airbnb')} label="Mes logements" />

      {/* En-tête */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-ink">{apt.name}</h1>
        <p className="text-sm mt-0.5 flex items-center gap-1.5 text-muted"><Icon name="pin" size={14} /> {apt.address}</p>
      </div>

      {/* Carte infos clés */}
      <Card className="p-5 mb-6">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {apt.clientPrice != null && (
            <Info label="Prix / ménage" value={`${apt.clientPrice}€`} className="text-success" />
          )}
          <Info label="Ce mois" value={`${monthMissions.length} ménage${monthMissions.length > 1 ? 's' : ''} · ${monthCost}€`} />
          {capacity && <Info label="Capacité" value={capacity} />}
          {apt.cleanerName && <Info label="Cleaner attitré" value={apt.cleanerName} />}
          {apt.zoneName && <Info label="Zone" value={apt.zoneName} style={apt.zoneColor ? { color: apt.zoneColor } : undefined} />}
        </div>

        {/* Les deux codes d'accès se distinguaient par un bleu (#5B6EF5) étranger
            à la palette. Même traitement pour les deux : ce sont deux secrets de
            même nature, c'est l'intitulé qui les différencie. */}
        {(apt.portalCode || apt.keyboxCode) && (
          <div className="flex flex-wrap gap-2 mt-4">
            {apt.portalCode && <AccessCode label="Portail" code={apt.portalCode} />}
            {apt.keyboxCode && <AccessCode label="Clé" code={apt.keyboxCode} />}
          </div>
        )}

        {apt.entryDirectives && (
          <p className="text-xs mt-4 leading-snug text-muted">
            <span className="font-semibold">Entrée : </span>{apt.entryDirectives}
          </p>
        )}
        {apt.notes && (
          <p className="text-xs px-3 py-2 rounded-xl mt-3 bg-surface-2 text-muted">{apt.notes}</p>
        )}

        {/* Vidéo d'accès (facultative) : le propriétaire peut expliquer comment
            s'y rendre / trouver la clé. Le cleaner la verra sur sa mission. */}
        <div id="panel-video" className={`mt-4 rounded-xl ${openPanel === 'video' ? 'ring-2 ring-gold' : ''}`}>
          <SiteAccessVideo airbnbId={apt.id} videoUrl={apt.accessVideoUrl} mode="manage"
            onChange={url => setApt(a => (a ? { ...a, accessVideoUrl: url ?? undefined } : a))} />
        </div>

        {/* Standard de ménage : ce que vous exigez dans CE logement. L'intervenant
            le coche à chaque ménage, et vous en avez la preuve sur la fiche du ménage. */}
        <div id="panel-checklist" className={`mt-3 rounded-xl ${openPanel === 'checklist' ? 'ring-2 ring-gold' : ''}`}>
          <ChecklistPanel airbnbId={apt.id} mode="edit" authorName={user?.name}
            defaultOpen={openPanel === 'checklist'} />
        </div>

        {/* Liste de courses : ce que les intervenants ont signalé manquant et que
            personne n'a encore racheté. */}
        <div id="panel-supplies" className={`mt-3 rounded-xl ${openPanel === 'supplies' ? 'ring-2 ring-gold' : ''}`}>
          <SuppliesPanel airbnbId={apt.id} authorName={user?.name}
            defaultOpen={openPanel === 'supplies'} />
        </div>

        <div className="mt-4 flex items-center gap-4 flex-wrap">
          <button onClick={() => router.push(`/airbnb?edit=${apt.id}`)} className="text-xs font-medium min-h-[44px] text-gold-ink">
            Modifier les informations →
          </button>
          {/* Prestation hors ménage récurrent (fin de bail, vitres, colocation…) :
              le devis part pré-rempli avec ce logement. */}
          <button onClick={() => router.push(`/airbnb/devis?logement=${apt.id}`)} className="text-xs font-medium min-h-[44px] text-gold-ink">
            Demander un devis →
          </button>
          {/* Le relevé complet (PDF + photos + incidents) a sa propre page ; le
              partage texte rapide reste ici pour un envoi en deux secondes. */}
          <button onClick={() => router.push(`/airbnb/logement/${apt.id}/rapport`)} className="text-xs font-medium min-h-[44px] text-gold-ink">
            Relevé pour le propriétaire →
          </button>
          <button onClick={shareMonthlyReport} className="text-xs font-medium min-h-[44px] inline-flex items-center gap-1 text-muted">
            {shared ? <><Icon name="check" size={13} /> Copié</> : 'Partage rapide'}
          </button>
        </div>
      </Card>

      {/* Occupation du mois (calendrier visuel) */}
      <SectionTitle>Occupation ce mois</SectionTitle>
      <Card className="p-4 mb-6">
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
            <span key={i} className="text-[10px] text-center text-muted">{d}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstWeekday }).map((_, i) => <span key={'b' + i} />)}
          {calDays.map(d => (
            <div key={d.dnum}
              className={`aspect-square rounded-lg flex items-center justify-center text-[11px] font-semibold ${
                d.turnover ? 'bg-danger-soft text-danger'
                  : d.occupied ? 'bg-warn-soft text-warn'
                  : 'bg-surface-2 text-muted'
              } ${d.isToday ? 'outline outline-[1.5px] -outline-offset-[1.5px] outline-gold' : ''}`}>
              {d.dnum}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[10px] text-muted">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-warn-soft border border-warn-line" /> Occupé</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-danger-soft border border-danger-line" /> Turnover</span>
        </div>
      </Card>

      {/* Prochains départs → ménages */}
      <SectionTitle>Prochains départs</SectionTitle>
      {upcoming.length === 0 ? (
        <Card className="p-6 text-center mb-6">
          <p className="text-xs text-muted">Aucun départ à venir. Connectez un calendrier depuis la synchronisation.</p>
        </Card>
      ) : (
        <div className="space-y-2.5 mb-6">
          {upcoming.map(r => {
            const turnover = isTurnover(r.checkOut);
            return (
              <Card key={r.id} tone={turnover ? 'alert' : 'plain'} className="px-4 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    Départ {fmtDate(r.checkOut)}{r.checkOutTime ? ` · ${formatHour(r.checkOutTime)}` : ''}
                  </p>
                  {turnover && (
                    <span className="text-[11px] font-semibold mt-0.5 block text-danger">
                      Arrivée le jour même — ménage prioritaire
                    </span>
                  )}
                </div>
                {r.missionId ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold shrink-0 text-success">
                    <Icon name="check" size={13} /> Ménage créé
                  </span>
                ) : (
                  <span className="text-[11px] font-semibold shrink-0 text-warn">Ménage à créer</span>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Prochaines arrivées */}
      <SectionTitle>Prochaines arrivées</SectionTitle>
      {upcomingArrivals.length === 0 ? (
        <Card className="p-6 text-center mb-6">
          <p className="text-xs text-muted">Aucune arrivée à venir.</p>
        </Card>
      ) : (
        <div className="space-y-2.5 mb-6">
          {upcomingArrivals.slice(0, 8).map(r => (
            <Card key={r.id} className="px-4 py-3 flex items-center gap-3">
              <span className="shrink-0 inline-flex text-success" aria-hidden="true"><Icon name="arrowUp" size={15} /></span>
              <p className="text-sm font-semibold flex-1 text-ink">
                Arrivée {fmtDate(r.checkIn)}{r.checkInTime ? ` · ${formatHour(r.checkInTime)}` : ''}
              </p>
            </Card>
          ))}
        </div>
      )}

      {/* Ménages récents */}
      <SectionTitle>Ménages récents</SectionTitle>
      {recentMissions.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-xs text-muted">Aucun ménage pour ce logement.</p>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {recentMissions.slice(0, 20).map(m => {
            const cfg = missionStatusCfg(m.status);
            return (
              <button key={m.id} onClick={() => router.push(`/airbnb/mission/${m.id}`)}
                className="w-full text-left rounded-2xl border bg-card border-line px-4 py-3 flex items-center gap-3 active:scale-[0.99] transition-transform">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold flex items-center gap-1 text-ink">
                    {fmtDate(m.date)}{m.time ? ` · ${formatHour(m.time)}` : ''}
                    <span className="text-gold-ink" aria-hidden="true"><Icon name="chevronRight" size={13} /></span>
                  </p>
                  <p className="text-xs mt-0.5 text-muted">
                    {serviceParts(m.service).delivery ? 'Livraison' : 'Ménage'}
                    {m.cleanerName ? ` · ${m.cleanerName}` : ' · non assigné'}
                  </p>
                </div>
                <Badge style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                  {missionStatusLabel(m.status, m.service)}
                </Badge>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BackButton({ onClick, label = 'Retour' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} className="text-sm mb-4 inline-flex items-center gap-1 min-h-[44px] text-gold-ink font-medium">
      ← {label}
    </button>
  );
}

function AccessCode({ label, code }: { label: string; code: string }) {
  return (
    <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-mono font-bold bg-gold-soft border border-gold-line text-gold-ink">
      <span className="font-sans font-normal text-muted">{label}</span>{code}
    </span>
  );
}

function Info({ label, value, className = '', style }: {
  label: string; value: string; className?: string; style?: React.CSSProperties;
}) {
  return (
    <div>
      <p className="text-[11px] mb-0.5 text-muted">{label}</p>
      <p className={`text-sm font-semibold ${className || 'text-ink'}`} style={style}>{value}</p>
    </div>
  );
}
