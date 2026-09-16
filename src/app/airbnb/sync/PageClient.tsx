'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedback } from '@/contexts/FeedbackContext';
import {
  getAirbnbsForPartner, getReservationFeedsForPartner, getReservationsForPartner,
  updateReservationFeed, deleteReservationFeed, countReservationsForFeed,
} from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { Apartment, ReservationFeed, Reservation } from '@/lib/types';
import { platformLabel } from '@/lib/pms/registry';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import { Badge, Button, Card, EmptyState, PageTitle, Segmented } from '@/components/ui';
import ConnectWizard from './ConnectWizard';

const RES_STATUS: Record<string, { label: string; tone: 'success' | 'danger' | 'warn' | 'neutral' }> = {
  confirmed: { label: 'Confirmée',   tone: 'success' },
  cancelled: { label: 'Annulée',     tone: 'danger' },
  tentative: { label: 'À confirmer', tone: 'warn' },
  blocked:   { label: 'Bloqué',      tone: 'neutral' },
};

function fmtDate(d: string) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
function fmtDateTime(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function AirbnbSyncPage() {
  const { user } = useAuth();
  const { confirm, toast } = useFeedback();
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [feeds, setFeeds] = useState<ReservationFeed[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'feeds' | 'reservations'>('feeds');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  // Le message de synchro affichait succès et échec dans le même encart beige :
  // un import raté ressemblait à un import réussi.
  const [syncFailed, setSyncFailed] = useState(false);

  // Parcours de connexion guidé (logement + calendrier en une fois).
  // ?connect=1 l'ouvre directement — c'est le lien de première prise en main
  // depuis le tableau de bord.
  const [showForm, setShowForm] = useState(false);
  // Logement visé par le parcours de connexion. Null = « connecter un logement »
  // (le partenaire choisit) ; un id = « ajouter un calendrier » à celui-ci.
  const [connectFor, setConnectFor] = useState<string | null>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('connect')) setShowForm(true);
  }, []);

  // Un logement peut porter plusieurs calendriers (Airbnb + Booking + Abritel
  // pour un propriétaire sans logiciel de gestion). On les présente ensemble :
  // deux cartes séparées portant le même nom de logement laissaient croire à un
  // doublon, alors que les départs sont fusionnés en un seul ménage par date.
  const feedGroups = useMemo(() => {
    const map = new Map<string, { name: string; list: ReservationFeed[] }>();
    for (const f of feeds) {
      const g = map.get(f.airbnbId) ?? { name: f.apartmentName ?? 'Appartement', list: [] };
      g.list.push(f);
      map.set(f.airbnbId, g);
    }
    return [...map.entries()].map(([airbnbId, g]) => ({ airbnbId, ...g }));
  }, [feeds]);

  const load = useCallback(async () => {
    if (!user) return;
    const [a, f, r] = await Promise.all([
      getAirbnbsForPartner(user.id),
      getReservationFeedsForPartner(user.id),
      getReservationsForPartner(user.id),
    ]);
    setApartments(a); setFeeds(f); setReservations(r);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
    if (!user) return;
    const ch = supabase.channel('partner-reservations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservations' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reservation_feeds' }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load, user]);

  async function syncNow() {
    if (!user) return;
    setSyncing(true); setSyncMsg(''); setSyncFailed(false);
    try {
      const res = await fetch('/api/reservations/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: user.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setSyncMsg(`${data.imported} réservation(s) importée(s) · ${data.missionsCreated} mission(s) créée(s).`);
      } else {
        setSyncFailed(true);
        setSyncMsg(`Erreur de synchronisation : ${data.error ?? 'inconnue'}`);
      }
    } catch {
      setSyncFailed(true);
      setSyncMsg('Synchronisation impossible pour le moment.');
    }
    await load();
    setSyncing(false);
  }

  async function toggleFeed(f: ReservationFeed) {
    await updateReservationFeed(f.id, { active: !f.active });
    load();
  }
  async function removeFeed(f: ReservationFeed) {
    // Le message annonçait « les réservations déjà importées sont conservées ».
    // C'était faux : elles partent avec le flux. On dit désormais la vérité, avec
    // le nombre exact, et on rappelle que « Mettre en pause » ne détruit rien.
    const n = await countReservationsForFeed(f.id);
    const ok = await confirm({
      title: 'Déconnecter ce calendrier ?',
      message: [
        n > 0
          ? `${n} réservation${n > 1 ? 's' : ''} importée${n > 1 ? 's' : ''} ${n > 1 ? 'seront supprimées' : 'sera supprimée'} : sans le calendrier, ${n > 1 ? 'elles ne seraient' : 'elle ne serait'} plus jamais mise${n > 1 ? 's' : ''} à jour.`
          : 'Aucune réservation importée pour ce calendrier.',
        'Les ménages déjà créés sont conservés.',
        'Pour arrêter la synchronisation sans rien perdre, utilisez « Mettre en pause ».',
      ].join('\n\n'),
      confirmLabel: 'Déconnecter', danger: true,
    });
    if (!ok) return;
    await deleteReservationFeed(f.id);
    load();
    toast('Calendrier déconnecté.', 'success');
  }

  if (loading) return <Loading className="p-5 pt-8 text-sm" />;

  return (
    <div className="p-5 mcp-in">
      <PageTitle
        title="Synchronisation des réservations"
        subtitle="Connectez vos calendriers : les départs deviennent automatiquement des missions de ménage."
      />

      {/* Synchroniser maintenant */}
      <button onClick={syncNow} disabled={syncing || feeds.length === 0}
        className="w-full mb-2 min-h-[48px] py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 bg-ink text-white active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100">
        <Icon name="sync" size={16} />
        {syncing ? 'Synchronisation...' : 'Synchroniser maintenant'}
      </button>
      {syncMsg && (
        <p role="status" className={`text-xs mb-2 px-3 py-2 rounded-lg ${syncFailed ? 'bg-danger-soft text-danger' : 'bg-surface-2 text-muted'}`}>
          {syncMsg}
        </p>
      )}

      {/* Rappel : la synchro tourne automatiquement (crons 6h et 18h). Le bouton
          ci-dessus ne sert qu'à forcer une actualisation immédiate. */}
      {feeds.length > 0 && (() => {
        const latest = feeds
          .map(f => f.lastSyncAt)
          .filter(Boolean)
          .sort()
          .pop();
        return (
          <p className="text-[11px] mb-2 flex items-center gap-1.5 text-success">
            <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" />
            Synchronisation automatique 2×/jour{latest ? ` · dernière : ${fmtDateTime(latest)}` : ''}
          </p>
        );
      })()}

      <Segmented
        value={tab}
        onChange={setTab}
        className="my-4"
        options={[['feeds', 'Connexions'], ['reservations', 'Réservations']] as const}
      />

      {/* ── ONGLET CONNEXIONS ─────────────────────────────────────────── */}
      {tab === 'feeds' && (
        <>
          {!showForm && (
            <button onClick={() => { setConnectFor(null); setShowForm(true); }}
              className="w-full mb-4 min-h-[48px] py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border border-gold text-ink active:scale-95 transition-transform">
              <Icon name="plus" size={16} /> Connecter un logement
            </button>
          )}

          {showForm && user && (
            <ConnectWizard
              apartments={apartments}
              feeds={feeds}
              initialApartmentId={connectFor}
              partnerId={user.id}
              partnerName={user.name}
              onCancel={() => { setShowForm(false); setConnectFor(null); }}
              onDone={async () => {
                const wasAdding = connectFor !== null;
                setShowForm(false); setConnectFor(null);
                await load();
                toast(wasAdding
                  ? 'Calendrier ajouté — première synchronisation en cours.'
                  : 'Logement connecté — première synchronisation en cours.', 'success');
                syncNow();
              }}
            />
          )}

          {feeds.length === 0 && !showForm ? (
            <EmptyState icon="link" title="Aucun calendrier connecté" hint="Connectez Airbnb, Booking, Smoobu…" />
          ) : feeds.length === 0 ? null : (
            <div className="space-y-3">
              {feedGroups.map(g => (
                <Card key={g.airbnbId} className="p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold truncate text-ink">{g.name}</p>
                    <span className="text-[11px] shrink-0 text-muted">
                      {g.list.length} calendrier{g.list.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* La question que se pose tout propriétaire multi-plateformes :
                      « est-ce que je vais avoir deux ménages ? » — on y répond ici. */}
                  {g.list.length > 1 && (
                    <p className="text-[11px] mt-0.5 text-muted">
                      Les départs des {g.list.length} calendriers sont fusionnés : un seul ménage par date.
                    </p>
                  )}

                  <div className="mt-3 space-y-2">
                    {g.list.map(f => (
                      <div key={f.id} className="rounded-xl border p-3 border-hairline">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate text-ink">{platformLabel(f.platform)}</p>
                            {f.label && <p className="text-[11px] truncate text-muted">{f.label}</p>}
                            {/* Une connexion API apporte les horaires ; un lien iCal non. */}
                            {f.connectionKind === 'api' && (
                              <p className="text-[11px] text-success">Connexion API — horaires d&apos;arrivée et de départ inclus</p>
                            )}
                          </div>
                          <Badge tone={f.active ? 'success' : 'neutral'}>{f.active ? 'Actif' : 'En pause'}</Badge>
                        </div>

                        <div className="mt-1.5 text-[11px] text-muted">
                          {f.lastSyncStatus === 'error' ? (
                            <span className="font-semibold text-danger">Dernière synchro en échec : {f.lastError}</span>
                          ) : f.lastSyncAt ? (
                            <span>Dernière synchro : {fmtDateTime(f.lastSyncAt)}</span>
                          ) : (
                            <span>Pas encore synchronisé</span>
                          )}
                        </div>

                        <div className="flex gap-2 mt-2">
                          <Button variant="ghost" size="sm" onClick={() => toggleFeed(f)} className="flex-1">
                            {f.active ? 'Mettre en pause' : 'Réactiver'}
                          </Button>
                          <Button variant="danger" size="sm" onClick={() => removeFeed(f)}>Déconnecter</Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Le geste manquait : rien n'indiquait qu'un logement pouvait
                      recevoir un deuxième calendrier. */}
                  {!showForm && (
                    <Button variant="ghost" size="sm" className="w-full mt-2"
                      onClick={() => { setConnectFor(g.airbnbId); setShowForm(true); }}>
                      + Ajouter un calendrier
                    </Button>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── ONGLET RÉSERVATIONS SYNCHRONISÉES ─────────────────────────── */}
      {tab === 'reservations' && (
        reservations.length === 0 ? (
          <EmptyState icon="calendar" title="Aucune réservation synchronisée" hint="Connectez un calendrier puis synchronisez." />
        ) : (
          <Card className="overflow-hidden">
            <div className="grid grid-cols-12 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider border-b text-muted border-hairline">
              <span className="col-span-5">Appartement</span>
              <span className="col-span-2 text-center">Arrivée</span>
              <span className="col-span-2 text-center">Départ</span>
              <span className="col-span-3 text-right">Mission</span>
            </div>
            {reservations.map(r => {
              const st = RES_STATUS[r.status] ?? RES_STATUS.confirmed;
              return (
                <div key={r.id} className="grid grid-cols-12 items-center gap-1 px-4 py-3 border-b last:border-0 border-hairline">
                  <div className="col-span-5 min-w-0">
                    <p className="text-sm font-medium truncate text-ink">{r.apartmentName ?? '—'}</p>
                    <Badge tone={st.tone} size="sm">{st.label}</Badge>
                  </div>
                  <span className="col-span-2 text-center text-xs text-muted">{fmtDate(r.checkIn)}</span>
                  <span className="col-span-2 text-center text-xs font-semibold text-ink">{fmtDate(r.checkOut)}</span>
                  <div className="col-span-3 text-right">
                    {r.missionId ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-success">
                        <Icon name="check" size={13} /> Créée
                      </span>
                    ) : r.status === 'confirmed' ? (
                      <span className="text-[11px] font-semibold text-warn">À venir</span>
                    ) : (
                      <span className="text-[11px] text-muted">—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        )
      )}
    </div>
  );
}
