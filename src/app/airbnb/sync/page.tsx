'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getAirbnbsForPartner, getReservationFeedsForPartner, getReservationsForPartner,
  createReservationFeed, updateReservationFeed, deleteReservationFeed,
} from '@/lib/db';
import { supabase } from '@/lib/supabase';
import type { Apartment, ReservationFeed, Reservation, ReservationPlatform } from '@/lib/types';
import Icon from '@/components/Icon';
import Loading from "@/components/Loading";

const inputStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E8E4DC', color: '#1A1A1A', outline: 'none' } as const;

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

const RES_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  confirmed: { label: 'Confirmée', color: '#5A8A6A', bg: '#5A8A6A15' },
  cancelled: { label: 'Annulée',   color: '#B85A50', bg: '#B85A5015' },
  tentative: { label: 'À confirmer', color: '#C48A2A', bg: '#C48A2A15' },
  blocked:   { label: 'Bloqué',    color: '#6B7280', bg: '#6B728018' },
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
  const [apartments, setApartments] = useState<Apartment[]>([]);
  const [feeds, setFeeds] = useState<ReservationFeed[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'feeds' | 'reservations'>('feeds');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

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
    setSyncing(true); setSyncMsg('');
    try {
      const res = await fetch('/api/reservations/sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partnerId: user.id }),
      });
      const data = await res.json();
      if (data.ok) {
        setSyncMsg(`${data.imported} réservation(s) importée(s) · ${data.missionsCreated} mission(s) créée(s).`);
      } else {
        setSyncMsg(`Erreur de synchronisation : ${data.error ?? 'inconnue'}`);
      }
    } catch {
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
    if (!confirm('Déconnecter ce calendrier ? Les réservations déjà importées sont conservées.')) return;
    await deleteReservationFeed(f.id);
    load();
  }

  if (loading) return <Loading className="p-5 pt-8 text-sm" />;

  const hint = PLATFORMS.find(p => p.value === fPlatform)?.hint;

  return (
    <div className="p-5">
      <div className="mb-2 pt-2">
        <h1 className="text-xl font-bold" style={{ color: '#1A1A1A' }}>Synchronisation des réservations</h1>
        <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>
          Connectez vos calendriers : les départs deviennent automatiquement des missions de ménage.
        </p>
      </div>

      {/* Synchroniser maintenant */}
      <button onClick={syncNow} disabled={syncing || feeds.length === 0}
        className="w-full mt-3 mb-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
        style={{ backgroundColor: '#1A1A1A', color: '#FFFFFF' }}>
        <Icon name="sync" size={16} />
        {syncing ? 'Synchronisation...' : 'Synchroniser maintenant'}
      </button>
      {syncMsg && <p className="text-xs mb-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F8F6F2', color: '#7A7068' }}>{syncMsg}</p>}

      {/* Onglets */}
      <div className="flex gap-1 my-4 p-1 rounded-2xl w-fit" style={{ backgroundColor: '#F5F3EF' }}>
        {([['feeds', 'Connexions'], ['reservations', 'Réservations']] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)} className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ backgroundColor: tab === v ? '#FFFFFF' : 'transparent', color: tab === v ? '#1A1A1A' : '#A8A09A', boxShadow: tab === v ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── ONGLET CONNEXIONS ─────────────────────────────────────────── */}
      {tab === 'feeds' && (
        <>
          {!showForm && (
            <button onClick={() => { setShowForm(true); setFormError(''); }}
              className="w-full mb-4 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 border"
              style={{ borderColor: '#C9A84C', color: '#1A1A1A' }}>
              <Icon name="plus" size={16} /> Connecter un calendrier
            </button>
          )}

          {showForm && (
            <form onSubmit={addFeed} className="mb-5 rounded-2xl border p-4 space-y-3" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7068' }}>Appartement</label>
                <select value={fAirbnb} onChange={e => setFAirbnb(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm border appearance-none" style={{ ...inputStyle, color: fAirbnb ? '#1A1A1A' : '#A8A09A' }}>
                  <option value="">Sélectionner</option>
                  {apartments.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7068' }}>Plateforme</label>
                <select value={fPlatform} onChange={e => setFPlatform(e.target.value as ReservationPlatform)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm border appearance-none" style={inputStyle}>
                  {PLATFORMS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
                {hint && <p className="text-[11px] mt-1.5" style={{ color: '#A8A09A' }}>{hint}</p>}
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7068' }}>URL iCal</label>
                <input type="url" value={fUrl} onChange={e => setFUrl(e.target.value)} placeholder="https://...ics"
                  className="w-full px-3 py-2.5 rounded-lg text-sm border" style={inputStyle} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#7A7068' }}>Libellé — optionnel</label>
                <input type="text" value={fLabel} onChange={e => setFLabel(e.target.value)} placeholder="Ex : Annonce Airbnb T2"
                  className="w-full px-3 py-2.5 rounded-lg text-sm border" style={inputStyle} />
              </div>
              {formError && <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#B85A50' }}>{formError}</p>}
              <div className="flex gap-2">
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                  {saving ? '...' : 'Connecter'}
                </button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2.5 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>Annuler</button>
              </div>
            </form>
          )}

          {feeds.length === 0 ? (
            <div className="rounded-2xl p-10 flex flex-col items-center text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
              <span className="mb-3" style={{ color: '#D4CEC4' }}><Icon name="link" size={30} /></span>
              <p className="font-medium text-sm" style={{ color: '#1A1A1A' }}>Aucun calendrier connecté</p>
              <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Connectez Airbnb, Booking, Smoobu…</p>
            </div>
          ) : (
            <div className="space-y-3">
              {feeds.map(f => (
                <div key={f.id} className="rounded-2xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1A1A1A' }}>
                        {f.apartmentName ?? 'Appartement'} <span style={{ color: '#A8A09A' }}>· {platformLabel(f.platform)}</span>
                      </p>
                      {f.label && <p className="text-xs truncate" style={{ color: '#A8A09A' }}>{f.label}</p>}
                    </div>
                    <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold shrink-0"
                      style={{ backgroundColor: f.active ? '#5A8A6A15' : '#6B728018', color: f.active ? '#5A8A6A' : '#6B7280' }}>
                      {f.active ? 'Actif' : 'En pause'}
                    </span>
                  </div>

                  <div className="mt-2 text-[11px]" style={{ color: '#A8A09A' }}>
                    {f.lastSyncStatus === 'error' ? (
                      <span style={{ color: '#B85A50' }}>Dernière synchro en échec : {f.lastError}</span>
                    ) : f.lastSyncAt ? (
                      <span>Dernière synchro : {fmtDateTime(f.lastSyncAt)}</span>
                    ) : (
                      <span>Pas encore synchronisé</span>
                    )}
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button onClick={() => toggleFeed(f)} className="flex-1 py-2 rounded-xl text-xs font-medium border" style={{ borderColor: '#E8E4DC', color: '#7A7068' }}>
                      {f.active ? 'Mettre en pause' : 'Réactiver'}
                    </button>
                    <button onClick={() => removeFeed(f)} className="px-4 py-2 rounded-xl text-xs font-medium border" style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>
                      Déconnecter
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── ONGLET RÉSERVATIONS SYNCHRONISÉES ─────────────────────────── */}
      {tab === 'reservations' && (
        reservations.length === 0 ? (
          <div className="rounded-2xl p-10 flex flex-col items-center text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
            <span className="mb-3" style={{ color: '#D4CEC4' }}><Icon name="calendar" size={30} /></span>
            <p className="font-medium text-sm" style={{ color: '#1A1A1A' }}>Aucune réservation synchronisée</p>
            <p className="text-xs mt-1" style={{ color: '#A8A09A' }}>Connectez un calendrier puis synchronisez.</p>
          </div>
        ) : (
          <div className="rounded-2xl border overflow-hidden" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
            <div className="grid grid-cols-12 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider border-b" style={{ color: '#A8A09A', borderColor: '#F2EFE9' }}>
              <span className="col-span-5">Appartement</span>
              <span className="col-span-2 text-center">Arrivée</span>
              <span className="col-span-2 text-center">Départ</span>
              <span className="col-span-3 text-right">Mission</span>
            </div>
            {reservations.map(r => {
              const st = RES_STATUS[r.status] ?? RES_STATUS.confirmed;
              return (
                <div key={r.id} className="grid grid-cols-12 items-center px-4 py-3 border-b last:border-0" style={{ borderColor: '#F2EFE9' }}>
                  <div className="col-span-5 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#1A1A1A' }}>{r.apartmentName ?? '—'}</p>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <span className="col-span-2 text-center text-xs" style={{ color: '#7A7068' }}>{fmtDate(r.checkIn)}</span>
                  <span className="col-span-2 text-center text-xs font-semibold" style={{ color: '#1A1A1A' }}>{fmtDate(r.checkOut)}</span>
                  <div className="col-span-3 text-right">
                    {r.missionId ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: '#5A8A6A' }}>
                        <Icon name="check" size={13} /> Créée
                      </span>
                    ) : r.status === 'confirmed' ? (
                      <span className="text-[11px]" style={{ color: '#C48A2A' }}>À venir</span>
                    ) : (
                      <span className="text-[11px]" style={{ color: '#A8A09A' }}>—</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
