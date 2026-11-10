'use client';

// Écran admin Réservations. Quatre onglets, du plus quotidien au plus
// technique : les mouvements du jour (départs et arrivées, par défaut), l'occupation des logements,
// les calendriers connectés (par conciergerie, avec les outils de
// branchement et de diagnostic) et les séjours terminés. Chaque onglet vit
// dans son fichier ; cette page charge les données et porte la synchro.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAirbnbs, getAllReservations, getAllReservationFeeds, getPartnerAccountsDB } from '@/lib/db';
import type { PartnerAccount } from '@/lib/db';
import { ecouterReservations } from '@/lib/missionsLive';
import type { Apartment, Reservation, ReservationFeed } from '@/lib/types';
import { chevauchements, occupationsReelles } from '@/lib/reservationDedupe';
import { aujourdhuiParis } from '@/lib/dateParis';
import { useFeedback } from '@/contexts/FeedbackContext';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import OngletMouvements from './OngletMouvements';
import OngletOccupation, { type AptOccupancy } from './OngletOccupation';
import OngletCalendriers from './OngletCalendriers';
import LigneReservation from './LigneReservation';
import { daysBetween, postJson, carte } from './commun';

type Onglet = 'mouvements' | 'occupation' | 'calendriers' | 'termines';

export default function AdminReservationsPage() {
  const today = aujourdhuiParis();
  const { toast } = useFeedback();
  const [onglet, setOnglet] = useState<Onglet>('mouvements');
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [feeds, setFeeds] = useState<ReservationFeed[]>([]);
  const [partenaires, setPartenaires] = useState<PartnerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [forcage, setForcage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, r, f, p] = await Promise.all([
      getAirbnbs(), getAllReservations(), getAllReservationFeeds(), getPartnerAccountsDB(),
    ]);
    setPartenaires(p.filter(x => x.kind === 'airbnb' && !!x.userId));
    setApartments(a); setReservations(r); setFeeds(f);
    setLoading(false);
  }, []);

  useEffect(() => {
    // `load` n'écrit l'état qu'après les lectures (await) : pas de rendu en cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    return ecouterReservations(load);
  }, [load]);

  async function syncAll() {
    setSyncing(true);
    try {
      const data = await postJson<{ ok?: boolean; error?: string; feeds?: number; imported?: number; missionsCreated?: number; errors?: string[] }>(
        '/api/reservations/sync', {});
      // La route renvoie un échec PAR CALENDRIER : un lien expiré ne doit pas
      // passer pour un succès à « 0 réservation importée ».
      if (!data.ok) toast(`Synchronisation impossible : ${data.error ?? 'erreur inconnue'}`, 'error');
      else {
        const errs = data.errors ?? [];
        toast(`${data.feeds} calendrier(s) · ${data.imported} réservation(s) importée(s) · ${data.missionsCreated} ménage(s) créé(s).`
          + (errs.length ? ` ${errs.length} calendrier(s) en échec : ${errs.join(' · ')}` : ''),
          errs.length ? 'error' : 'success');
      }
    } catch { toast('Synchronisation impossible.', 'error'); }
    await load();
    setSyncing(false);
  }

  // Créer le ménage d'une réservation que la synchro n'a pas retenue. Booking
  // emploie le même intitulé pour une réservation et pour un blocage : quand le
  // calendrier ne permet pas de trancher, c'est l'exploitant qui tranche.
  async function creerMenage(reservationId: string) {
    setForcage(reservationId);
    try {
      const data = await postJson<{ ok?: boolean; error?: string }>('/api/reservations/mission', { reservationId });
      toast(data.ok ? 'Ménage créé et rattaché à la réservation.' : `Création impossible : ${data.error ?? 'erreur inconnue'}`,
        data.ok ? 'success' : 'error');
    } catch { toast('Création impossible pour le moment.', 'error'); }
    await load();
    setForcage(null);
  }

  // Le passé, du plus récent au plus ancien — on n'y descend que pour vérifier.
  const termines = useMemo(() => reservations.filter(r => r.checkOut < today)
    .sort((a, b) => b.checkOut.localeCompare(a.checkOut)), [reservations, today]);

  // Séjours impossibles : deux voyageurs ne peuvent pas occuper le même
  // logement en même temps — le signal le plus net qu'un calendrier exporte
  // des indisponibilités au lieu de séjours, ou qu'un logement en porte un de trop.
  const conflits = useMemo(() => chevauchements(reservations), [reservations]);

  // Occupation : même définition que le moteur — un séjour confirmé, OU une
  // période fermée d'un flux Booking (même intitulé pour un séjour vendu et une
  // date fermée). Deux écrans ne peuvent pas répondre différemment à « est-il
  // occupé ? ». Le départ affiché est celui de l'occupation la plus LONGUE en
  // cours : annoncer la plus courte enverrait l'intervenant chez un voyageur
  // encore là.
  const occupation = useMemo<AptOccupancy[]>(() => {
    const byApt = new Map<string, Reservation[]>();
    for (const r of occupationsReelles(reservations)) {
      const list = byApt.get(r.airbnbId) ?? [];
      list.push(r);
      byApt.set(r.airbnbId, list);
    }
    return apartments.map(apt => {
      const list = (byApt.get(apt.id) ?? []).sort((a, b) => a.checkOut.localeCompare(b.checkOut));
      const enCours = list.filter(r => r.checkIn <= today && today < r.checkOut);
      const current = enCours[enCours.length - 1];
      const nextDeparture = list.find(r => r.checkOut >= today);
      const nextArrival = list.map(r => r.checkIn).filter(d => d >= today).sort()[0];
      return { apt, occupied: !!current, currentCheckOut: current?.checkOut, nextDeparture, nextArrival };
    }).sort((a, b) => (a.nextDeparture?.checkOut ?? '9999').localeCompare(b.nextDeparture?.checkOut ?? '9999'));
  }, [apartments, reservations, today]);

  const kpis = useMemo(() => {
    let occupied = 0, leavingSoon = 0, needsCleaning = 0, missionCreated = 0;
    for (const o of occupation) {
      if (o.occupied) occupied++;
      if (o.nextDeparture && daysBetween(today, o.nextDeparture.checkOut) <= 3) leavingSoon++;
      if (o.nextDeparture && !o.nextDeparture.missionId) needsCleaning++;
      if (o.nextDeparture && o.nextDeparture.missionId) missionCreated++;
    }
    return { occupied, leavingSoon, needsCleaning, missionCreated };
  }, [occupation, today]);

  const enEchec = feeds.filter(f => f.lastSyncStatus === 'error').length;
  const derniereSynchro = feeds.map(f => f.lastSyncAt).filter((x): x is string => !!x).sort().pop();

  if (loading) return <Loading className="p-6 text-sm" />;

  const ONGLETS: [Onglet, string, number | null][] = [
    ['mouvements', 'Départs et arrivées', null],
    ['occupation', 'Occupation', null],
    ['calendriers', 'Calendriers', enEchec || null],
    ['termines', 'Terminés', null],
  ];

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Réservations</h1>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>
            {feeds.length} calendrier{feeds.length > 1 ? 's' : ''} connecté{feeds.length > 1 ? 's' : ''} · synchro automatique toutes les heures
            {derniereSynchro && <> · dernière à {new Date(derniereSynchro).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}</>}
          </p>
        </div>
        <button onClick={syncAll} disabled={syncing}
          className="py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
          style={{ backgroundColor: '#1A1A1A', color: '#FFFFFF' }}>
          <Icon name="sync" size={16} /> {syncing ? 'Synchronisation…' : 'Synchroniser tout'}
        </button>
      </div>

      <div className="flex flex-wrap gap-1 mb-6 p-1 rounded-2xl" style={{ backgroundColor: '#F5F3EF' }}>
        {ONGLETS.map(([id, label, alerte]) => (
          <button key={id} type="button" onClick={() => setOnglet(id)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all inline-flex items-center gap-1.5"
            style={{ backgroundColor: onglet === id ? '#FFFFFF' : 'transparent', color: onglet === id ? '#1A1A1A' : '#A8A09A', boxShadow: onglet === id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {label}
            {alerte != null && (
              <span className="text-[10px] px-1.5 rounded-full font-semibold" style={{ backgroundColor: '#B85A5018', color: '#B85A50' }}>{alerte}</span>
            )}
          </button>
        ))}
      </div>

      {onglet === 'mouvements' && (
        <OngletMouvements reservations={reservations} conflits={conflits} partenaires={partenaires}
          aujourdhui={today} enCreation={forcage} onCreerMenage={creerMenage} />
      )}
      {onglet === 'occupation' && <OngletOccupation occupation={occupation} kpis={kpis} />}
      {onglet === 'calendriers' && (
        <OngletCalendriers feeds={feeds} apartments={apartments} partenaires={partenaires} onRecharger={load} />
      )}
      {onglet === 'termines' && (
        termines.length === 0 ? (
          <div className="rounded-2xl p-10 text-center border" style={carte}>
            <p className="text-sm" style={{ color: '#A8A09A' }}>Aucun séjour terminé.</p>
          </div>
        ) : (
          <>
            <p className="text-xs mb-3" style={{ color: '#A8A09A' }}>
              Les {Math.min(60, termines.length)} séjours terminés les plus récents.
            </p>
            <div className="rounded-2xl border overflow-hidden" style={carte}>
              {termines.slice(0, 60).map(r => <LigneReservation key={r.id} r={r} />)}
            </div>
          </>
        )
      )}
    </div>
  );
}
