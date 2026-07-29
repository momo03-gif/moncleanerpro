'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeedback } from '@/contexts/FeedbackContext';
import {
  getAirbnbsForPartner, getReservationFeedsForPartner, getReservationsForPartner,
  createReservationFeed, updateReservationFeed, deleteReservationFeed,
} from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { Apartment, ReservationFeed, Reservation, ReservationPlatform } from '@/lib/types';
import Icon from '@/components/Icon';
import Loading from '@/components/Loading';
import { Badge, Button, Card, EmptyState, FIELD_SM, Label, PageTitle, Segmented } from '@/components/ui';

// Plateformes supportées + aide « où trouver l'URL iCal ». Toutes exposent un
// export iCal par logement (l'API native pourra être ajoutée par plateforme).
const PLATFORMS: { value: ReservationPlatform; label: string; hint: string }[] = [
  { value: 'airbnb',   label: 'Airbnb',      hint: 'Annonce → Disponibilité → Synchroniser les calendriers → Exporter le calendrier.' },
  { value: 'booking',  label: 'Booking.com', hint: 'Extranet → Tarifs et disponibilités → Synchro calendrier → Exporter.' },
  { value: 'guesty',   label: 'Guesty',      hint: 'Listing → Calendar → iCal export link.' },
  { value: 'hostaway', label: 'Hostaway',    hint: 'Listing → Channel Manager → iCal export.' },
  { value: 'lodgify',  label: 'Lodgify',     hint: 'Calendar → Import/Export → Export calendar (.ics).' },
  { value: 'smoobu',   label: 'Smoobu',      hint: 'Apartment → Channel manager → Exportez (iCal).' },
  { value: 'beds24',   label: 'Beds24',      hint: 'Settings → Sync → Export calendar (iCal).' },
  { value: 'amenitiz', label: 'Amenitiz',    hint: 'Channel manager → Synchronisation iCal → Lien d\'export.' },
  { value: 'ical',     label: 'Flux iCal',   hint: 'Collez l\'URL d\'export .ics de votre outil de réservation.' },
  { value: 'other',    label: 'Autre PMS',   hint: 'Collez l\'URL d\'export iCal fournie par votre logiciel.' },
];
const platformLabel = (p: string) => PLATFORMS.find(x => x.value === p)?.label ?? p;

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

  // Formulaire de connexion
  const [showForm, setShowForm] = useState(false);
  const [fAirbnb, setFAirbnb] = useState('');
  const [fPlatform, setFPlatform] = useState<ReservationPlatform>('airbnb');
  const [fUrl, setFUrl] = useState('');
  const [fLabel, setFLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

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

  async function addFeed(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!fAirbnb) { setFormError('Sélectionnez un appartement.'); return; }
    if (!fUrl.trim()) { setFormError('Collez l\'URL iCal de la plateforme.'); return; }
    setSaving(true); setFormError('');
    const res = await createReservationFeed({
      airbnbId: fAirbnb, partnerId: user.id, platform: fPlatform, icalUrl: fUrl, label: fLabel || undefined,
    });
    setSaving(false);
    if (res.error) { setFormError(res.error); return; }
    setShowForm(false); setFAirbnb(''); setFPlatform('airbnb'); setFUrl(''); setFLabel('');
    await load();
    // Première synchro immédiate du flux ajouté.
    syncNow();
  }

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
    const ok = await confirm({ title: 'Déconnecter ce calendrier ?', message: 'Les réservations déjà importées sont conservées.', confirmLabel: 'Déconnecter', danger: true });
    if (!ok) return;
    await deleteReservationFeed(f.id);
    load();
    toast('Calendrier déconnecté.', 'success');
  }

  if (loading) return <Loading className="p-5 pt-8 text-sm" />;

  const hint = PLATFORMS.find(p => p.value === fPlatform)?.hint;

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
            <button onClick={() => { setShowForm(true); setFormError(''); }}
              className="w-full mb-4 min-h-[48px] py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border border-gold text-ink active:scale-95 transition-transform">
              <Icon name="plus" size={16} /> Connecter un calendrier
            </button>
          )}

          {showForm && (
            <Card as="section" className="mb-5 p-4">
              <form onSubmit={addFeed} className="space-y-3">
                <div>
                  <Label htmlFor="feed-apt">Appartement</Label>
                  <select id="feed-apt" value={fAirbnb} onChange={e => setFAirbnb(e.target.value)}
                    className={`${FIELD_SM} appearance-none`}>
                    <option value="">Sélectionner</option>
                    {apartments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <div>
                  <Label htmlFor="feed-platform">Plateforme</Label>
                  <select id="feed-platform" value={fPlatform}
                    onChange={e => setFPlatform(e.target.value as ReservationPlatform)}
                    className={`${FIELD_SM} appearance-none`}>
                    {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                  {hint && <p className="text-[11px] mt-1.5 text-muted">{hint}</p>}
                </div>
                <div>
                  <Label htmlFor="feed-url">URL iCal</Label>
                  <input id="feed-url" type="url" value={fUrl} onChange={e => setFUrl(e.target.value)}
                    placeholder="https://...ics" className={FIELD_SM} />
                </div>
                <div>
                  <Label htmlFor="feed-label">Libellé — optionnel</Label>
                  <input id="feed-label" type="text" value={fLabel} onChange={e => setFLabel(e.target.value)}
                    placeholder="Ex : Annonce Airbnb T2" className={FIELD_SM} />
                </div>
                {formError && <p role="alert" className="text-xs px-3 py-2 rounded-lg bg-danger-soft text-danger">{formError}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={saving} className="flex-1">{saving ? '...' : 'Connecter'}</Button>
                  <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Annuler</Button>
                </div>
              </form>
            </Card>
          )}

          {feeds.length === 0 ? (
            <EmptyState icon="link" title="Aucun calendrier connecté" hint="Connectez Airbnb, Booking, Smoobu…" />
          ) : (
            <div className="space-y-3">
              {feeds.map(f => (
                <Card key={f.id} className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate text-ink">
                        {f.apartmentName ?? 'Appartement'} <span className="font-normal text-muted">· {platformLabel(f.platform)}</span>
                      </p>
                      {f.label && <p className="text-xs truncate text-muted">{f.label}</p>}
                    </div>
                    <Badge tone={f.active ? 'success' : 'neutral'}>{f.active ? 'Actif' : 'En pause'}</Badge>
                  </div>

                  <div className="mt-2 text-[11px] text-muted">
                    {f.lastSyncStatus === 'error' ? (
                      <span className="font-semibold text-danger">Dernière synchro en échec : {f.lastError}</span>
                    ) : f.lastSyncAt ? (
                      <span>Dernière synchro : {fmtDateTime(f.lastSyncAt)}</span>
                    ) : (
                      <span>Pas encore synchronisé</span>
                    )}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button variant="ghost" size="sm" onClick={() => toggleFeed(f)} className="flex-1">
                      {f.active ? 'Mettre en pause' : 'Réactiver'}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => removeFeed(f)}>Déconnecter</Button>
                  </div>
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
