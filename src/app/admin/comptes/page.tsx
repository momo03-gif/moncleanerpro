'use client';

import { useState, useEffect } from 'react';
import {
  getPendingHotelsDB, approveHotelDB, refuseHotelDB,
  getPendingAirbnbPartnersDB, approveAirbnbPartnerDB, refuseAirbnbPartnerDB,
  getApprovedHotelsDB, updateHotelRateDB, getMissionsDB,
} from '@/lib/db';
import type { Mission } from '@/lib/types';
import { inputStyle } from '@/lib/ui';
import { currentMonth } from '@/lib/mockData';
import Icon from '@/components/Icon';

type PartnerKind = 'hotel' | 'airbnb';
interface PendingPartner {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  userId?: string;
  kind: PartnerKind;
}

const KIND_LABEL: Record<PartnerKind, string> = { hotel: 'Hôtel', airbnb: 'Airbnb / Conciergerie' };

export default function ComptesPage() {
  const [pending, setPending] = useState<PendingPartner[]>([]);
  const [hotels, setHotels] = useState<any[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [rates, setRates] = useState<Record<string, string>>({});
  const [savedId, setSavedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [done, setDone] = useState<Record<string, 'approved' | 'refused'>>({});

  async function load() {
    const [pendHotels, partners, approvedHotels, allMissions] = await Promise.all([
      getPendingHotelsDB(), getPendingAirbnbPartnersDB(), getApprovedHotelsDB(), getMissionsDB(),
    ]);
    const list: PendingPartner[] = [
      ...pendHotels.map((h: any) => ({ ...h, kind: 'hotel' as const })),
      ...partners.map((p: any) => ({ ...p, kind: 'airbnb' as const })),
    ];
    setPending(list);
    setHotels(approvedHotels);
    setMissions(allMissions);
    setRates(Object.fromEntries(approvedHotels.map((h: any) => [h.id, h.billing_hourly_rate != null ? String(h.billing_hourly_rate) : ''])));
    setLoading(false);
  }

  const month = currentMonth();
  // Heures RÉALISÉES (missions terminées) pour un hôtel, ce mois — base de la facturation.
  function hotelHoursThisMonth(hotelName: string): number {
    const mins = missions
      .filter(m => m.source === 'hotel' && (m.requestedBy ?? m.property) === hotelName
        && m.status === 'completed' && m.date.startsWith(month))
      .reduce((s, m) => s + (m.missionDurationMinutes ?? 0), 0);
    return Math.round((mins / 60) * 100) / 100;
  }

  useEffect(() => { load(); }, []);

  async function saveRate(hotelId: string) {
    await updateHotelRateDB(hotelId, Number(rates[hotelId]) || 0);
    setSavedId(hotelId);
    setTimeout(() => setSavedId(s => (s === hotelId ? null : s)), 1500);
  }

  async function handleApprove(p: PendingPartner) {
    if (p.kind === 'hotel') await approveHotelDB(p.id); else await approveAirbnbPartnerDB(p.id);
    setDone(d => ({ ...d, [p.id]: 'approved' }));
  }

  async function handleRefuse(p: PendingPartner) {
    if (p.kind === 'hotel') await refuseHotelDB(p.id); else await refuseAirbnbPartnerDB(p.id);
    setDone(d => ({ ...d, [p.id]: 'refused' }));
  }

  const active = pending.filter(h => !done[h.id]);
  const processed = pending.filter(h => done[h.id]);

  if (loading) return <div className="p-6 text-sm" style={{ color: '#A8A09A' }}>Chargement...</div>;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold" style={{ color: '#1A1A1A' }}>Comptes en attente</h1>
        <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Demandes d'inscription des partenaires hôtel et Airbnb / conciergerie</p>
      </div>

      {active.length === 0 && processed.length === 0 && (
        <div className="rounded-2xl p-10 flex flex-col items-center text-center border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FFFFFF' }}>
          <span className="mb-3" style={{ color: '#D4CEC4' }}><Icon name="accounts" size={30} /></span>
          <p className="font-medium" style={{ color: '#1A1A1A' }}>Aucune demande en attente</p>
          <p className="text-sm mt-1" style={{ color: '#A8A09A' }}>Toutes les demandes ont été traitées</p>
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-3 mb-8">
          {active.map(h => (
            <div key={h.id} className="rounded-2xl border p-5" style={{ backgroundColor: '#FFFFFF', borderColor: '#C48A2A40' }}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold" style={{ color: '#1A1A1A' }}>{h.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: h.kind === 'airbnb' ? '#C9A84C15' : '#F5F3EF', color: h.kind === 'airbnb' ? '#C9A84C' : '#7A7068' }}>
                      {KIND_LABEL[h.kind]}
                    </span>
                  </div>
                  {h.address && <p className="text-sm" style={{ color: '#7A7068' }}>{h.address}</p>}
                  <p className="text-sm" style={{ color: '#A8A09A' }}>{h.email}{h.phone ? ` · ${h.phone}` : ''}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleApprove(h)} className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#C9A84C', color: '#1A1A1A' }}>
                    Valider
                  </button>
                  <button onClick={() => handleRefuse(h)} className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-sm border" style={{ borderColor: '#E8E4DC', color: '#B85A50' }}>
                    Refuser
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {processed.length > 0 && (
        <>
          <h2 className="font-semibold mb-3" style={{ color: '#1A1A1A' }}>Traitées cette session</h2>
          <div className="space-y-2">
            {processed.map(h => (
              <div key={h.id} className="rounded-xl px-5 py-3 flex items-center gap-4 border" style={{ borderColor: '#E8E4DC', backgroundColor: '#FAFAF8' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: '#1A1A1A' }}>{h.name}</p>
                  <p className="text-xs" style={{ color: '#A8A09A' }}>{h.email}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{
                  backgroundColor: done[h.id] === 'approved' ? '#5A8A6A15' : '#B85A5015',
                  color: done[h.id] === 'approved' ? '#5A8A6A' : '#B85A50',
                }}>
                  {done[h.id] === 'approved' ? '✓ Validé' : '✕ Refusé'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Hôtels validés : taux horaire FACTURÉ (propre à chaque hôtel). */}
      {hotels.length > 0 && (
        <div className="mt-10">
          <h2 className="font-semibold mb-1" style={{ color: '#1A1A1A' }}>Hôtels partenaires — taux horaire facturé</h2>
          <p className="text-sm mb-4" style={{ color: '#A8A09A' }}>Ce qu'on facture à l'hôtel, par heure. Le CA hôtel = taux × heures réalisées.</p>
          <div className="space-y-3">
            {hotels.map((h: any) => {
              const hours = hotelHoursThisMonth(h.hotel_name);
              const rate = Number(rates[h.id]) || 0;
              const toBill = Math.round(hours * rate * 100) / 100;
              return (
              <div key={h.id} className="rounded-2xl border p-4" style={{ backgroundColor: '#FFFFFF', borderColor: '#E8E4DC' }}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: '#1A1A1A' }}>{h.hotel_name}</p>
                    {h.address && <p className="text-xs" style={{ color: '#A8A09A' }}>{h.address}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <input type="number" min="0" step="0.5" value={rates[h.id] ?? ''}
                        onChange={e => setRates(r => ({ ...r, [h.id]: e.target.value }))}
                        placeholder="0" className="w-24 px-3 py-2 rounded-xl text-sm border text-right" style={inputStyle} />
                      <span className="text-sm" style={{ color: '#7A7068' }}>€ / h</span>
                    </div>
                    <button onClick={() => saveRate(h.id)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: savedId === h.id ? '#5A8A6A' : '#C9A84C', color: savedId === h.id ? '#FFFFFF' : '#1A1A1A' }}>
                      {savedId === h.id ? '✓ Enregistré' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
                {/* Heures réalisées ce mois + montant à facturer (heures × taux). */}
                <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-x-6 gap-y-1" style={{ borderColor: '#F2EFE9' }}>
                  <span className="text-xs" style={{ color: '#A8A09A' }}>Heures réalisées ce mois : <span className="font-semibold" style={{ color: '#1A1A1A' }}>{hours} h</span></span>
                  <span className="text-xs" style={{ color: '#A8A09A' }}>À facturer ce mois : <span className="font-semibold" style={{ color: '#5A8A6A' }}>{toBill} €</span></span>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
