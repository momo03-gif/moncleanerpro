'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { getAirbnbs, getAllReservations, getAllReservationFeeds, getPartnerAccountsDB } from '@/lib/db';
import type { PartnerAccount } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { Apartment, Reservation, ReservationFeed } from '@/lib/types';
// Nom des plateformes : lu dans le registre, pour que l'admin et l'espace
// partenaire désignent toujours une source de la même façon.
import { platformLabel } from '@/lib/pms/registry';
import Icon from '@/components/Icon';
import { chevauchements, occupationsReelles } from '@/lib/reservationDedupe';
import Loading from "@/components/Loading";
import { inputStyle } from '@/lib/ui';
import ConnectWizard from '@/app/airbnb/sync/ConnectWizard';

const RES_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmée', color: '#5A8A6A', bg: '#5A8A6A15' },
  cancelled: { label: 'Annulée',   color: '#B85A50', bg: '#B85A5015' },
  tentative: { label: 'À confirmer', color: '#C48A2A', bg: '#C48A2A15' },
  blocked:   { label: 'Bloqué',    color: '#6B7280', bg: '#6B728018' },
};

function parisToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
}
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);
}

function KPI({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-2xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: '#7A7068' }}>{label}</p>
    </div>
  );
}

// État d'occupation d'un appartement, dérivé de ses réservations confirmées.
interface AptOccupancy {
  apt: Apartment;
  occupied: boolean;
  currentCheckOut?: string;       // départ du séjour en cours
  nextDeparture?: Reservation;    // 1er départ >= aujourd'hui
  nextArrival?: string;           // 1re arrivée >= aujourd'hui
}

export default function AdminReservationsPage() {
  const today = parisToday();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [feeds, setFeeds] = useState<ReservationFeed[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [syncFailed, setSyncFailed] = useState(false);
  const [partenaires, setPartenaires] = useState<PartnerAccount[]>([]);
  // Connecter un calendrier POUR un partenaire. L'assistant vivait seulement
  // dans l'espace de la conciergerie — or beaucoup ne savent pas s'en servir,
  // et c'est l'exploitant qui branche à leur place. Les routes l'autorisaient
  // déjà (canManageFeed laisse passer un admin) : il ne manquait que l'écran.
  const [connecterPour, setConnecterPour] = useState<PartnerAccount | null>(null);

  // ── Branchement SuperHote en lot ─────────────────────────────────────────
  // Une conciergerie a quatorze biens chez nous et soixante-quinze dans son
  // logiciel : les connecter un par un, c'est quatorze fois le meme ecran. On
  // liste, on coche, on branche.
  const [shPour, setShPour] = useState<PartnerAccount | null>(null);
  const [shCle, setShCle] = useState('');
  const [shListe, setShListe] = useState<{ id: string; name: string; prochaine: string | null; dejaConnecte: boolean }[] | null>(null);
  const [shChoix, setShChoix] = useState<Record<string, string>>({});
  const [shBusy, setShBusy] = useState(false);

  async function shLister() {
    if (!shPour?.userId || !shCle.trim()) return;
    setShBusy(true); setSyncMsg('');
    try {
      const res = await fetch('/api/reservations/superhote-bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lister', partnerId: shPour.userId, apiKey: shCle.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.ok) { setShListe(d.logements); setShChoix({}); }
      else { setSyncFailed(true); setSyncMsg(d.error ?? 'Lecture impossible.'); }
    } catch { setSyncFailed(true); setSyncMsg('Lecture impossible.'); }
    setShBusy(false);
  }

  async function shConnecter() {
    if (!shPour?.userId) return;
    const choix = Object.entries(shChoix).map(([rentalId, nom]) => ({ rentalId, nom }));
    if (choix.length === 0) return;
    setShBusy(true);
    try {
      const res = await fetch('/api/reservations/superhote-bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connecter', partnerId: shPour.userId, apiKey: shCle.trim(), choix }),
      });
      const d = await res.json().catch(() => ({}));
      const rates: string[] = d.rates ?? [];
      setSyncFailed(!d.ok || rates.length > 0);
      setSyncMsg(d.ok
        ? `${(d.connectes ?? []).length} logement(s) connecte(s).`
          + (rates.length ? ` ATTENTION ${rates.join(' - ')}` : '')
        : (d.error ?? 'Connexion impossible.'));
      if (d.ok) { setShPour(null); setShListe(null); setShCle(''); await load(); }
    } catch { setSyncFailed(true); setSyncMsg('Connexion impossible.'); }
    setShBusy(false);
  }
  // URL de réception d'un partenaire, demandée à la volée : le secret ne vit
  // qu'en base, on ne le charge pas avec la page.
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [recus, setRecus] = useState<{ source: string; resultat: string; note?: string; recuLe: string; champs: string[] }[] | null>(null);

  // Copie d'un texte, avec repli quand le navigateur refuse le presse-papiers
  // (mobile, HTTP) : l'URL reste sélectionnable au doigt dans tous les cas.
  async function copyField(quoi: string, valeur: string) {
    try {
      await navigator.clipboard.writeText(valeur);
      setSyncFailed(false); setSyncMsg(`${quoi} copiée.`);
    } catch {
      setSyncFailed(true); setSyncMsg('Copie impossible — sélectionnez le texte.');
    }
  }

  async function urlReception(partnerId: string) {
    if (urls[partnerId]) { setUrls(u => { const n = { ...u }; delete n[partnerId]; return n; }); return; }
    try {
      const res = await fetch('/api/reservations/webhook-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'abonnement', partnerId, source: 'superhote' }),
      });
      const d = await res.json().catch(() => ({}));
      setUrls(u => ({ ...u, [partnerId]: d.ok
        ? `${window.location.origin}/api/reservations/webhook/${d.secret}`
        : (d.error ?? 'Génération impossible.') }));
    } catch { setUrls(u => ({ ...u, [partnerId]: 'Génération impossible.' })); }
  }

  async function voirRecus() {
    if (recus) { setRecus(null); return; }
    try {
      const res = await fetch('/api/reservations/webhook-admin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'evenements' }),
      });
      const d = await res.json().catch(() => ({}));
      setRecus(d.ok ? d.evenements : []);
    } catch { setRecus([]); }
  }
  const [forcage, setForcage] = useState<string | null>(null);
  // Ce que la plateforme a réellement envoyé pour une ligne. Une réservation
  // qui paraît fausse ne se diagnostique qu'en regardant la donnée brute ;
  // jusqu'ici on relisait le code à la place.
  const [detail, setDetail] = useState<Record<string, {
    evenement: { uid?: string | null; summary?: string | null; start?: string | null; end?: string | null; status?: string | null };
    calendrier: { label?: string | null; platform?: string | null; hote?: string | null };
  } | 'chargement' | 'erreur'>>({});

  // Quel logement du logiciel est rattaché à cette connexion. Un identifiant
  // PMS ne ressemble à rien pour un humain : quand le bien porte un nom
  // différent des deux côtés, on rattache le mauvais sans s'en apercevoir, et
  // la synchro remonte zéro réservation sans la moindre erreur.
  const [pms, setPms] = useState<Record<string, {
    rattache: string; trouve: boolean; logements: { id: string; name: string }[];
  } | 'chargement' | string>>({});

  // Ce que l'éditeur répond vraiment. Une synchro vide SANS erreur ne se
  // diagnostique pas depuis l'extérieur : il faut le nombre de lignes rendues
  // et leur forme.
  async function diagnostiquer(feedId: string) {
    setPms(p => ({ ...p, [feedId]: 'chargement' }));
    try {
      const res = await fetch('/api/reservations/pms-properties', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedId, diagnostic: true }),
      });
      const d = await res.json().catch(() => ({}));
      setPms(p => ({ ...p, [feedId]: d.ok
        ? (d.diagnostic as {
            variante: string; statut: number | 'ok'; lignes: number;
            duLogement: number; evenements: number; dansPeriode: number; enveloppe: string[];
          }[]).map(v => v.statut === 'ok'
            ? `${v.variante} : ${v.lignes} reçue(s), ${v.duLogement} du logement, ${v.dansPeriode} dans la période`
              + (v.enveloppe.length ? ` [enveloppe : ${v.enveloppe.join(', ')}]` : '')
            : `${v.variante} : refusé (${v.statut})`).join(' | ')
        : (d.error ?? 'Diagnostic impossible.') }));
    } catch { setPms(p => ({ ...p, [feedId]: 'Diagnostic impossible.' })); }
  }

  async function voirLogementsPms(feedId: string) {
    if (pms[feedId]) { setPms(p => { const n = { ...p }; delete n[feedId]; return n; }); return; }
    setPms(p => ({ ...p, [feedId]: 'chargement' }));
    try {
      const res = await fetch('/api/reservations/pms-properties', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedId }),
      });
      const data = await res.json().catch(() => ({}));
      setPms(p => ({ ...p, [feedId]: data.ok ? data : (data.error ?? 'Lecture impossible.') }));
    } catch { setPms(p => ({ ...p, [feedId]: 'Lecture impossible.' })); }
  }

  async function voirDetail(id: string) {
    if (detail[id]) { setDetail(d => { const n = { ...d }; delete n[id]; return n; }); return; }
    setDetail(d => ({ ...d, [id]: 'chargement' }));
    try {
      const res = await fetch(`/api/reservations/detail?id=${encodeURIComponent(id)}`);
      const data = await res.json().catch(() => ({}));
      setDetail(d => ({ ...d, [id]: data.ok ? data : 'erreur' }));
    } catch { setDetail(d => ({ ...d, [id]: 'erreur' })); }
  }

  // Créer le ménage d'une réservation que la synchro n'a pas retenue. Booking
  // emploie le même intitulé pour une réservation et pour un blocage : quand le
  // calendrier ne permet pas de trancher, c'est l'exploitant qui tranche.
  async function creerMenage(reservationId: string) {
    setForcage(reservationId); setSyncMsg('');
    try {
      const res = await fetch('/api/reservations/mission', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId }),
      });
      const data = await res.json().catch(() => ({}));
      setSyncFailed(!data.ok);
      setSyncMsg(data.ok ? 'Ménage créé et rattaché à la réservation.' : `Erreur : ${data.error ?? 'création impossible'}`);
    } catch {
      setSyncFailed(true); setSyncMsg('Création impossible pour le moment.');
    }
    await load();
    setForcage(null);
  }

  const load = useCallback(async () => {
    const [a, r, f, p] = await Promise.all([
      getAirbnbs(), getAllReservations(), getAllReservationFeeds(), getPartnerAccountsDB(),
    ]);
    setPartenaires(p.filter(x => x.kind === 'airbnb' && !!x.userId));
    setApartments(a); setReservations(r); setFeeds(f);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel('admin-reservations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  async function syncAll() {
    setSyncing(true); setSyncMsg('');
    try {
      const res = await fetch('/api/reservations/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const data = await res.json();
      // La route renvoie un échec PAR CALENDRIER. L'écran ne lisait que le
      // total : un lien expiré affichait « 0 réservation importée » comme un
      // succès, et personne ne savait qu'un flux était mort. On le dit.
      if (!data.ok) setSyncMsg(`Erreur : ${data.error}`);
      else {
        const errs: string[] = data.errors ?? [];
        setSyncMsg(
          `${data.feeds} calendrier(s) · ${data.imported} réservation(s) importée(s) · ${data.missionsCreated} mission(s) créée(s).`
          + (errs.length ? ` ⚠ ${errs.length} calendrier(s) en échec : ${errs.join(' · ')}` : ''),
        );
        setSyncFailed(errs.length > 0);
      }
    } catch { setSyncMsg('Synchronisation impossible.'); }
    await load();
    setSyncing(false);
  }

  // ── Ordre de lecture de la liste ────────────────────────────────────────
  // La base rend les réservations par date de départ DÉCROISSANTE : le séjour
  // le plus lointain arrivait en tête et le départ de demain se retrouvait
  // enterré sous tout le reste. C'est l'inverse de ce qu'on vient chercher ici.
  // On remonte donc ce qui approche, du plus proche au plus lointain, et on
  // renvoie le passé en dessous — récent d'abord, puisqu'on n'y descend que
  // pour vérifier quelque chose.
  const { upcoming, past } = useMemo(() => {
    const up = reservations.filter(r => r.checkOut >= today)
      .sort((a, b) => a.checkOut.localeCompare(b.checkOut) || (a.apartmentName ?? '').localeCompare(b.apartmentName ?? ''));
    const old = reservations.filter(r => r.checkOut < today)
      .sort((a, b) => b.checkOut.localeCompare(a.checkOut));
    return { upcoming: up, past: old };
  }, [reservations, today]);

  // Séjours impossibles : deux voyageurs ne peuvent pas occuper le même
  // logement en même temps. C'est le signal le plus net qu'un calendrier
  // exporte des périodes d'indisponibilité au lieu de séjours, ou qu'un
  // logement porte un flux de trop — et il ne se voyait nulle part.
  const conflits = useMemo(() => chevauchements(reservations), [reservations]);

  // Calendriers : les pannes d'abord, puis par logement. Et le compte de flux
  // par logement, parce qu'un logement qui en porte trois est la cause la plus
  // fréquente de lignes qui se contredisent.
  const { feedsTries, feedsEnEchec, feedsParLogement } = useMemo(() => {
    const parLogement = new Map<string, number>();
    for (const f of feeds) parLogement.set(f.airbnbId, (parLogement.get(f.airbnbId) ?? 0) + 1);
    const tries = [...feeds].sort((a, b) => {
      const ea = a.lastSyncStatus === 'error' ? 0 : 1;
      const eb = b.lastSyncStatus === 'error' ? 0 : 1;
      return ea - eb || (a.apartmentName ?? '').localeCompare(b.apartmentName ?? '');
    });
    return {
      feedsTries: tries,
      feedsEnEchec: feeds.filter(f => f.lastSyncStatus === 'error').length,
      feedsParLogement: parLogement,
    };
  }, [feeds]);

  // ── Occupation par appartement ──────────────────────────────────────────
  // Même définition que le moteur : un séjour confirmé, OU une période fermée
  // d'un flux Booking — Booking emploie le même intitulé pour un séjour vendu
  // et pour une date fermée. Le bandeau ne lisait que les « confirmées » : il
  // annonçait un logement libre pendant que le moteur, lui, le savait occupé et
  // lui créait un ménage. Deux écrans du même produit ne peuvent pas répondre
  // différemment à « est-il occupé ? ».
  //
  // Le départ affiché est celui de l'occupation la plus LONGUE en cours : quand
  // deux calendriers décrivent le même séjour avec des bornes différentes,
  // annoncer la plus courte enverrait l'intervenant chez un voyageur encore là.
  const occupancy = useMemo<AptOccupancy[]>(() => {
    const byApt = new Map<string, Reservation[]>();
    for (const r of occupationsReelles(reservations)) {
      const list = byApt.get(r.airbnbId) ?? [];
      list.push(r);
      byApt.set(r.airbnbId, list);
    }
    return apartments.map(apt => {
      const list = (byApt.get(apt.id) ?? []).sort((a, b) => a.checkOut.localeCompare(b.checkOut));
      const enCours = list.filter(r => r.checkIn <= today && today < r.checkOut);
      // La plus longue fait foi : c'est la dernière du tableau, trié par départ.
      const current = enCours[enCours.length - 1];
      const nextDeparture = list.find(r => r.checkOut >= today);
      const nextArrival = list.map(r => r.checkIn).filter(d => d >= today).sort()[0];
      return { apt, occupied: !!current, currentCheckOut: current?.checkOut, nextDeparture, nextArrival };
    });
  }, [apartments, reservations, today]);

  const kpis = useMemo(() => {
    let occupied = 0, leavingSoon = 0, needsCleaning = 0, missionCreated = 0;
    for (const o of occupancy) {
      if (o.occupied) occupied++;
      if (o.nextDeparture && daysBetween(today, o.nextDeparture.checkOut) <= 3) leavingSoon++;
      if (o.nextDeparture && !o.nextDeparture.missionId) needsCleaning++;
      if (o.nextDeparture && o.nextDeparture.missionId) missionCreated++;
    }
    return { occupied, leavingSoon, needsCleaning, missionCreated };
  }, [occupancy, today]);

  // Appartements pertinents en haut (un départ à venir ou occupés).
  const sortedOcc = useMemo(() =>
    [...occupancy].sort((a, b) => {
      const da = a.nextDeparture?.checkOut ?? '9999';
      const db = b.nextDeparture?.checkOut ?? '9999';
      return da.localeCompare(db);
    }), [occupancy]);

  if (loading) return <Loading className="p-6 text-sm" />;

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Réservations &amp; occupation</h1>
          <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>
            {feeds.length} calendrier(s) connecté(s) · synchro automatique 2×/jour
          </p>
        </div>
        <button onClick={syncAll} disabled={syncing}
          className="py-2.5 px-4 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-50"
          style={{ backgroundColor: '#1A1A1A', color: '#FFFFFF' }}>
          <Icon name="sync" size={16} /> {syncing ? 'Synchronisation...' : 'Synchroniser tout'}
        </button>
      </div>
      {syncMsg && (
        <p className="text-xs mb-4 px-3 py-2 rounded-lg"
          style={syncFailed
            ? { backgroundColor: '#FDF3F2', color: '#8A3A31', border: '1px solid #E4B7B1' }
            : { backgroundColor: '#F8F6F2', color: '#7A7068' }}>
          {syncMsg}
        </p>
      )}

      {/* KPIs occupation */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPI label="Occupés actuellement" value={kpis.occupied} color="#5B6EF5" />
        <KPI label="Bientôt libérés (≤ 3j)" value={kpis.leavingSoon} color="#C48A2A" />
        <KPI label="Ménage à prévoir" value={kpis.needsCleaning} color="#B85A50" />
        <KPI label="Mission créée" value={kpis.missionCreated} color="#5A8A6A" />
      </div>

      {/* Tableau d'occupation par appartement */}
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Par appartement</h2>
      {sortedOcc.filter(o => o.occupied || o.nextDeparture).length === 0 ? (
        <div className="rounded-2xl p-10 text-center border mb-8" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune réservation active. Connectez des calendriers côté partenaires.</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden mb-8" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          {sortedOcc.filter(o => o.occupied || o.nextDeparture).map(o => {
            const turnover = o.nextDeparture && o.nextArrival && o.nextArrival === o.nextDeparture.checkOut;
            return (
              <div key={o.apt.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b last:border-0" style={{ borderColor: '#F2EFE9' }}>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>{o.apt.name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5 text-xs" style={{ color: '#7A7068' }}>
                    {o.occupied && <span style={{ color: '#5B6EF5' }}>Occupé jusqu&apos;au {fmtDate(o.currentCheckOut!)}</span>}
                    {o.nextDeparture && <span>Départ {fmtDate(o.nextDeparture.checkOut)}</span>}
                    {turnover && <span className="font-semibold" style={{ color: '#B91C1C' }}>Turnover jour même</span>}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  {o.nextDeparture ? (
                    o.nextDeparture.missionId ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full" style={{ backgroundColor: '#5A8A6A15', color: '#5A8A6A' }}>
                        <Icon name="check" size={12} /> Mission créée
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
      )}

      {/* Séjours qui se chevauchent — anomalie, jamais un cas normal. */}
      {conflits.length > 0 && (
        <div className="rounded-2xl border p-4 mb-6" style={{ borderColor: '#E4B7B1', backgroundColor: '#FDF3F2' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#8A3A31' }}>
            {conflits.length} séjour{conflits.length > 1 ? 's' : ''} impossible{conflits.length > 1 ? 's' : ''}
          </p>
          <p className="text-xs mb-3" style={{ color: '#8A3A31' }}>
            Un logement ne peut pas héberger deux voyageurs en même temps. Ces nuits sont décrites deux fois :
            un des calendriers exporte des périodes d’indisponibilité plutôt que des séjours, ou ce logement porte un flux de trop.
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

      {/* ── SuperHote : tout brancher d'un coup ──────────────────────────────── */}
      {shPour && (
        <div className="rounded-2xl border p-4 mb-8" style={{ backgroundColor: '#FFFFFF', borderColor: '#C9A84C40' }}>
          <p className="text-sm font-semibold mb-1" style={{ color: '#1A1A1A' }}>SuperHote — {shPour.name}</p>
          <p className="text-xs mb-3" style={{ color: '#A8A09A' }}>
            SuperHote ne donne pas le nom de ses logements, seulement des numéros. La prochaine période
            occupée est affichée pour vous aider à les reconnaître.
          </p>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <input value={shCle} onChange={e => setShCle(e.target.value)} placeholder="SH apiKey"
              className="flex-1 min-w-[220px] px-3 py-2 rounded-xl text-sm border" style={inputStyle} />
            <button disabled={shBusy || !shCle.trim()} onClick={shLister}
              className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
              {shBusy ? 'Lecture…' : 'Lister ses logements'}
            </button>
            <button onClick={() => { setShPour(null); setShListe(null); }}
              className="px-4 py-2 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Fermer</button>
          </div>

          {shListe && (
            <>
              <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E8E4DC', maxHeight: 420, overflowY: 'auto' }}>
                {shListe.map(l => {
                  const coche = shChoix[l.id] !== undefined;
                  return (
                    <div key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2 border-b last:border-0"
                      style={{ borderColor: '#F2EFE9', opacity: l.dejaConnecte ? 0.5 : 1 }}>
                      <input type="checkbox" disabled={l.dejaConnecte} checked={coche}
                        onChange={e => setShChoix(c => {
                          const n = { ...c };
                          if (e.target.checked) n[l.id] = l.name; else delete n[l.id];
                          return n;
                        })} />
                      <span className="text-xs font-medium w-24" style={{ color: '#1A1A1A' }}>nº {l.id}</span>
                      <span className="text-[11px] w-44" style={{ color: '#A8A09A' }}>
                        {l.dejaConnecte ? 'déjà connecté' : l.prochaine ? `occupé ${l.prochaine}` : 'aucune période à venir'}
                      </span>
                      {coche && (
                        <input value={shChoix[l.id]} onChange={e => setShChoix(c => ({ ...c, [l.id]: e.target.value }))}
                          placeholder="Nom du logement chez vous"
                          className="flex-1 min-w-[180px] px-2 py-1 rounded-lg text-xs border" style={inputStyle} />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 mt-3">
                <button disabled={shBusy || Object.keys(shChoix).length === 0} onClick={shConnecter}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                  {shBusy ? 'Connexion…' : `Connecter ${Object.keys(shChoix).length} logement(s)`}
                </button>
                <span className="text-[11px]" style={{ color: '#A8A09A' }}>
                  Un logement est créé chez vous pour chaque case cochée.
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Connecter un calendrier pour une conciergerie ───────────────────── */}
      {connecterPour && (
        <div className="rounded-2xl border p-4 mb-8" style={{ backgroundColor: '#FFFFFF', borderColor: '#C9A84C40' }}>
          <p className="text-sm font-semibold mb-3" style={{ color: '#1A1A1A' }}>
            Connecter un calendrier pour {connecterPour.name}
          </p>
          <ConnectWizard
            apartments={apartments.filter(a => a.partnerId === connecterPour.userId)}
            feeds={feeds.filter(f => f.partnerId === connecterPour.userId)}
            partnerId={connecterPour.userId!}
            partnerName={connecterPour.name}
            onDone={() => { setConnecterPour(null); load(); }}
            onCancel={() => setConnecterPour(null)}
          />
        </div>
      )}

      {/* ── Réception directe (webhook) ──────────────────────────────────────
          Le logiciel du client nous appelle à la seconde où un voyageur
          réserve, et il ANNONCE que c'est une réservation — ce qu'un lien iCal
          ne dit jamais. Aucune clé à stocker : l'URL secrète suffit. */}
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Réception directe</h2>
        <button onClick={voirRecus} className="text-[11px] underline" style={{ color: '#A8A09A' }}>
          {recus ? 'masquer' : 'évènements reçus'}
        </button>
      </div>
      <div className="rounded-2xl border overflow-hidden mb-8" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        {partenaires.length === 0 ? (
          <p className="text-sm px-4 py-6 text-center" style={{ color: '#A8A09A' }}>Aucune conciergerie.</p>
        ) : partenaires.map(p => (
          <div key={p.id} className="px-4 py-3 border-b last:border-0" style={{ borderColor: '#F2EFE9' }}>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{p.name}</span>
              <span className="flex-1" />
              <button onClick={() => { setShPour(p); setShListe(null); }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                style={{ borderColor: '#C9A84C', color: '#1A1A1A' }}>
                Brancher SuperHote
              </button>
              <button onClick={() => setConnecterPour(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border"
                style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }}>
                Autre calendrier
              </button>
              <button onClick={() => urlReception(p.userId!)}
                className="text-[11px] underline" style={{ color: '#A8A09A' }}>
                {urls[p.userId!] ? 'masquer' : 'son URL de réception'}
              </button>
            </div>
            {urls[p.userId!] && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-[11px] flex-1 min-w-[220px] break-all select-all font-medium" style={{ color: '#1A1A1A' }}>
                  {urls[p.userId!]}
                </span>
                <button onClick={() => copyField('URL de réception', urls[p.userId!])}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border inline-flex items-center gap-1.5"
                  style={{ borderColor: '#E8E4DC', color: '#1A1A1A' }}>
                  <Icon name="copy" size={13} /> Copier
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {recus && (
        <div className="rounded-2xl border p-4 mb-8" style={{ backgroundColor: '#FAFAF8', borderColor: '#E8E4DC' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: '#1A1A1A' }}>20 derniers évènements reçus</p>
          {recus.length === 0 ? (
            <p className="text-xs" style={{ color: '#A8A09A' }}>
              Rien encore. Dès que le logiciel du client appellera, la forme de son message s’affichera ici.
            </p>
          ) : (
            <div className="grid gap-1.5">
              {recus.map((e, i) => (
                <p key={i} className="text-[11px]" style={{ color: e.resultat === 'rattache' ? '#5A8A6A' : '#B85A50' }}>
                  <span className="font-semibold">{e.source} · {e.resultat}</span>
                  {e.note ? ` — ${e.note}` : ''}
                  {e.champs.length ? <span style={{ color: '#A8A09A' }}> · champs : {e.champs.join(', ')}</span> : null}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Calendriers connectés ────────────────────────────────────────────
          Ce que l'écran ne montrait nulle part : QUELS calendriers alimentent
          QUEL logement, et lequel est en panne. Sans cette vue, un lien expiré
          ou un logement portant trois calendriers qui se contredisent ne se
          diagnostique qu'en base. Les flux en échec remontent en tête. */}
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#7A7068' }}>Calendriers connectés</h2>
        {feedsEnEchec > 0 && (
          <span className="text-[11px] font-semibold" style={{ color: '#B85A50' }}>
            {feedsEnEchec} en échec
          </span>
        )}
      </div>
      <div className="rounded-2xl border overflow-hidden mb-8" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
        {feedsTries.length === 0 ? (
          <p className="text-sm px-4 py-6 text-center" style={{ color: '#A8A09A' }}>Aucun calendrier connecté.</p>
        ) : feedsTries.map(f => {
          const enEchec = f.lastSyncStatus === 'error';
          const multiple = (feedsParLogement.get(f.airbnbId) ?? 0) > 1;
          return (
            <div key={f.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 border-b last:border-0" style={{ borderColor: '#F2EFE9' }}>
              <span className="text-sm font-medium min-w-[140px]" style={{ color: '#1A1A1A' }}>{f.apartmentName ?? '—'}</span>
              <span className="text-xs" style={{ color: '#7A7068' }}>{platformLabel(f.platform)}</span>
              {multiple && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#C48A2A18', color: '#C48A2A' }}>
                  plusieurs calendriers
                </span>
              )}
              {!f.active && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#6B728018', color: '#6B7280' }}>inactif</span>
              )}
              <span className="flex-1" />
              {f.connectionKind === 'api' && (
                <>
                  <button onClick={() => voirLogementsPms(f.id)}
                    className="text-[11px] underline" style={{ color: '#A8A09A' }}>
                    {pms[f.id] ? 'masquer' : 'quel logement ?'}
                  </button>
                  <button onClick={() => diagnostiquer(f.id)}
                    className="text-[11px] underline" style={{ color: '#A8A09A' }}>
                    que répond le logiciel ?
                  </button>
                </>
              )}
              {enEchec ? (
                <span className="text-[11px] font-semibold text-right" style={{ color: '#B85A50' }}>
                  En échec{f.lastError ? ` — ${f.lastError}` : ''}
                </span>
              ) : (
                <span className="text-[11px]" style={{ color: '#A8A09A' }}>
                  {f.lastSyncAt ? `Synchronisé le ${fmtDate(f.lastSyncAt.slice(0, 10))}` : 'Jamais synchronisé'}
                </span>
              )}
              {pms[f.id] && (
                <div className="w-full mt-2 text-[11px]">
                  {pms[f.id] === 'chargement' ? <span style={{ color: '#A8A09A' }}>Lecture du logiciel…</span>
                    : typeof pms[f.id] === 'string' ? <span style={{ color: '#B85A50' }}>{pms[f.id] as string}</span>
                    : (() => {
                      const d = pms[f.id] as { rattache: string; trouve: boolean; logements: { id: string; name: string }[] };
                      return (
                        <>
                          {!d.trouve && (
                            <p className="font-semibold mb-1" style={{ color: '#B85A50' }}>
                              L’identifiant enregistré ne correspond à aucun logement de ce compte : la connexion pointe dans le vide.
                            </p>
                          )}
                          <ul className="grid gap-0.5">
                            {d.logements.map(l => (
                              <li key={l.id} style={{ color: l.id === d.rattache ? '#1A1A1A' : '#A8A09A' }}>
                                {l.id === d.rattache ? '● ' : '○ '}{l.name}
                                {l.id === d.rattache ? ' — rattaché' : ''}
                              </li>
                            ))}
                          </ul>
                        </>
                      );
                    })()}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Réservations synchronisées (toutes plateformes) */}
      <h2 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: '#7A7068' }}>Réservations synchronisées</h2>
      {upcoming.length === 0 && past.length === 0 ? (
        <div className="rounded-2xl p-10 text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <p className="text-sm" style={{ color: '#A8A09A' }}>Aucune réservation importée pour le moment.</p>
        </div>
      ) : (
        <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
          <div className="grid grid-cols-12 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider border-b" style={{ color: '#A8A09A', borderColor: '#F2EFE9' }}>
            <span className="col-span-4">Appartement</span>
            <span className="col-span-2">Plateforme</span>
            <span className="col-span-2 text-center">Arrivée</span>
            <span className="col-span-2 text-center">Départ</span>
            <span className="col-span-2 text-right">Mission</span>
          </div>
          {[
            ...upcoming.map(r => ({ r, passe: false })),
            ...past.slice(0, 60).map(r => ({ r, passe: true })),
          ].map(({ r, passe }, i, arr) => {
            const st = RES_STATUS[r.status] ?? RES_STATUS.confirmed;
            // Repère visuel entre ce qui arrive et ce qui est derrière nous.
            const debutPasse = passe && !arr[i - 1]?.passe;
            return (
              <div key={r.id}>
              {debutPasse && (
                <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider border-b border-t"
                  style={{ color: '#A8A09A', backgroundColor: '#FAFAF8', borderColor: '#F2EFE9' }}>
                  Séjours terminés
                </div>
              )}
              <div className="grid grid-cols-12 items-center px-4 py-3 border-b last:border-0" style={{ borderColor: '#F2EFE9', opacity: passe ? 0.55 : 1 }}>
                <div className="col-span-4 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{r.apartmentName ?? '—'}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                  <button onClick={() => voirDetail(r.id)}
                    className="ml-2 text-[10px] underline" style={{ color: '#A8A09A' }}>
                    {detail[r.id] ? 'masquer' : 'd’où vient cette ligne ?'}
                  </button>
                </div>
                <span className="col-span-2 text-xs" style={{ color: '#7A7068' }}>{platformLabel(r.platform)}</span>
                <span className="col-span-2 text-center text-xs" style={{ color: '#7A7068' }}>{fmtDate(r.checkIn)}</span>
                <span className="col-span-2 text-center text-xs font-semibold" style={{ color: '#1A1A1A' }}>{fmtDate(r.checkOut)}</span>
                <div className="col-span-2 text-right">
                  {r.missionId ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#5A8A6A' }}><Icon name="check" size={13} /> Créée</span>
                  ) : r.status === 'confirmed' ? (
                    <span className="text-[11px]" style={{ color: '#C48A2A' }}>À venir</span>
                  ) : passe || r.status === 'cancelled' ? (
                    <span className="text-[11px]" style={{ color: '#A8A09A' }}>—</span>
                  ) : (
                    // Ligne écartée par la synchro alors que le départ est à venir :
                    // c'est exactement le cas où le calendrier ne sait pas dire si
                    // c'est un séjour. On laisse l'exploitant le décider.
                    <button onClick={() => creerMenage(r.id)} disabled={forcage === r.id}
                      className="text-[11px] font-semibold px-2 py-1 rounded-lg border disabled:opacity-50"
                      style={{ borderColor: '#C9A84C', color: '#1A1A1A' }}>
                      {forcage === r.id ? 'Création…' : 'Créer le ménage'}
                    </button>
                  )}
                </div>
              </div>
              {detail[r.id] && (
                <div className="px-4 py-3 text-[11px] border-b" style={{ backgroundColor: '#FAFAF8', borderColor: '#F2EFE9', color: '#7A7068' }}>
                  {detail[r.id] === 'chargement' ? 'Lecture…'
                    : detail[r.id] === 'erreur' ? 'Détail indisponible.'
                    : (() => {
                      const d = detail[r.id] as Exclude<typeof detail[string], 'chargement' | 'erreur'>;
                      return (
                        <div className="grid gap-0.5">
                          <p>Calendrier : <span style={{ color: '#1A1A1A' }}>{d.calendrier.label || d.calendrier.platform || '—'}</span>
                            {d.calendrier.hote ? ` (${d.calendrier.hote})` : ''}</p>
                          <p>Intitulé envoyé : <span className="font-medium" style={{ color: '#1A1A1A' }}>{d.evenement.summary || '(vide)'}</span></p>
                          <p>Dates envoyées : <span style={{ color: '#1A1A1A' }}>{d.evenement.start} → {d.evenement.end}</span>
                            {d.evenement.status ? ` · ${d.evenement.status}` : ''}</p>
                          <p className="break-all">Identifiant : {d.evenement.uid || '—'}</p>
                        </div>
                      );
                    })()}
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
